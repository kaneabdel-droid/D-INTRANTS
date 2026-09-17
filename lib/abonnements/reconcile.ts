// Cœur du crédit d'abonnement — trois chemins (retour utilisateur, webhook,
// cron), tous convergent ici, tous idempotents. Reprend les invariants de
// Chariow.md §5 : ne jamais dater le succès à `new Date()` quand on a une date
// provider, ne jamais créditer sans re-pull SAUF pour Bictorys où le re-pull
// est impossible (WAF) et où le webhook signé fait foi (cf. providers/bictorys.ts).

import { addMonths } from 'date-fns'
import { createAdminClient } from '@/utils/supabase/admin'
import { adaptateurPour } from './registry'
import type { ProviderId, StatutProvider } from './types'
import type { DureeMois, PalierCode } from './paliers'

type LigneAbonnement = {
  id: string
  // null = demande publique pas encore rattachée à une entreprise (paiement
  // avant création de compte, cf. app/tarifs/actions.ts) — le crédit du palier
  // ne s'applique qu'une fois entreprise_id renseigné par l'admin système.
  entreprise_id: string | null
  palier: PalierCode
  duree_mois: DureeMois
  montant_fcfa: number
  provider: ProviderId
  provider_reference: string | null
  statut: 'en_attente' | 'paye' | 'echoue'
}

type ResultatReconciliation =
  | { ok: true; credite: boolean }
  | { ok: false; raison: string }

// Tolérance anti-fraude 5% (fees/arrondis provider), cf. Chariow.md §5 et la
// skill izisaas — un écart au-delà n'est jamais crédité, seulement journalisé.
async function appliquerStatut(ligne: LigneAbonnement, statutDistant: StatutProvider, montantDistant?: number, payeLe?: Date): Promise<ResultatReconciliation> {
  if (ligne.statut !== 'en_attente') return { ok: true, credite: ligne.statut === 'paye' }

  const supabase = createAdminClient()

  if (statutDistant === 'succeeded') {
    if (montantDistant !== undefined) {
      const ecart = Math.abs(montantDistant - ligne.montant_fcfa) / ligne.montant_fcfa
      if (ecart > 0.05) {
        console.error('[Abonnements] anomalie montant — NON crédité', { abonnementId: ligne.id, attendu: ligne.montant_fcfa, recu: montantDistant })
        return { ok: false, raison: 'montant_suspect' }
      }
    }

    const dateSucces = payeLe ?? new Date()

    // Clause WHERE statut='en_attente' = garde-fou contre la course cron ↔
    // webhook ↔ retour utilisateur ; la contrainte unique (provider,
    // provider_reference) protège en plus contre un doublon inter-lignes.
    const { data: misAJour } = await supabase
      .from('abonnements')
      .update({ statut: 'paye', paye_at: dateSucces.toISOString() })
      .eq('id', ligne.id)
      .eq('statut', 'en_attente')
      .select('id')
      .maybeSingle()

    if (!misAJour) return { ok: true, credite: true } // déjà traité par une exécution concurrente

    // Demande publique (pas encore d'entreprise, cf. app/tarifs/actions.ts) :
    // on s'arrête ici, la ligne payée attend d'être traitée depuis
    // /admin/demandes — pas d'entreprise à créditer pour l'instant.
    if (!ligne.entreprise_id) return { ok: true, credite: true }

    const { data: entreprise } = await supabase
      .from('entreprises')
      .select('palier, abonnement_expire_le')
      .eq('id', ligne.entreprise_id)
      .single()

    const maintenant = new Date()
    // Prolonge depuis l'expiration actuelle si l'entreprise est encore active
    // sur LE MÊME palier (renouvellement anticipé) ; repart de maintenant sinon
    // (reprise après coupure ou changement de palier — pas de proratisation,
    // simplification assumée pour la V1).
    const encoreActif = Boolean(entreprise?.abonnement_expire_le) && new Date(entreprise!.abonnement_expire_le!) > maintenant && entreprise!.palier === ligne.palier
    const base = encoreActif ? new Date(entreprise!.abonnement_expire_le!) : maintenant
    const nouvelleExpiration = addMonths(base, ligne.duree_mois)

    await supabase.from('abonnements').update({ periode_debut: base.toISOString(), periode_fin: nouvelleExpiration.toISOString() }).eq('id', ligne.id)
    await supabase.from('entreprises').update({ palier: ligne.palier, abonnement_expire_le: nouvelleExpiration.toISOString(), statut: 'actif' }).eq('id', ligne.entreprise_id)

    return { ok: true, credite: true }
  }

  if (statutDistant === 'failed' || statutDistant === 'abandoned') {
    await supabase.from('abonnements').update({ statut: 'echoue' }).eq('id', ligne.id).eq('statut', 'en_attente')
    return { ok: true, credite: false }
  }

  return { ok: true, credite: false } // toujours pending côté provider
}

