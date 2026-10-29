'use server'

import { revalidatePath } from 'next/cache'
import crypto from 'node:crypto'
import { createClient } from '@/utils/supabase/server'
import { requireGerantOuTresorier } from '@/lib/auth/getCurrentUserContext'

type ActionResult = { success?: true; error?: string }

export async function addCompteTresorerie(formData: FormData): Promise<ActionResult> {
  const context = await requireGerantOuTresorier('/tresorerie', 'ecrire')
  const supabase = await createClient()

  const nom = (formData.get('nom') as string)?.trim()
  const typeCompte = formData.get('type_compte') as string
  const soldeInitial = parseFloat(formData.get('solde_initial') as string) || 0

  if (!nom) return { error: 'Le nom est requis' }

  const { error } = await supabase.from('comptes_tresorerie').insert({
    magasin_id: context.magasinId,
    nom,
    type_compte: typeCompte,
    solde_initial: soldeInitial,
  })
  if (error) return { error: error.message }

  revalidatePath('/tresorerie')
  return { success: true }
}

// « Autres produits » est toujours une entrée, « Autres charges » et « Virement »
// (sur le compte source) sont une sortie : le sens est imposé côté serveur.
function sensImpose(categorie: string, sens: string): string {
  if (categorie === 'autres_produits') return 'entree'
  if (categorie === 'autres_charges') return 'sortie'
  if (categorie === 'virement') return 'sortie'
  return sens
}

// Écriture manuelle : virement entre comptes (double écriture équilibrée : sortie
// sur le compte source + entrée automatique sur le compte de destination) ou
// mouvement "autre" non couvert par les RPC dédiées.
export async function addEcritureTresorerie(formData: FormData): Promise<ActionResult> {
  const context = await requireGerantOuTresorier('/tresorerie', 'ecrire')
  const supabase = await createClient()

  const compteId = formData.get('compte_tresorerie_id') as string
  const compteDestinationId = ((formData.get('compte_destination_id') as string) || '').trim()
  const typeMouvement = formData.get('type_mouvement') as string
  const montant = parseFloat(formData.get('montant') as string) || 0
  const categorie = (formData.get('categorie') as string) || 'autre'
  const motif = (formData.get('motif') as string)?.trim() || null

  if (!compteId) return { error: 'Un compte est requis' }
  if (montant <= 0) return { error: 'Le montant doit être positif' }

  if (categorie === 'virement') {
    if (!compteDestinationId) return { error: 'Veuillez sélectionner le compte de destination du virement' }
    if (compteDestinationId === compteId) {
      return { error: 'Le compte de destination doit être différent du compte source' }
    }

    const { data: comptesVirement } = await supabase
      .from('comptes_tresorerie')
      .select('id, nom')
      .eq('magasin_id', context.magasinId)
      .in('id', [compteId, compteDestinationId])

    const compteSource = comptesVirement?.find((c) => c.id === compteId)
    const compteDest = comptesVirement?.find((c) => c.id === compteDestinationId)
    if (!compteSource || !compteDest) {
      return { error: 'Compte source ou compte de destination introuvable dans ce magasin' }
    }

    const detail = motif ? ` (${motif})` : ''
    const motifSortie = `Virement vers ${compteDest.nom}${detail}`
    const motifEntree = `Virement reçu de ${compteSource.nom}${detail}`

    // 1. Débit du compte source (vérifie d'abord le solde via le trigger trg_verifier_solde_compte)
    const { data: ecritureSortie, error: errSortie } = await supabase
      .from('journal_tresorerie')
      .insert({
        magasin_id: context.magasinId,
        compte_tresorerie_id: compteId,
        type_mouvement: 'sortie',
        montant,
        categorie: 'virement',
        motif: motifSortie,
        utilisateur_id: context.userId,
      })
      .select('id')
      .single()

    if (errSortie || !ecritureSortie) {
      return { error: errSortie?.message ?? 'Erreur lors du débit du compte source' }
    }

    // 2. Crédit automatique du compte de destination, lié à la sortie via reference_id (reference_type reste null)
    const { data: ecritureEntree, error: errEntree } = await supabase
      .from('journal_tresorerie')
      .insert({
        magasin_id: context.magasinId,
        compte_tresorerie_id: compteDestinationId,
        type_mouvement: 'entree',
        montant,
        categorie: 'virement',
        motif: motifEntree,
        reference_id: ecritureSortie.id,
        utilisateur_id: context.userId,
      })
      .select('id')
      .single()

    if (errEntree || !ecritureEntree) {
      await supabase.from('journal_tresorerie').delete().eq('id', ecritureSortie.id).is('reference_type', null)
      return { error: errEntree?.message ?? 'Erreur lors du crédit du compte de destination' }
    }

    await supabase
      .from('journal_tresorerie')
      .update({ reference_id: ecritureEntree.id })
      .eq('id', ecritureSortie.id)
      .is('reference_type', null)

    revalidatePath('/tresorerie')
    return { success: true }
  }

  const { error } = await supabase.from('journal_tresorerie').insert({
    magasin_id: context.magasinId,
    compte_tresorerie_id: compteId,
    type_mouvement: sensImpose(categorie, typeMouvement),
    montant,
    categorie,
    motif,
    utilisateur_id: context.userId,
  })
  if (error) return { error: error.message }

  revalidatePath('/tresorerie')
  return { success: true }
}

