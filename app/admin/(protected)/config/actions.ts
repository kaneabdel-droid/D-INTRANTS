'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/utils/supabase/admin'
import { getSharedAdminUser, getLocalUser } from '@/utils/supabase/admin-identity'
import { isAdminEmail } from '@/lib/admin/auth'
import { estPalierValide, estDureeValide } from '@/lib/abonnements/paliers'

async function checkAdmin(): Promise<string | null> {
  const [sharedUser, localUser] = await Promise.all([getSharedAdminUser(), getLocalUser()])
  return isAdminEmail(sharedUser?.email) || isAdminEmail(localUser?.email) ? null : 'Non autorisé'
}

export async function upsertChariowProduit(palier: string, dureeMois: number, productId: string) {
  const authError = await checkAdmin()
  if (authError) return { error: authError }
  if (!estPalierValide(palier) || !estDureeValide(dureeMois)) return { error: 'Palier ou durée invalide' }
  if (!productId.trim()) return { error: 'Identifiant produit requis' }

  const supabase = createAdminClient()
  const { error } = await supabase
    .from('chariow_produits')
    .upsert({ palier, duree_mois: dureeMois, product_id: productId.trim(), updated_at: new Date().toISOString() })

  if (error) return { error: error.message }

  revalidatePath('/admin/config')
  return { success: true }
}

export async function supprimerChariowProduit(palier: string, dureeMois: number) {
  const authError = await checkAdmin()
  if (authError) return { error: authError }

  const supabase = createAdminClient()
  const { error } = await supabase.from('chariow_produits').delete().eq('palier', palier).eq('duree_mois', dureeMois)
  if (error) return { error: error.message }

  revalidatePath('/admin/config')
  return { success: true }
}
