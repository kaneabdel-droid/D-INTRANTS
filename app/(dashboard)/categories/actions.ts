'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/utils/supabase/server'
import { requireGerant } from '@/lib/auth/getCurrentUserContext'

type ActionResult = { success?: true; error?: string }

export async function addCategorie(formData: FormData): Promise<ActionResult> {
  const context = await requireGerant()
  const supabase = await createClient()

  const nom = (formData.get('nom') as string)?.trim()
  const description = (formData.get('description') as string)?.trim() || null
  if (!nom) return { error: 'Le nom est requis' }

  const { error } = await supabase.from('categories').insert({
    entreprise_id: context.entrepriseId,
    nom,
    description,
  })
  if (error) return { error: error.message }

  revalidatePath('/categories')
  return { success: true }
}

export async function updateCategorie(id: string, nom: string, description: string): Promise<ActionResult> {
  await requireGerant()
  const supabase = await createClient()

  if (!nom.trim()) return { error: 'Le nom est requis' }

  const { error } = await supabase
    .from('categories')
    .update({ nom: nom.trim(), description: description.trim() || null })
    .eq('id', id)
  if (error) return { error: error.message }

  revalidatePath('/categories')
  return { success: true }
}

export async function deleteCategorie(id: string): Promise<ActionResult> {
  await requireGerant()
  const supabase = await createClient()

  const { error } = await supabase.from('categories').delete().eq('id', id)
  if (error) return { error: error.message }

  revalidatePath('/categories')
  return { success: true }
}
