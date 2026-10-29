// Cœur du crédit d'abonnement — trois chemins (retour utilisateur, webhook,
// cron), tous convergent ici, tous idempotents. Reprend les invariants de
// Chariow.md §5 : ne jamais dater le succès à `new Date()` quand on a une date
// provider, ne jamais créditer sans re-pull SAUF pour Bictorys où le re-pull
// est impossible (WAF) et où le webhook signé fait foi (cf. providers/bictorys.ts).

import { addMonths } from 'date-fns'
import { createAdminClient } from '@/utils/supabase/admin'
import { adaptateurPour } from './registry'
import { envoyerEmailsConfirmationAbonnement } from './emails'
import { calculerMontantFcfa, calculerMontantUsd, equivalentFcfa, type DureeMois, type PalierCode } from './paliers'
import { estMoyenPaiementManuel, type MoyenPaiementAbonnement, type MoyenPaiementManuel, type ProviderId, type StatutProvider } from './types'

type LigneAbonnement = {
  id: string
  // null = demande publique pas encore rattachée à une entreprise (paiement
  // avant création de compte, cf. app/tarifs/actions.ts) — le crédit du palier
  // ne s'applique qu'une fois entreprise_id renseigné par l'admin système.
  entreprise_id: string | null
  palier: PalierCode
  duree_mois: DureeMois
  montant_fcfa: number
  // XOF par défaut ; USD pour un client d'un autre pays, montant_devise étant alors le montant en dollars (migration 27)
  devise: string
  montant_devise: number | null
  provider: MoyenPaiementAbonnement
  provider_reference: string | null
  statut: 'en_attente' | 'paye' | 'echoue'
  created_at: string
  metadata?: Record<string, any> | null
}

type ResultatReconciliation =
  | { ok: true; credite: boolean }
  | { ok: false; raison: string }

const PRODUIT_NOM = 'D-INTRANTS'

