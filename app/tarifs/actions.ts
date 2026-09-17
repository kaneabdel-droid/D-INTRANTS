'use server'

import { createAdminClient } from '@/utils/supabase/admin'
import { estPalierValide, estDureeValide, calculerMontantFcfa } from '@/lib/abonnements/paliers'
import { adaptateurActif, providerActif } from '@/lib/abonnements/registry'
import { reconcilierParAbonnementId } from '@/lib/abonnements/reconcile'

type ResultatDemarrage = { success: true; checkoutUrl: string } | { error: string }

// Paiement public, sans compte préalable (visiteur anonyme sur /tarifs) — cf.
// plan §0 : le paiement crée une DEMANDE (ligne `abonnements` à entreprise_id
// null), pas un compte. L'admin système crée l'entreprise manuellement depuis
// /admin/demandes une fois le paiement confirmé — aucune policy RLS nouvelle,
// aucune auto-inscription : seule la étape « admin crée le compte » change de
// déclencheur (une demande payée plutôt qu'une demande manuelle).
export async function demarrerInscription(
  nomEntreprise: string,
  contactNom: string,
  email: string,
  telephoneLocal: string,
  telephonePays: string,
  palierBrut: string,
  dureeMoisBrut: number
): Promise<ResultatDemarrage> {
  if (!nomEntreprise.trim()) return { error: "Le nom de l'entreprise est requis" }
  if (!contactNom.trim()) return { error: 'Le nom du contact est requis' }
  if (!email.trim()) return { error: 'Une adresse e-mail est requise' }
  if (!telephoneLocal.trim()) return { error: 'Le numéro de téléphone est requis' }
  if (!estPalierValide(palierBrut)) return { error: 'Palier invalide' }
  if (!estDureeValide(dureeMoisBrut)) return { error: 'Durée invalide' }

  const palier = palierBrut
  const dureeMois = dureeMoisBrut
  const montantFcfa = calculerMontantFcfa(palier, dureeMois)

  const supabase = createAdminClient()

  const { data: abonnement, error: insertError } = await supabase
    .from('abonnements')
    .insert({
      entreprise_id: null,
      palier,
      duree_mois: dureeMois,
      montant_fcfa: montantFcfa,
      provider: providerActif(),
      statut: 'en_attente',
      metadata: {
        demandePublique: true,
        nomEntreprise: nomEntreprise.trim(),
        contactNom: contactNom.trim(),
        contactEmail: email.trim(),
        contactTelephone: telephoneLocal.trim(),
      },
    })
    .select('id')
    .single()

  if (insertError || !abonnement) return { error: insertError?.message || 'Impossible de créer la demande' }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
  const resultat = await adaptateurActif().initierPaiement({
    abonnementId: abonnement.id,
    palier,
    dureeMois,
    montantFcfa,
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
      metadata: {
        demandePublique: true,
        nomEntreprise: nomEntreprise.trim(),
        contactNom: contactNom.trim(),
        contactEmail: email.trim(),
        contactTelephone: telephoneLocal.trim(),
        ...(resultat.montantFacture ? { montantFacture: resultat.montantFacture, deviseFacturee: resultat.deviseFacturee } : {}),
      },
    })
    .eq('id', abonnement.id)

  return { success: true, checkoutUrl: resultat.checkoutUrl }
}

export type StatutVerificationPublic = { statut: 'paye' | 'en_attente' | 'echoue'; error?: string }

// Miroir de verifierPaiementAbonnement (app/(dashboard)/abonnement/actions.ts)
// pour un visiteur anonyme : pas de getCurrentUserContext() possible ici, donc
// le contrôle d'accès devient "cette ligne est bien une demande publique"
// (entreprise_id null) plutôt que "cette ligne appartient à mon entreprise" —
// une fois qu'une demande est traitée (entreprise_id renseigné), cette
// fonction ne doit plus jamais exposer son état à qui a juste l'id en URL.
export async function verifierDemandePublique(abonnementId: string): Promise<StatutVerificationPublic> {
  const supabase = createAdminClient()
  const { data: ligne } = await supabase.from('abonnements').select('id, entreprise_id, statut, provider').eq('id', abonnementId).maybeSingle()
  if (!ligne || ligne.entreprise_id !== null) return { statut: 'echoue', error: 'Demande introuvable' }
  if (ligne.statut !== 'en_attente') return { statut: ligne.statut }

  if (ligne.provider !== 'bictorys') {
    await reconcilierParAbonnementId(abonnementId)
  }

  const { data: relu } = await supabase.from('abonnements').select('statut').eq('id', abonnementId).single()
  return { statut: relu?.statut ?? 'en_attente' }
}
