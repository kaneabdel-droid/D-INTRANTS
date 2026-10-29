'use server'

import { revalidatePath } from 'next/cache'
import { getCurrentUserContext } from '@/lib/auth/getCurrentUserContext'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { estPalierValide, estDureeValide, calculerMontantFcfa, calculerMontantUsd, equivalentFcfa } from '@/lib/abonnements/paliers'
import { adaptateurPour, providerActif } from '@/lib/abonnements/registry'
import { estMoyenPaiementManuel, type MoyenPaiementManuel, type ProviderId } from '@/lib/abonnements/types'
import { PAYS_TELEPHONE_SUPPORTES } from '@/lib/abonnements/telephone'
import { paieEnDollars } from '@/lib/pays'
import { reconcilierParAbonnementId } from '@/lib/abonnements/reconcile'
import { estRecent, refusRenouvellementAnticipe } from '@/lib/abonnements/antiDoublon'

export type ResultatDemarrage =
  | { success: true; checkoutUrl: string }
  | { success: true; modeManuel: MoyenPaiementManuel; abonnementId: string }
  | { error: string }

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

  const manuel = estMoyenPaiementManuel(moyenPaiement)
  if (!manuel && !telephoneLocal.trim()) return { error: 'Le numéro de téléphone est requis' }
  if (!PAYS_TELEPHONE_SUPPORTES.includes(telephonePays)) return { error: 'Pays invalide' }

  const palier = palierBrut
  const dureeMois = dureeMoisBrut
  const enDollars = paieEnDollars(telephonePays)
  const montantUsd = enDollars ? calculerMontantUsd(palier, dureeMois) : undefined
  const montantFcfa = montantUsd ? equivalentFcfa(montantUsd) : calculerMontantFcfa(palier, dureeMois)
  const providerOnline: ProviderId = enDollars
    ? 'moneroo'
    : moyenPaiement === 'chariow' || moyenPaiement === 'maketou'
      ? moyenPaiement
      : providerActif()
  const provider = manuel ? moyenPaiement : providerOnline

  const supabaseSession = await createClient()
  const { data: { user } } = await supabaseSession.auth.getUser()
  if (!user?.email) return { error: 'Session invalide' }

  const { data: profil } = await supabaseSession.from('utilisateurs').select('nom, prenom').eq('id', user.id).single()

  const supabase = createAdminClient()

  const { data: entreprise } = await supabase
    .from('entreprises')
    .select('palier, abonnement_expire_le')
    .eq('id', context.entrepriseId)
    .single()
  const refus = refusRenouvellementAnticipe(entreprise?.palier, entreprise?.abonnement_expire_le, palier)
  if (refus) return { error: refus }

  const offre = { palier, dureeMois, montantFcfa, provider }
  const reutilisable = await paiementEnCoursReutilisable(context.entrepriseId, offre)
  if (reutilisable) return reutilisable

  const metadataManuel = manuel
    ? {
        moyenPaiementReel: moyenPaiement,
        contactEmail: user.email,
        contactTelephone: telephoneLocal.trim() || null,
      }
    : null

  let insertRes = await supabase
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
      metadata: metadataManuel,
    })
    .select('id')
    .single()

  if (manuel && insertRes.error && (insertRes.error.code === '23514' || insertRes.error.message.includes('abonnements_provider_check'))) {
    insertRes = await supabase
      .from('abonnements')
      .insert({
        entreprise_id: context.entrepriseId,
        palier,
        duree_mois: dureeMois,
        montant_fcfa: montantFcfa,
        devise: enDollars ? 'USD' : 'XOF',
        montant_devise: montantUsd ?? montantFcfa,
        provider: 'chariow',
        statut: 'en_attente',
        metadata: metadataManuel,
      })
      .select('id')
      .single()
  }

  const { data: abonnement, error: insertError } = insertRes

  if (insertError || !abonnement) {
    if (insertError?.code === '23505') {
      const concurrent = await paiementEnCoursReutilisable(context.entrepriseId, offre)
      if (concurrent) return concurrent
      return { error: 'Un paiement est déjà en cours. Patientez quelques secondes puis réessayez.' }
    }
    return { error: insertError?.message || "Impossible de créer l'abonnement" }
  }

  if (manuel) {
    revalidatePath('/abonnement')
    return { success: true, modeManuel: moyenPaiement, abonnementId: abonnement.id }
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
  const resultat = await adaptateurPour(providerOnline).initierPaiement({
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

async function paiementEnCoursReutilisable(entrepriseId: string, offre: Offre): Promise<ResultatDemarrage | null> {
  const supabase = createAdminClient()
  const { data: enCours } = await supabase
    .from('abonnements')
    .select('id, palier, duree_mois, montant_fcfa, provider, checkout_url, created_at, metadata')
    .eq('entreprise_id', entrepriseId)
    .eq('statut', 'en_attente')
    .is('abandonne_le', null)
    .maybeSingle()
  if (!enCours) return null

  const providerEnCours = ((enCours.metadata as Record<string, any> | null)?.moyenPaiementReel as string | undefined) || enCours.provider
  const memeOffre =
    enCours.palier === offre.palier &&
    enCours.duree_mois === offre.dureeMois &&
    Number(enCours.montant_fcfa) === offre.montantFcfa &&
    providerEnCours === offre.provider

  if (memeOffre && estMoyenPaiementManuel(offre.provider)) {
    return { success: true, modeManuel: offre.provider, abonnementId: enCours.id }
  }
  if (memeOffre && enCours.checkout_url && estRecent(enCours.created_at)) {
    return { success: true, checkoutUrl: enCours.checkout_url }
  }

  await supabase.from('abonnements').update({ abandonne_le: new Date().toISOString() }).eq('id', enCours.id)
  return null
}

export type StatutVerification = { statut: 'paye' | 'en_attente' | 'echoue'; error?: string }

export async function verifierPaiementAbonnement(abonnementId: string): Promise<StatutVerification> {
  const context = await getCurrentUserContext()

  const supabase = createAdminClient()
  const { data: ligne } = await supabase.from('abonnements').select('id, entreprise_id, statut, provider, metadata').eq('id', abonnementId).maybeSingle()
  if (!ligne || ligne.entreprise_id !== context.entrepriseId) return { statut: 'echoue', error: 'Abonnement introuvable' }
  if (ligne.statut !== 'en_attente') return { statut: ligne.statut }

  const moyenEffectif = ((ligne.metadata as Record<string, any> | null)?.moyenPaiementReel as string | undefined) || ligne.provider
  if (ligne.provider !== 'bictorys' && !estMoyenPaiementManuel(moyenEffectif)) {
    await reconcilierParAbonnementId(abonnementId)
  }

  const { data: relu } = await supabase.from('abonnements').select('statut').eq('id', abonnementId).single()
  return { statut: relu?.statut ?? 'en_attente' }
}
