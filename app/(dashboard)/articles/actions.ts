'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/utils/supabase/server'
import { requireGerant } from '@/lib/auth/getCurrentUserContext'

type ActionResult = { success?: true; error?: string }

export async function addArticle(formData: FormData): Promise<ActionResult> {
  const context = await requireGerant('/articles', 'ecrire')
  const supabase = await createClient()

  const designation = (formData.get('designation') as string)?.trim()
  const reference = (formData.get('reference') as string)?.trim() || null
  const categorieId = (formData.get('categorie_id') as string) || null
  const unite = (formData.get('unite') as string)?.trim() || 'unite'
  const prixVente = parseFloat(formData.get('prix_vente') as string) || 0
  const seuilAlerte = parseFloat(formData.get('seuil_alerte') as string) || 0

  if (!designation) return { error: 'La désignation est requise' }

  const { error } = await supabase.from('articles').insert({
    entreprise_id: context.entrepriseId,
    categorie_id: categorieId,
    reference,
    designation,
    unite,
    prix_vente: prixVente,
    seuil_alerte: seuilAlerte,
  })
  if (error) return { error: error.message }

  revalidatePath('/articles')
  return { success: true }
}

export async function updateArticle(id: string, formData: FormData): Promise<ActionResult> {
  await requireGerant('/articles', 'modifier')
  const supabase = await createClient()

  const designation = (formData.get('designation') as string)?.trim()
  const reference = (formData.get('reference') as string)?.trim() || null
  const categorieId = (formData.get('categorie_id') as string) || null
  const unite = (formData.get('unite') as string)?.trim() || 'unite'
  const prixVente = parseFloat(formData.get('prix_vente') as string) || 0
  const seuilAlerte = parseFloat(formData.get('seuil_alerte') as string) || 0

  if (!designation) return { error: 'La désignation est requise' }

  const { error } = await supabase
    .from('articles')
    .update({ designation, reference, categorie_id: categorieId, unite, prix_vente: prixVente, seuil_alerte: seuilAlerte })
    .eq('id', id)
  if (error) return { error: error.message }

  revalidatePath('/articles')
  return { success: true }
}

export async function toggleArticleActif(id: string, actif: boolean): Promise<ActionResult> {
  await requireGerant('/articles', 'modifier')
  const supabase = await createClient()

  const { error } = await supabase.from('articles').update({ actif }).eq('id', id)
  if (error) return { error: error.message }

  revalidatePath('/articles')
  return { success: true }
}

export async function deleteArticle(id: string): Promise<ActionResult> {
  await requireGerant('/articles', 'modifier')
  const supabase = await createClient()

  const { error } = await supabase.from('articles').delete().eq('id', id)
  if (error) return { error: error.message }

  revalidatePath('/articles')
  return { success: true }
}