// Chemin Chariow + Moneroo : re-pull obligatoire, jamais de confiance dans le
// corps du webhook (cf. Chariow.md §11 "ne jamais créditer sur la foi du webhook").
export async function reconcilierParReferenceProvider(provider: ProviderId, providerReference: string): Promise<ResultatReconciliation> {
  const supabase = createAdminClient()
  const { data: ligne } = await supabase.from('abonnements').select('*').eq('provider', provider).eq('provider_reference', providerReference).maybeSingle<LigneAbonnement>()
  if (!ligne) return { ok: false, raison: 'abonnement_introuvable' }
  if (ligne.statut !== 'en_attente') return { ok: true, credite: ligne.statut === 'paye' }

  const distant = await adaptateurPour(provider).recupererStatut(providerReference)
  if (!distant) return { ok: false, raison: 're_pull_impossible' }

  return appliquerStatut(ligne, distant.statut, distant.montant, distant.payeLe)
}

export async function reconcilierParAbonnementId(abonnementId: string): Promise<ResultatReconciliation> {
  const supabase = createAdminClient()
  const { data: ligne } = await supabase.from('abonnements').select('*').eq('id', abonnementId).maybeSingle<LigneAbonnement>()
  if (!ligne) return { ok: false, raison: 'abonnement_introuvable' }
  if (ligne.statut !== 'en_attente') return { ok: true, credite: ligne.statut === 'paye' }
  if (!ligne.provider_reference) return { ok: false, raison: 'pas_encore_de_reference_provider' }

  const distant = await adaptateurPour(ligne.provider).recupererStatut(ligne.provider_reference)
  if (!distant) return { ok: false, raison: 're_pull_impossible' }

  return appliquerStatut(ligne, distant.statut, distant.montant, distant.payeLe)
}

// Chemin Bictorys UNIQUEMENT : le re-pull serveur est bloqué par leur WAF (cf.
// providers/bictorys.ts), donc le webhook signé est la seule source possible.
// L'appelant DOIT avoir vérifié la signature avant d'appeler cette fonction.
export async function appliquerEvenementBictorysVerifie(providerReference: string, statutDistant: StatutProvider, montantDistant: number | undefined, abonnementIdRepli: string | undefined): Promise<ResultatReconciliation> {
  const supabase = createAdminClient()
  let ligne = (await supabase.from('abonnements').select('*').eq('provider', 'bictorys').eq('provider_reference', providerReference).maybeSingle<LigneAbonnement>()).data

  if (!ligne && abonnementIdRepli) {
    ligne = (await supabase.from('abonnements').select('*').eq('id', abonnementIdRepli).maybeSingle<LigneAbonnement>()).data
    if (ligne && !ligne.provider_reference) {
      await supabase.from('abonnements').update({ provider_reference: providerReference }).eq('id', ligne.id)
    }
  }

  if (!ligne) return { ok: false, raison: 'abonnement_introuvable' }
  return appliquerStatut(ligne, statutDistant, montantDistant)
}

// Tâche planifiée (voir app/api/cron/abonnements/route.ts) : rattrape les
// paiements Chariow/Moneroo en attente (un webhook manqué, un retour
// utilisateur interrompu...) et referme ceux restés bloqués trop longtemps.
export async function reconcilierPaiementsEnAttente(): Promise<{ traites: number; credites: number }> {
  const supabase = createAdminClient()
  const { data: lignes } = await supabase
    .from('abonnements')
    .select('*')
    .eq('statut', 'en_attente')
    .in('provider', ['chariow', 'moneroo'])
    .not('provider_reference', 'is', null)
    .returns<LigneAbonnement[]>()

  let credites = 0
  for (const ligne of lignes ?? []) {
    const resultat = await reconcilierParAbonnementId(ligne.id)
    if (resultat.ok && resultat.credite) credites++
  }

  // Un paiement en_attente vieux de plus de 48h sans confirmation provider est
  // considéré abandonné — l'entreprise peut relancer un nouveau paiement.
  const seuil = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()
  await supabase.from('abonnements').update({ statut: 'echoue' }).eq('statut', 'en_attente').lt('created_at', seuil)

  return { traites: lignes?.length ?? 0, credites }
}

// Suspend les entreprises dont la période payée est révolue — réactivées
// automatiquement au prochain paiement réussi (voir appliquerStatut ci-dessus).
export async function suspendreEntreprisesExpirees(): Promise<number> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('entreprises')
    .update({ statut: 'suspendu' })
    .eq('statut', 'actif')
    .lt('abonnement_expire_le', new Date().toISOString())
    .select('id')

  return data?.length ?? 0
}
