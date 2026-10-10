'use server'

import { getCurrentUserContext } from '@/lib/auth/getCurrentUserContext'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { estPalierValide, estDureeValide, calculerMontantFcfa, calculerMontantUsd, equivalentFcfa } from '@/lib/abonnements/paliers'
import { adaptateurPour, providerActif } from '@/lib/abonnements/registry'
import { PAYS_TELEPHONE_SUPPORTES } from '@/lib/abonnements/telephone'
import { paieEnDollars } from '@/lib/pays'
import { reconcilierParAbonnementId } from '@/lib/abonnements/reconcile'
import { estRecent, refusRenouvellementAnticipe } from '@/lib/abonnements/antiDoublon'

type ResultatDemarrage = { success: true; checkoutUrl: string } | { error: string }

export async function demarrerPaiementAbonnement(
  palierBrut: string,
  dureeMoisBrut: number,
  telephonePays: string,
  telephoneLocal: string,
  moyenPaiement: string = 'maketou'
): Promise<ResultatDemarrage> {
  const context = await getCurrentUserContext()
  if (context.role !== 'admin_entreprise') return { error: "Seul l'administrateur de l'entreprise peut gérer l'abonnement" }
  if (!estPalierValide(palierBrut)) return { error: 'Palier invalide' }
  if (!estDureeValide(dureeMoisBrut)) return { error: 'Durée invalide' }
  if (!telephoneLocal.trim()) return { error: 'Le numéro de téléphone est requis' }
  if (!PAYS_TELEPHONE_SUPPORTES.includes(telephonePays)) return { error: 'Pays invalide' }

  const palier = palierBrut
  const dureeMois = dureeMoisBrut
  // « Autre pays » : paiement par carte en dollars US (Moneroo), quel que soit le prestataire actif.
  const enDollars = paieEnDollars(telephonePays)
  const montantUsd = enDollars ? calculerMontantUsd(palier, dureeMois) : undefined
  const montantFcfa = montantUsd ? equivalentFcfa(montantUsd) : calculerMontantFcfa(palier, dureeMois)
  const provider = enDollars ? 'moneroo' : (moyenPaiement === 'chariow' || moyenPaiement === 'maketou') ? moyenPaiement : providerActif()

  const supabaseSession = await createClient()
  const { data: { user } } = await supabaseSession.auth.getUser()
  if (!user?.email) return { error: 'Session invalide' }

  const { data: profil } = await supabaseSession.from('utilisateurs').select('nom, prenom').eq('id', user.id).single()

  const supabase = createAdminClient()

  // Anti double paiement (1/2) : une période déjà réglée pour ce palier ne se
  // rachète pas tant qu'elle n'approche pas de son échéance.
  const { data: entreprise } = await supabase
    .from('entreprises')
    .select('palier, abonnement_expire_le')
    .eq('id', context.entrepriseId)
    .single()
  const refus = refusRenouvellementAnticipe(entreprise?.palier, entreprise?.abonnement_expire_le, palier)
  if (refus) return { error: refus }

  // Anti double paiement (2/2) : relancer la même offre renvoie vers le paiement
  // déjà ouvert au lieu d'en créer un second (double clic, second onglet...).
  const offre = { palier, dureeMois, montantFcfa, provider }
  const reutilisable = await paiementEnCoursReutilisable(context.entrepriseId, offre)
  if (reutilisable) return reutilisable

  const { data: abonnement, error: insertError } = await supabase
    .from('abonnements')
    .insert({
      entreprise_id: context.entrepriseId,
      palier,
      duree_mois: dureeMois,
      montant_fcfa: montantFcfa,
      devise: enDollars ? 'USD' : 'XOF',
      montant_devise: montantUsd ?? montantFcfa,
      provider,
      statut: 'en_attente',
    })
    .select('id')
    .single()

  if (insertError || !abonnement) {
    // 23505 = index unique « un paiement en cours par entreprise » : une requête
    // concurrente (double clic) vient d'en créer un — on renvoie celui-là.
    if (insertError?.code === '23505') {
      const concurrent = await paiementEnCoursReutilisable(context.entrepriseId, offre)
      if (concurrent) return concurrent
      return { error: 'Un paiement est déjà en cours. Patientez quelques secondes puis réessayez.' }
    }
    return { error: insertError?.message || "Impossible de créer l'abonnement" }
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
  const resultat = await adaptateurPour(provider).initierPaiement({
    abonnementId: abonnement.id,
    palier,
    dureeMois,
    montantFcfa,
    montantUsd,
    emailClient: user.email,
    prenomClient: profil?.prenom || '',
    nomClient: profil?.nom || '',
    telephoneLocal,
    telephonePays,
    retourUrl: `${siteUrl}/abonnement/retour?id=${abonnement.id}`,
    nomEntreprise: context.entrepriseNom,
  })

  if (!resultat.ok) {
    await supabase.from('abonnements').update({ statut: 'echoue', metadata: { erreur: resultat.error } }).eq('id', abonnement.id)
    return { error: resultat.error }
  }

  await supabase
    .from('abonnements')
    .update({
      provider_reference: resultat.referenceProvider,
      checkout_url: resultat.checkoutUrl,
      metadata: resultat.montantFacture ? { montantFacture: resultat.montantFacture, deviseFacturee: resultat.deviseFacturee } : null,
    })
    .eq('id', abonnement.id)

  return { success: true, checkoutUrl: resultat.checkoutUrl }
}

type Offre = { palier: string; dureeMois: number; montantFcfa: number; provider: string }

/**
 * Paiement en cours de l'entreprise (au plus un, cf. index unique de la migration
 * « anti doublon ») : même offre et encore récent → renvoyé tel quel ; sinon marqué
 * abandonné (il reste 'en_attente' : payé plus tard, il sera traité et marqué
 * doublon si besoin, cf. lib/abonnements/reconcile.ts) pour en laisser créer un neuf.
 */
async function paiementEnCoursReutilisable(entrepriseId: string, offre: Offre): Promise<ResultatDemarrage | null> {
  const supabase = createAdminClient()
  const { data: enCours } = await supabase
    .from('abonnements')
    .select('id, palier, duree_mois, montant_fcfa, provider, checkout_url, created_at')
    .eq('entreprise_id', entrepriseId)
    .eq('statut', 'en_attente')
    .is('abandonne_le', null)
    .maybeSingle()
  if (!enCours) return null

  const memeOffre =
    enCours.palier === offre.palier &&
    enCours.duree_mois === offre.dureeMois &&
    Number(enCours.montant_fcfa) === offre.montantFcfa &&
    enCours.provider === offre.provider
  if (memeOffre && enCours.checkout_url && estRecent(enCours.created_at)) {
    return { success: true, checkoutUrl: enCours.checkout_url }
  }

  await supabase.from('abonnements').update({ abandonne_le: new Date().toISOString() }).eq('id', enCours.id)
  return null
}

export type StatutVerification = { statut: 'paye' | 'en_attente' | 'echoue'; error?: string }

// Poll depuis /abonnement/retour après un redirect Chariow/Moneroo/Bictorys —
// ne conclut JAMAIS depuis les seuls paramètres d'URL (cf. Chariow.md §8) :
// on redemande l'état réel, avec re-pull provider quand c'est possible.
export async function verifierPaiementAbonnement(abonnementId: string): Promise<StatutVerification> {
  const context = await getCurrentUserContext()

  const supabase = createAdminClient()
  const { data: ligne } = await supabase.from('abonnements').select('id, entreprise_id, statut, provider').eq('id', abonnementId).maybeSingle()
  if (!ligne || ligne.entreprise_id !== context.entrepriseId) return { statut: 'echoue', error: 'Abonnement introuvable' }
  if (ligne.statut !== 'en_attente') return { statut: ligne.statut }

  // Bictorys ne peut pas être re-vérifié depuis le serveur (WAF) : on attend
  // le webhook ou le cron, on se contente de relire l'état actuel en base.
  if (ligne.provider !== 'bictorys') {
    await reconcilierParAbonnementId(abonnementId)
  }

  const { data: relu } = await supabase.from('abonnements').select('statut').eq('id', abonnementId).single()
  return { statut: relu?.statut ?? 'en_attente' }
}
