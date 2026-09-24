'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/utils/supabase/server'
import { requireGerant } from '@/lib/auth/getCurrentUserContext'

type ActionResult = { success?: true; error?: string }

export async function addFournisseur(formData: FormData): Promise<ActionResult> {
  const context = await requireGerant('/fournisseurs', 'ecrire')
  const supabase = await createClient()

  const nom = (formData.get('nom') as string)?.trim()
  const telephone = (formData.get('telephone') as string)?.trim() || null
  const adresse = (formData.get('adresse') as string)?.trim() || null
  if (!nom) return { error: 'Le nom est requis' }

  const { error } = await supabase.from('fournisseurs').insert({
    entreprise_id: context.entrepriseId,
    nom,
    telephone,
    adresse,
  })
  if (error) return { error: error.message }

  revalidatePath('/fournisseurs')
  revalidatePath('/achats')
  return { success: true }
}

export async function updateFournisseur(id: string, nom: string, telephone: string, adresse: string): Promise<ActionResult> {
  await requireGerant('/fournisseurs', 'modifier')
  const supabase = await createClient()

  if (!nom.trim()) return { error: 'Le nom est requis' }

  const { error } = await supabase
    .from('fournisseurs')
    .update({ nom: nom.trim(), telephone: telephone.trim() || null, adresse: adresse.trim() || null })
    .eq('id', id)
  if (error) return { error: error.message }

  revalidatePath('/fournisseurs')
  revalidatePath('/achats')
  return { success: true }
}

export async function deleteFournisseur(id: string): Promise<ActionResult> {
  await requireGerant('/fournisseurs', 'modifier')
  const supabase = await createClient()

  const { error } = await supabase.from('fournisseurs').delete().eq('id', id)
  if (error) return { error: error.message }

  revalidatePath('/fournisseurs')
  return { success: true }
}
