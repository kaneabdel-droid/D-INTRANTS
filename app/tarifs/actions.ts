'use server'

import { createAdminClient } from '@/utils/supabase/admin'
import { estPalierValide, estDureeValide, calculerMontantFcfa, calculerMontantUsd, equivalentFcfa } from '@/lib/abonnements/paliers'
import { adaptateurPour, providerActif } from '@/lib/abonnements/registry'
import { estMoyenPaiementManuel, type MoyenPaiementManuel, type ProviderId } from '@/lib/abonnements/types'
import { PAYS_TELEPHONE_SUPPORTES } from '@/lib/abonnements/telephone'
import { nomPays, paieEnDollars } from '@/lib/pays'
import { reconcilierParAbonnementId } from '@/lib/abonnements/reconcile'
import { estRecent } from '@/lib/abonnements/antiDoublon'

export type ResultatDemarrage =
  | { success: true; checkoutUrl: string }
  | { success: true; modeManuel: MoyenPaiementManuel; abonnementId: string }
  | { error: string }

export async function demarrerInscription(
  nomEntreprise: string,
  contactNom: string,
  email: string,
  telephoneLocal: string,
  telephonePays: string,
  palierBrut: string,
  dureeMoisBrut: number,
  nomPaysAutre = '',
  moyenPaiement: string = 'maketou'
): Promise<ResultatDemarrage> {
  if (!nomEntreprise.trim()) return { error: "Le nom de l'entreprise est requis" }
  if (!contactNom.trim()) return { error: 'Le nom du contact est requis' }
  if (!email.trim()) return { error: 'Une adresse e-mail est requise' }
  if (!telephoneLocal.trim()) return { error: 'Le numéro de téléphone est requis' }
  if (!PAYS_TELEPHONE_SUPPORTES.includes(telephonePays)) return { error: 'Pays invalide' }
  const enDollars = paieEnDollars(telephonePays)
  if (enDollars && !nomPaysAutre.trim()) return { error: 'Indiquez le nom de votre pays' }
  if (!estPalierValide(palierBrut)) return { error: 'Palier invalide' }
  if (!estDureeValide(dureeMoisBrut)) return { error: 'Durée invalide' }

  const palier = palierBrut
  const dureeMois = dureeMoisBrut
  const providerManuel: MoyenPaiementManuel | null = !enDollars && estMoyenPaiementManuel(moyenPaiement) ? moyenPaiement : null
  const manuel = providerManuel !== null
  const montantUsd = enDollars ? calculerMontantUsd(palier, dureeMois) : undefined
  const montantFcfa = montantUsd ? equivalentFcfa(montantUsd) : calculerMontantFcfa(palier, dureeMois)
  const providerOnline: ProviderId = enDollars
    ? 'moneroo'
    : moyenPaiement === 'chariow' || moyenPaiement === 'maketou'
      ? moyenPaiement
      : providerActif()
  const provider = providerManuel ?? providerOnline
  const pays = { pays: telephonePays, paysNom: nomPays(telephonePays, nomPaysAutre) }

  const supabase = createAdminClient()
  const emailNormalise = email.trim().toLowerCase()

  const { data: demandes } = await supabase
    .from('abonnements')
    .select('id, palier, duree_mois, montant_fcfa, provider, statut, checkout_url, created_at, abandonne_le, metadata')
    .is('entreprise_id', null)
    .in('statut', ['en_attente', 'paye'])
    .ilike('metadata->>contactEmail', emailNormalise.replace(/[\\%_]/g, (c) => `\\${c}`))
    .order('created_at', { ascending: false })
    .limit(10)

  if ((demandes ?? []).some((d) => d.statut === 'paye')) {
    return { error: 'Une demande payée existe déjà pour cette adresse e-mail : notre équipe vous contacte pour créer votre compte. Aucun nouveau paiement n’est nécessaire.' }
  }

  const enCours = (demandes ?? []).find((d) => {
    const providerDemande = ((d.metadata as Record<string, any> | null)?.moyenPaiementReel as string | undefined) || d.provider
    return (
      d.statut === 'en_attente' &&
      !d.abandonne_le &&
      d.palier === palier &&
      d.duree_mois === dureeMois &&
      Number(d.montant_fcfa) === montantFcfa &&
      providerDemande === provider
    )
  })
  if (enCours) {
    if (providerManuel) return { success: true, modeManuel: providerManuel, abonnementId: enCours.id }
    if (enCours.checkout_url && estRecent(enCours.created_at)) return { success: true, checkoutUrl: enCours.checkout_url }
  }

  const metadataBase = {
    demandePublique: true,
    nomEntreprise: nomEntreprise.trim(),
    contactNom: contactNom.trim(),
    contactEmail: emailNormalise,
    contactTelephone: telephoneLocal.trim(),
    ...(manuel ? { moyenPaiementReel: provider } : {}),
    ...pays,
  }

  let insertRes = await supabase
    .from('abonnements')
    .insert({
      entreprise_id: null,
      palier,
      duree_mois: dureeMois,
      montant_fcfa: montantFcfa,
      devise: enDollars ? 'USD' : 'XOF',
      montant_devise: montantUsd ?? montantFcfa,
      provider,
      statut: 'en_attente',
      metadata: metadataBase,
    })
    .select('id')
    .single()

  if (manuel && insertRes.error && (insertRes.error.code === '23514' || insertRes.error.message.includes('abonnements_provider_check'))) {
    insertRes = await supabase
      .from('abonnements')
      .insert({
        entreprise_id: null,
        palier,
        duree_mois: dureeMois,
        montant_fcfa: montantFcfa,
        devise: enDollars ? 'USD' : 'XOF',
        montant_devise: montantUsd ?? montantFcfa,
        provider: 'chariow',
        statut: 'en_attente',
        metadata: metadataBase,
      })
      .select('id')
      .single()
  }

  const { data: abonnement, error: insertError } = insertRes
  if (insertError || !abonnement) return { error: insertError?.message || 'Impossible de créer la demande' }

  if (providerManuel) {
    return { success: true, modeManuel: providerManuel, abonnementId: abonnement.id }
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
  const resultat = await adaptateurPour(providerOnline).initierPaiement({
    abonnementId: abonnement.id,
    palier,
    dureeMois,
    montantFcfa,
    montantUsd,
    emailClient: email.trim(),
    prenomClient: contactNom.trim(),
    nomClient: '',
    telephoneLocal,
    telephonePays,
    retourUrl: `${siteUrl}/tarifs/retour?id=${abonnement.id}`,
    nomEntreprise: nomEntreprise.trim(),
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
      metadata: {
        ...metadataBase,
        ...(resultat.montantFacture ? { montantFacture: resultat.montantFacture, deviseFacturee: resultat.deviseFacturee } : {}),
      },
    })
    .eq('id', abonnement.id)

  return { success: true, checkoutUrl: resultat.checkoutUrl }
}

export type StatutVerificationPublic = { statut: 'paye' | 'en_attente' | 'echoue'; error?: string }

export async function verifierDemandePublique(abonnementId: string): Promise<StatutVerificationPublic> {
  const supabase = createAdminClient()
  const { data: ligne } = await supabase.from('abonnements').select('id, entreprise_id, statut, provider, metadata').eq('id', abonnementId).maybeSingle()
  if (!ligne || ligne.entreprise_id !== null) return { statut: 'echoue', error: 'Demande introuvable' }
  if (ligne.statut !== 'en_attente') return { statut: ligne.statut }

  const moyenEffectif = ((ligne.metadata as Record<string, any> | null)?.moyenPaiementReel as string | undefined) || ligne.provider
  if (ligne.provider !== 'bictorys' && !estMoyenPaiementManuel(moyenEffectif)) {
    await reconcilierParAbonnementId(abonnementId)
  }

  const { data: relu } = await supabase.from('abonnements').select('statut').eq('id', abonnementId).single()
  return { statut: relu?.statut ?? 'en_attente' }
}
