'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/utils/supabase/server'
import { requireGerant } from '@/lib/auth/getCurrentUserContext'

type ActionResult = { success?: true; error?: string }

// L'écriture passe uniquement par mouvements_stock (grand livre append-only) :
// le trigger sync_stock_apres_mouvement (migration 02_stock.sql) met à jour le
// cache `stocks` et rejette toute sortie qui ferait passer la quantité sous
// zéro — l'erreur Postgres remonte ici sous forme de {error}, jamais une
// exception brute qui casserait la page (cf. plan §7 phase 4).
export async function ajusterStock(formData: FormData): Promise<ActionResult> {
  const context = await requireGerant()
  const supabase = await createClient()

  const articleId = formData.get('article_id') as string
  const sens = formData.get('sens') as 'positif' | 'negatif'
  const quantite = parseFloat(formData.get('quantite') as string)
  const motif = (formData.get('motif') as string)?.trim() || null

  if (!articleId) return { error: 'Un article est requis' }
  if (!quantite || quantite <= 0) return { error: 'La quantité doit être positive' }

  const { error } = await supabase.from('mouvements_stock').insert({
    magasin_id: context.magasinId,
    article_id: articleId,
    type_mouvement: sens === 'positif' ? 'ajustement_positif' : 'ajustement_negatif',
    quantite,
    motif,
    utilisateur_id: context.userId,
  })
  if (error) return { error: error.message }

  revalidatePath('/stock')
  return { success: true }
}