// Tolérance anti-fraude 5% (fees/arrondis provider), cf. Chariow.md §5 et la
// skill izisaas — un écart au-delà n'est jamais crédité, seulement journalisé.
async function appliquerStatut(ligne: LigneAbonnement, statutDistant: StatutProvider, montantDistant?: number, payeLe?: Date, deviseDistante?: string): Promise<ResultatReconciliation> {
  if (ligne.statut !== 'en_attente') return { ok: true, credite: ligne.statut === 'paye' }

  const supabase = createAdminClient()

  if (statutDistant === 'succeeded') {
    const enDollars = ligne.devise === 'USD'
    // Un paiement demandé en dollars doit être confirmé en dollars : un montant identique dans une autre devise est une fraude.
    if (enDollars && deviseDistante && deviseDistante.toUpperCase() !== 'USD') {
      console.error('[Abonnements] anomalie devise — NON crédité', { abonnementId: ligne.id, attendu: 'USD', recu: deviseDistante })
      return { ok: false, raison: 'devise_suspecte' }
    }
    const attendu = enDollars ? Number(ligne.montant_devise) : ligne.montant_fcfa
    if (montantDistant !== undefined) {
      const ecart = Math.abs(montantDistant - attendu) / attendu
      if (ecart > 0.05) {
        console.error('[Abonnements] anomalie montant — NON crédité', { abonnementId: ligne.id, attendu, recu: montantDistant })
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
    if (!ligne.entreprise_id) {
      envoyerEmailsConfirmationAbonnement({
        abonnementId: ligne.id,
        entrepriseId: null,
        palier: ligne.palier,
        dureeMois: ligne.duree_mois,
        montant: ligne.montant_fcfa,
        devise: ligne.devise,
        provider: (ligne.metadata?.moyenPaiementReel as string | undefined) || ligne.provider,
        providerReference: ligne.provider_reference,
        metadata: ligne.metadata,
      }, PRODUIT_NOM).catch((e) => console.error('[Emails] Erreur envoi confirmation abonnement public:', e))

      return { ok: true, credite: true }
    }

    // Filet anti double paiement : une autre tentative pour le même palier a été
    // payée entre la création de celle-ci et son paiement (le client a réglé deux
    // pages de paiement ouvertes en parallèle). L'argent est encaissé mais ne doit
    // pas prolonger une seconde fois → doublon à rembourser, exclu des ventes.
    const { count: dejaPaye } = await supabase
      .from('abonnements')
      .select('id', { count: 'exact', head: true })
      .eq('entreprise_id', ligne.entreprise_id)
      .eq('palier', ligne.palier)
      .eq('statut', 'paye')
      .eq('doublon', false)
      .neq('id', ligne.id)
      .gte('paye_at', ligne.created_at)
      .lt('paye_at', dateSucces.toISOString())
    if (dejaPaye) {
      await supabase.from('abonnements').update({ doublon: true }).eq('id', ligne.id)
      console.error('[Abonnements] doublon encaissé — à rembourser', { abonnementId: ligne.id, entrepriseId: ligne.entreprise_id })
      return { ok: true, credite: true }
    }

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

    envoyerEmailsConfirmationAbonnement({
      abonnementId: ligne.id,
      entrepriseId: ligne.entreprise_id,
      palier: ligne.palier,
      dureeMois: ligne.duree_mois,
      montant: ligne.montant_fcfa,
      devise: ligne.devise,
      provider: (ligne.metadata?.moyenPaiementReel as string | undefined) || ligne.provider,
      providerReference: ligne.provider_reference,
      metadata: ligne.metadata,
      dateFin: nouvelleExpiration.toISOString(),
    }, PRODUIT_NOM).catch((e) => console.error('[Emails] Erreur envoi confirmation abonnement:', e))

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

  return appliquerStatut(ligne, distant.statut, distant.montant, distant.payeLe, distant.devise)
}

export async function reconcilierParAbonnementId(abonnementId: string): Promise<ResultatReconciliation> {
  const supabase = createAdminClient()
  const { data: ligne } = await supabase.from('abonnements').select('*').eq('id', abonnementId).maybeSingle<LigneAbonnement>()
  if (!ligne) return { ok: false, raison: 'abonnement_introuvable' }
  if (ligne.statut !== 'en_attente') return { ok: true, credite: ligne.statut === 'paye' }
  if (estMoyenPaiementManuel(ligne.provider) || estMoyenPaiementManuel(String(ligne.metadata?.moyenPaiementReel ?? ''))) {
    return { ok: true, credite: false }
  }
  if (!ligne.provider_reference) return { ok: false, raison: 'pas_encore_de_reference_provider' }

  const distant = await adaptateurPour(ligne.provider as ProviderId).recupererStatut(ligne.provider_reference)
  if (!distant) return { ok: false, raison: 're_pull_impossible' }

  return appliquerStatut(ligne, distant.statut, distant.montant, distant.payeLe, distant.devise)
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

/**
 * Confirmation / activation directe d'un abonnement existant par le super-admin
 * (paiement reçu en caisse ou par virement bancaire).
 */
export async function crediterAbonnementManuel(abonnementId: string, moyenOverride?: MoyenPaiementManuel): Promise<ResultatReconciliation> {
  const supabase = createAdminClient()
  const { data: ligne } = await supabase.from('abonnements').select('*').eq('id', abonnementId).maybeSingle<LigneAbonnement>()
  if (!ligne) return { ok: false, raison: 'abonnement_introuvable' }
  if (ligne.statut === 'paye') return { ok: true, credite: true }

  const moyenEffectif = moyenOverride || (estMoyenPaiementManuel(ligne.provider) ? ligne.provider : (ligne.metadata?.moyenPaiementReel as MoyenPaiementManuel | undefined) || 'caisse')
  const metadataMaj = {
    ...(ligne.metadata ?? {}),
    moyenPaiementReel: moyenEffectif,
    valideParSuperadmin: true,
    valideLe: new Date().toISOString(),
  }

  const { error: errUpdateProvider } = await supabase
    .from('abonnements')
    .update({ statut: 'en_attente', provider: moyenEffectif, metadata: metadataMaj })
    .eq('id', abonnementId)

  if (errUpdateProvider) {
    await supabase
      .from('abonnements')
      .update({ statut: 'en_attente', metadata: metadataMaj })
      .eq('id', abonnementId)
  }

  const lignePreparee: LigneAbonnement = {
    ...ligne,
    statut: 'en_attente',
    provider: errUpdateProvider ? ligne.provider : moyenEffectif,
    metadata: metadataMaj,
  }

  return appliquerStatut(lignePreparee, 'succeeded', undefined, new Date(), ligne.devise)
}

/**
 * Création et activation immédiate d'un abonnement par le super-admin (Caisse ou Virement)
 * pour une entreprise donnée, sans passer par un prestataire de paiement en ligne.
 */
export async function creerEtActiverAbonnementManuel(params: {
  entrepriseId: string
  palier: PalierCode
  dureeMois: DureeMois
  moyen: MoyenPaiementManuel
}): Promise<{ ok: true; abonnementId: string; expireLe: string } | { ok: false; error: string }> {
  const supabase = createAdminClient()

  const { data: entreprise, error: entErr } = await supabase
    .from('entreprises')
    .select('id, nom, palier, abonnement_expire_le, devise')
    .eq('id', params.entrepriseId)
    .maybeSingle()

  if (entErr || !entreprise) {
    return { ok: false, error: entErr?.message || 'Entreprise introuvable' }
  }

  await supabase
    .from('abonnements')
    .update({ abandonne_le: new Date().toISOString() })
    .eq('entreprise_id', params.entrepriseId)
    .eq('statut', 'en_attente')
    .is('abandonne_le', null)

  const enDollars = entreprise.devise === 'AUCUNE'
  const montantUsd = enDollars ? calculerMontantUsd(params.palier, params.dureeMois) : undefined
  const montantFcfa = montantUsd ? equivalentFcfa(montantUsd) : calculerMontantFcfa(params.palier, params.dureeMois)
  const devise = enDollars ? 'USD' : 'XOF'
  const montantDevise = montantUsd ?? montantFcfa

  const maintenant = new Date()
  const encoreActif =
    Boolean(entreprise.abonnement_expire_le) &&
    new Date(entreprise.abonnement_expire_le!) > maintenant &&
    entreprise.palier === params.palier
  const base = encoreActif ? new Date(entreprise.abonnement_expire_le!) : maintenant
  const nouvelleExpiration = addMonths(base, params.dureeMois)

  const metadata = {
    moyenPaiementReel: params.moyen,
    activeParSuperadmin: true,
    activeLe: maintenant.toISOString(),
  }

  let insertRes = await supabase
    .from('abonnements')
    .insert({
      entreprise_id: params.entrepriseId,
      palier: params.palier,
      duree_mois: params.dureeMois,
      montant_fcfa: montantFcfa,
      devise,
      montant_devise: montantDevise,
      provider: params.moyen,
      statut: 'paye',
      paye_at: maintenant.toISOString(),
      periode_debut: base.toISOString(),
      periode_fin: nouvelleExpiration.toISOString(),
      metadata,
    })
    .select('id')
    .single()

  if (insertRes.error && (insertRes.error.code === '23514' || insertRes.error.message.includes('abonnements_provider_check'))) {
    insertRes = await supabase
      .from('abonnements')
      .insert({
        entreprise_id: params.entrepriseId,
        palier: params.palier,
        duree_mois: params.dureeMois,
        montant_fcfa: montantFcfa,
        devise,
        montant_devise: montantDevise,
        provider: 'chariow',
        statut: 'paye',
        paye_at: maintenant.toISOString(),
        periode_debut: base.toISOString(),
        periode_fin: nouvelleExpiration.toISOString(),
        metadata,
      })
      .select('id')
      .single()
  }

  if (insertRes.error || !insertRes.data) {
    return { ok: false, error: insertRes.error?.message || "Impossible d'enregistrer le paiement d'abonnement" }
  }

  const { error: majErr } = await supabase
    .from('entreprises')
    .update({
      palier: params.palier,
      abonnement_expire_le: nouvelleExpiration.toISOString(),
      statut: 'actif',
    })
    .eq('id', params.entrepriseId)

  if (majErr) {
    return { ok: false, error: majErr.message }
  }

  envoyerEmailsConfirmationAbonnement(
    {
      abonnementId: insertRes.data.id,
      entrepriseId: params.entrepriseId,
      palier: params.palier,
      dureeMois: params.dureeMois,
      montant: montantFcfa,
      devise,
      provider: params.moyen,
      providerReference: insertRes.data.id,
      metadata,
      dateFin: nouvelleExpiration.toISOString(),
    },
    PRODUIT_NOM
  ).catch((e) => console.error('[Emails] Erreur envoi confirmation abonnement manuel:', e))

  return { ok: true, abonnementId: insertRes.data.id, expireLe: nouvelleExpiration.toISOString() }
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
    .in('provider', ['chariow', 'moneroo', 'maketou'])
    .not('provider_reference', 'is', null)
    .returns<LigneAbonnement[]>()

  let credites = 0
  for (const ligne of lignes ?? []) {
    const resultat = await reconcilierParAbonnementId(ligne.id)
    if (resultat.ok && resultat.credite) credites++
  }

  const seuil = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()
  await supabase
    .from('abonnements')
    .update({ statut: 'echoue' })
    .eq('statut', 'en_attente')
    .in('provider', ['chariow', 'moneroo', 'bictorys', 'maketou'])
    .not('provider_reference', 'is', null)
    .lt('created_at', seuil)

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