// Modification/suppression réservées aux écritures manuelles (reference_type
// null) : une écriture générée par une vente/un achat/une charge/un règlement
// ne doit être corrigée qu'en annulant son origine (annulerVente/annulerAchat/
// deleteCharge/...), jamais en la modifiant isolément — sinon le montant de
// l'écriture divergerait silencieusement du document qui l'a produite.
export async function updateEcritureTresorerie(
  id: string,
  compteId: string,
  typeMouvement: string,
  montant: number,
  categorie: string,
  motif: string,
  compteDestinationId?: string
): Promise<ActionResult> {
  const context = await requireGerantOuTresorier('/tresorerie', 'modifier')
  const supabase = await createClient()

  if (!compteId) return { error: 'Un compte est requis' }
  if (montant <= 0) return { error: 'Le montant doit être positif' }

  const { data: existante } = await supabase
    .from('journal_tresorerie')
    .select('id, compte_tresorerie_id, type_mouvement, categorie, reference_id, reference_type')
    .eq('id', id)
    .single()
  if (existante?.reference_type) {
    return { error: 'Cette écriture est liée à une vente, un achat, une charge ou un règlement — modifiez-la depuis son origine.' }
  }

  const destId = (compteDestinationId || '').trim()

  if (categorie === 'virement') {
    // Cas 1 : l'écriture faisait déjà partie d'un virement équilibré (reference_id présent)
    if (existante?.categorie === 'virement' && existante.reference_id) {
      const { data: contrepartie } = await supabase
        .from('journal_tresorerie')
        .select('id, compte_tresorerie_id, type_mouvement')
        .eq('id', existante.reference_id)
        .is('reference_type', null)
        .maybeSingle()

      const autreCompteId = destId || contrepartie?.compte_tresorerie_id || ''
      if (!autreCompteId || autreCompteId === compteId) {
        return { error: 'Le compte de destination doit être différent du compte source' }
      }

      const estSortie = existante.type_mouvement === 'sortie'
      const sourceId = estSortie ? compteId : autreCompteId
      const cibleId = estSortie ? autreCompteId : compteId

      const { data: comptesVirement } = await supabase
        .from('comptes_tresorerie')
        .select('id, nom')
        .eq('magasin_id', context.magasinId)
        .in('id', [sourceId, cibleId])
      const nomSource = comptesVirement?.find((c) => c.id === sourceId)?.nom ?? 'Compte source'
      const nomCible = comptesVirement?.find((c) => c.id === cibleId)?.nom ?? 'Compte destination'

      const motifNettoye = motif
        .replace(/^Virement (vers|reçu de) [^()]+(\((.*)\))?$/i, '$3')
        .trim()
      const detail = motifNettoye ? ` (${motifNettoye})` : ''
      const motifSortie = `Virement vers ${nomCible}${detail}`
      const motifEntree = `Virement reçu de ${nomSource}${detail}`

      const { error: err1 } = await supabase
        .from('journal_tresorerie')
        .update({
          compte_tresorerie_id: compteId,
          montant,
          categorie: 'virement',
          motif: estSortie ? motifSortie : motifEntree,
        })
        .eq('id', id)
        .is('reference_type', null)
      if (err1) return { error: err1.message }

      if (contrepartie) {
        const { error: err2 } = await supabase
          .from('journal_tresorerie')
          .update({
            compte_tresorerie_id: autreCompteId,
            montant,
            categorie: 'virement',
            motif: estSortie ? motifEntree : motifSortie,
          })
          .eq('id', contrepartie.id)
          .is('reference_type', null)
        if (err2) return { error: err2.message }
      }

      revalidatePath('/tresorerie')
      return { success: true }
    }

    // Cas 2 : transformation d'une écriture simple en virement équilibré
    if (!destId) return { error: 'Veuillez sélectionner le compte de destination du virement' }
    if (destId === compteId) return { error: 'Le compte de destination doit être différent du compte source' }

    const { data: comptesVirement } = await supabase
      .from('comptes_tresorerie')
      .select('id, nom')
      .eq('magasin_id', context.magasinId)
      .in('id', [compteId, destId])
    const compteSource = comptesVirement?.find((c) => c.id === compteId)
    const compteDest = comptesVirement?.find((c) => c.id === destId)
    if (!compteSource || !compteDest) {
      return { error: 'Compte source ou compte de destination introuvable' }
    }

    const detail = motif.trim() ? ` (${motif.trim()})` : ''
    const motifSortie = `Virement vers ${compteDest.nom}${detail}`
    const motifEntree = `Virement reçu de ${compteSource.nom}${detail}`

    const { data: ecritureEntree, error: errEntree } = await supabase
      .from('journal_tresorerie')
      .insert({
        magasin_id: context.magasinId,
        compte_tresorerie_id: destId,
        type_mouvement: 'entree',
        montant,
        categorie: 'virement',
        motif: motifEntree,
        reference_id: id,
        utilisateur_id: context.userId,
      })
      .select('id')
      .single()
    if (errEntree || !ecritureEntree) return { error: errEntree?.message ?? 'Erreur lors de la création de la contrepartie' }

    const { error: errMaj } = await supabase
      .from('journal_tresorerie')
      .update({
        compte_tresorerie_id: compteId,
        type_mouvement: 'sortie',
        montant,
        categorie: 'virement',
        motif: motifSortie,
        reference_id: ecritureEntree.id,
      })
      .eq('id', id)
      .is('reference_type', null)
    if (errMaj) return { error: errMaj.message }

    revalidatePath('/tresorerie')
    return { success: true }
  }

  // Si l'écriture était un virement et passe à une autre catégorie, on supprime la contrepartie liée
  if (existante?.categorie === 'virement' && existante.reference_id) {
    await supabase.from('journal_tresorerie').delete().eq('id', existante.reference_id).is('reference_type', null)
  }

  const { error } = await supabase
    .from('journal_tresorerie')
    .update({
      compte_tresorerie_id: compteId,
      type_mouvement: sensImpose(categorie, typeMouvement),
      montant,
      categorie,
      motif: motif.trim() || null,
      reference_id: null,
    })
    .eq('id', id)
    .is('reference_type', null)
  if (error) return { error: error.message }

  revalidatePath('/tresorerie')
  return { success: true }
}

