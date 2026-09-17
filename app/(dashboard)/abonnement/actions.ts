'use server'

import { getCurrentUserContext } from '@/lib/auth/getCurrentUserContext'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { estPalierValide, estDureeValide, calculerMontantFcfa } from '@/lib/abonnements/paliers'
import { adaptateurActif, providerActif } from '@/lib/abonnements/registry'
import { reconcilierParAbonnementId } from '@/lib/abonnements/reconcile'

type ResultatDemarrage = { success: true; checkoutUrl: string } | { error: string }

export async function demarrerPaiementAbonnement(
  palierBrut: string,
  dureeMoisBrut: number,
  telephonePays: string,
  telephoneLocal: string
): Promise<ResultatDemarrage> {
  const context = await getCurrentUserContext()
  if (context.role !== 'admin_entreprise') return { error: "Seul l'administrateur de l'entreprise peut gérer l'abonnement" }
  if (!estPalierValide(palierBrut)) return { error: 'Palier invalide' }
  if (!estDureeValide(dureeMoisBrut)) return { error: 'Durée invalide' }
  if (!telephoneLocal.trim()) return { error: 'Le numéro de téléphone est requis' }

  const palier = palierBrut
  const dureeMois = dureeMoisBrut
  const montantFcfa = calculerMontantFcfa(palier, dureeMois)

  const supabaseSession = await createClient()
  const { data: { user } } = await supabaseSession.auth.getUser()
  if (!user?.email) return { error: 'Session invalide' }

  const { data: profil } = await supabaseSession.from('utilisateurs').select('nom, prenom').eq('id', user.id).single()

  const supabase = createAdminClient()

  // Supersède toute tentative précédente encore en attente (pas d'empilement de
  // lignes si l'admin relance un paiement après avoir changé d'avis) — même
  // logique que supersedeOlderPending() dans Chariow.md §4.
  await supabase.from('abonnements').update({ statut: 'echoue' }).eq('entreprise_id', context.entrepriseId).eq('statut', 'en_attente')

  const { data: abonnement, error: insertError } = await supabase
    .from('abonnements')
    .insert({
      entreprise_id: context.entrepriseId,
      palier,
      duree_mois: dureeMois,
      montant_fcfa: montantFcfa,
      provider: providerActif(),
      statut: 'en_attente',
    })
    .select('id')
    .single()

  if (insertError || !abonnement) return { error: insertError?.message || "Impossible de créer l'abonnement" }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
  const resultat = await adaptateurActif().initierPaiement({
    abonnementId: abonnement.id,
    palier,
    dureeMois,
    montantFcfa,
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
      metadata: resultat.montantFacture ? { montantFacture: resultat.montantFacture, deviseFacturee: resultat.deviseFacturee } : null,
    })
    .eq('id', abonnement.id)

  return { success: true, checkoutUrl: resultat.checkoutUrl }
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
