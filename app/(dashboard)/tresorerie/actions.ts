'use server'

import { revalidatePath } from 'next/cache'
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

// « Autres produits » est toujours une entrée et « Autres charges » toujours une sortie :
// le sens est imposé ici, côté serveur, quel que soit ce que le formulaire envoie.
function sensImpose(categorie: string, sens: string): string {
  if (categorie === 'autres_produits') return 'entree'
  if (categorie === 'autres_charges') return 'sortie'
  return sens
}

// Écriture manuelle : virement entre comptes ou mouvement "autre" non couvert
// par les RPC dédiées (creer_vente/creer_achat/regler_creance/regler_dette
// écrivent déjà leur propre ligne de journal automatiquement).
export async function addEcritureTresorerie(formData: FormData): Promise<ActionResult> {
  const context = await requireGerantOuTresorier('/tresorerie', 'ecrire')
  const supabase = await createClient()

  const compteId = formData.get('compte_tresorerie_id') as string
  const typeMouvement = formData.get('type_mouvement') as string
  const montant = parseFloat(formData.get('montant') as string) || 0
  const categorie = (formData.get('categorie') as string) || 'autre'
  const motif = (formData.get('motif') as string)?.trim() || null

  if (!compteId) return { error: 'Un compte est requis' }
  if (montant <= 0) return { error: 'Le montant doit être positif' }

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
  motif: string
): Promise<ActionResult> {
  await requireGerantOuTresorier('/tresorerie', 'modifier')
  const supabase = await createClient()

  if (!compteId) return { error: 'Un compte est requis' }
  if (montant <= 0) return { error: 'Le montant doit être positif' }

  const { data: existante } = await supabase.from('journal_tresorerie').select('reference_type').eq('id', id).single()
  if (existante?.reference_type) {
    return { error: 'Cette écriture est liée à une vente, un achat, une charge ou un règlement — modifiez-la depuis son origine.' }
  }

  const { error } = await supabase
    .from('journal_tresorerie')
    .update({ compte_tresorerie_id: compteId, type_mouvement: sensImpose(categorie, typeMouvement), montant, categorie, motif: motif.trim() || null })
    .eq('id', id)
    .is('reference_type', null)
  if (error) return { error: error.message }

  revalidatePath('/tresorerie')
  return { success: true }
}

export async function deleteEcritureTresorerie(id: string): Promise<ActionResult> {
  await requireGerantOuTresorier('/tresorerie', 'modifier')
  const supabase = await createClient()

  const { data: existante } = await supabase.from('journal_tresorerie').select('reference_type').eq('id', id).single()
  if (existante?.reference_type) {
    return { error: 'Cette écriture est liée à une vente, un achat, une charge ou un règlement — supprimez-la depuis son origine.' }
  }

  const { error } = await supabase.from('journal_tresorerie').delete().eq('id', id).is('reference_type', null)
  if (error) return { error: error.message }

  revalidatePath('/tresorerie')
  return { success: true }
}
