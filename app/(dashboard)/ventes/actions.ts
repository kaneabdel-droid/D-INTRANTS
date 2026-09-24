'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/utils/supabase/server'
import { requireGerant } from '@/lib/auth/getCurrentUserContext'

type ActionResult = { success?: true; venteId?: string; error?: string }

type Ligne = { article_id: string; quantite: number; prix_unitaire: number }

export async function creerVente(
  clientId: string | null,
  modePaiement: 'comptant' | 'credit' | 'mixte',
  montantPaye: number,
  lignes: Ligne[]
): Promise<ActionResult> {
  const context = await requireGerant('/ventes', 'ecrire')
  const supabase = await createClient()

  if (lignes.length === 0) return { error: 'Ajoutez au moins une ligne' }

  const { data, error } = await supabase.rpc('creer_vente', {
    p_magasin_id: context.magasinId,
    p_client_id: clientId,
    p_mode_paiement: modePaiement,
    p_montant_paye: montantPaye,
    p_lignes: lignes,
  })

  if (error) return { error: error.message }

  revalidatePath('/ventes')
  revalidatePath('/stock')
  revalidatePath('/creances')
  revalidatePath('/tresorerie')
  return { success: true, venteId: data as string }
}

export async function annulerVente(venteId: string): Promise<ActionResult> {
  await requireGerant('/ventes', 'modifier')
  const supabase = await createClient()

  // Toute la logique de réconciliation (stock, créance, trésorerie) vit dans
  // la RPC annuler_vente (migration 18) — jamais un simple changement de
  // statut, qui laisserait le stock/la trésorerie/les créances faussés.
  const { error } = await supabase.rpc('annuler_vente', { p_vente_id: venteId })
  if (error) return { error: error.message }

  revalidatePath('/ventes')
  revalidatePath('/stock')
  revalidatePath('/creances')
  revalidatePath('/tresorerie')
  revalidatePath('/comparatif')
  revalidatePath('/rentabilite')
  revalidatePath('/dashboard')
  return { success: true }
}
