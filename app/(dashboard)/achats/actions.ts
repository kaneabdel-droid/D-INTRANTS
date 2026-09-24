'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/utils/supabase/server'
import { requireGerant } from '@/lib/auth/getCurrentUserContext'

type ActionResult = { success?: true; achatId?: string; error?: string }

type Ligne = { article_id: string; quantite: number; prix_unitaire_achat: number }

export async function creerAchat(
  fournisseurId: string | null,
  modePaiement: 'comptant' | 'credit' | 'mixte',
  montantPaye: number,
  lignes: Ligne[]
): Promise<ActionResult> {
  const context = await requireGerant('/achats', 'ecrire')
  const supabase = await createClient()

  if (lignes.length === 0) return { error: 'Ajoutez au moins une ligne' }

  const { data, error } = await supabase.rpc('creer_achat', {
    p_magasin_id: context.magasinId,
    p_fournisseur_id: fournisseurId,
    p_mode_paiement: modePaiement,
    p_montant_paye: montantPaye,
    p_lignes: lignes,
  })

  if (error) return { error: error.message }

  revalidatePath('/achats')
  revalidatePath('/stock')
  revalidatePath('/dettes')
  revalidatePath('/tresorerie')
  return { success: true, achatId: data as string }
}

export async function annulerAchat(achatId: string): Promise<ActionResult> {
  await requireGerant('/achats', 'modifier')
  const supabase = await createClient()

  // Réconciliation complète (stock, dette, trésorerie) dans la RPC
  // annuler_achat (migration 18) — voir son commentaire pour le détail des
  // garde-fous (dette déjà réglée, stock déjà revendu).
  const { error } = await supabase.rpc('annuler_achat', { p_achat_id: achatId })
  if (error) return { error: error.message }

  revalidatePath('/achats')
  revalidatePath('/stock')
  revalidatePath('/dettes')
  revalidatePath('/tresorerie')
  revalidatePath('/comparatif')
  revalidatePath('/rentabilite')
  revalidatePath('/dashboard')
  return { success: true }
}
