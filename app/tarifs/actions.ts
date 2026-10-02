'use server'

import { createAdminClient } from '@/utils/supabase/admin'
import { estPalierValide, estDureeValide, calculerMontantFcfa, calculerMontantUsd, equivalentFcfa } from '@/lib/abonnements/paliers'
import { adaptateurPour, providerActif } from '@/lib/abonnements/registry'
import { PAYS_TELEPHONE_SUPPORTES } from '@/lib/abonnements/telephone'
import { nomPays, paieEnDollars } from '@/lib/pays'
import { reconcilierParAbonnementId } from '@/lib/abonnements/reconcile'
import { estRecent } from '@/lib/abonnements/antiDoublon'

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
  dureeMoisBrut: number,
  nomPaysAutre = ''
): Promise<ResultatDemarrage> {
  if (!nomEntreprise.trim()) return { error: "Le nom de l'entreprise est requis" }
  if (!contactNom.trim()) return { error: 'Le nom du contact est requis' }
  if (!email.trim()) return { error: 'Une adresse e-mail est requise' }
  if (!telephoneLocal.trim()) return { error: 'Le numéro de téléphone est requis' }
  if (!PAYS_TELEPHONE_SUPPORTES.includes(telephonePays)) return { error: 'Pays invalide' }
  // « Autre pays » : paiement en dollars US par carte (Moneroo), quel que soit le prestataire actif.
  const enDollars = paieEnDollars(telephonePays)
  if (enDollars && !nomPaysAutre.trim()) return { error: 'Indiquez le nom de votre pays' }
  if (!estPalierValide(palierBrut)) return { error: 'Palier invalide' }
  if (!estDureeValide(dureeMoisBrut)) return { error: 'Durée invalide' }

  const palier = palierBrut
  const dureeMois = dureeMoisBrut
  const montantUsd = enDollars ? calculerMontantUsd(palier, dureeMois) : undefined
  const montantFcfa = montantUsd ? equivalentFcfa(montantUsd) : calculerMontantFcfa(palier, dureeMois)
  const provider = enDollars ? 'moneroo' : providerActif()
  const pays = { pays: telephonePays, paysNom: nomPays(telephonePays, nomPaysAutre) }

  const supabase = createAdminClient()
  const emailNormalise = email.trim().toLowerCase()

  // Anti double paiement : une demande publique n'a pas encore d'entreprise, le
  // dédoublonnage se fait donc sur l'e-mail du contact.
  const { data: demandes } = await supabase
    .from('abonnements')
    .select('id, palier, duree_mois, montant_fcfa, provider, statut, checkout_url, created_at, abandonne_le')
    .is('entreprise_id', null)
    .in('statut', ['en_attente', 'paye'])
    .ilike('metadata->>contactEmail', emailNormalise.replace(/[\\%_]/g, (c) => `\\${c}`)) // insensible à la casse, jokers LIKE échappés
    .order('created_at', { ascending: false })
    .limit(10)

  // (1/2) Déjà payée et pas encore transformée en compte : l'équipe doit simplement la traiter.
  if ((demandes ?? []).some((d) => d.statut === 'paye')) {
    return { error: 'Une demande payée existe déjà pour cette adresse e-mail : notre équipe vous contacte pour créer votre compte. Aucun nouveau paiement n’est nécessaire.' }
  }

  // (2/2) Même offre relancée récemment → même page de paiement (double clic, second onglet...).
  const enCours = (demandes ?? []).find(
    (d) =>
      d.statut === 'en_attente' &&
      !d.abandonne_le &&
      d.palier === palier &&
      d.duree_mois === dureeMois &&
      Number(d.montant_fcfa) === montantFcfa &&
      d.provider === provider &&
      d.checkout_url &&
      estRecent(d.created_at)
  )
  if (enCours?.checkout_url) return { success: true, checkoutUrl: enCours.checkout_url }

  const { data: abonnement, error: insertError } = await supabase
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
      metadata: {
        demandePublique: true,
        nomEntreprise: nomEntreprise.trim(),
        contactNom: contactNom.trim(),
        contactEmail: emailNormalise,
        contactTelephone: telephoneLocal.trim(),
        ...pays,
      },
    })
    .select('id')
    .single()

  if (insertError || !abonnement) return { error: insertError?.message || 'Impossible de créer la demande' }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
  const resultat = await adaptateurPour(provider).initierPaiement({
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
        demandePublique: true,
        nomEntreprise: nomEntreprise.trim(),
        contactNom: contactNom.trim(),
        contactEmail: emailNormalise,
        contactTelephone: telephoneLocal.trim(),
        ...pays,
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