export async function deleteEcritureTresorerie(id: string): Promise<ActionResult> {
  await requireGerantOuTresorier('/tresorerie', 'modifier')
  const supabase = await createClient()

  const { data: existante } = await supabase
    .from('journal_tresorerie')
    .select('categorie, reference_id, reference_type')
    .eq('id', id)
    .single()
  if (existante?.reference_type) {
    return { error: 'Cette écriture est liée à une vente, un achat, une charge ou un règlement — supprimez-la depuis son origine.' }
  }

  const { error } = await supabase.from('journal_tresorerie').delete().eq('id', id).is('reference_type', null)
  if (error) return { error: error.message }

  if (existante?.categorie === 'virement' && existante.reference_id) {
    await supabase.from('journal_tresorerie').delete().eq('id', existante.reference_id).is('reference_type', null)
  }

  revalidatePath('/tresorerie')
  return { success: true }
}

// Encaissement automatique par monnaie électronique : le fournisseur/relais
// choisi et le numéro marchand ne sont qu'un pense-bête affiché au gérant —
// seule la clé de webhook (générée à part, cf. genererCleWebhookMobileMoney)
// authentifie réellement les appels entrants.
export async function configurerWebhookMobileMoney(formData: FormData): Promise<ActionResult> {
  const context = await requireGerantOuTresorier('/tresorerie', 'ecrire')
  const supabase = await createClient()

  const compteId = formData.get('compte_tresorerie_id') as string
  const fournisseur = (formData.get('fournisseur_electronique') as string) || null
  const identifiantMarchand = (formData.get('identifiant_marchand') as string)?.trim() || null

  if (!compteId) return { error: 'Un compte est requis' }
  if (fournisseur && !['wave', 'orange_money', 'generique'].includes(fournisseur)) {
    return { error: 'Fournisseur invalide' }
  }

  const { error } = await supabase
    .from('comptes_tresorerie')
    .update({ fournisseur_electronique: fournisseur, identifiant_marchand: identifiantMarchand })
    .eq('id', compteId)
    .eq('magasin_id', context.magasinId)
    .eq('type_compte', 'mobile_money')
  if (error) return { error: error.message }

  revalidatePath('/tresorerie')
  return { success: true }
}

// La clé n'est jamais générée côté client : un secret prévisible ou rejouable
// permettrait à quiconque le devine d'insérer de fausses écritures de
// trésorerie sur ce compte.
export async function genererCleWebhookMobileMoney(compteId: string): Promise<ActionResult & { cle?: string }> {
  const context = await requireGerantOuTresorier('/tresorerie', 'ecrire')
  const supabase = await createClient()

  if (!compteId) return { error: 'Un compte est requis' }

  const cle = crypto.randomBytes(24).toString('hex')
  const { error } = await supabase
    .from('comptes_tresorerie')
    .update({ cle_webhook: cle })
    .eq('id', compteId)
    .eq('magasin_id', context.magasinId)
    .eq('type_compte', 'mobile_money')
  if (error) return { error: error.message }

  revalidatePath('/tresorerie')
  return { success: true, cle }
}
