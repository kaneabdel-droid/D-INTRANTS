'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/utils/supabase/server'
import { requireGerant } from '@/lib/auth/getCurrentUserContext'

type ActionResult = { success?: true; error?: string }

export async function reglerDette(detteId: string, montant: number, compteTresorerieId: string): Promise<ActionResult> {
  await requireGerant('/dettes', 'ecrire')
  const supabase = await createClient()

  const { error } = await supabase.rpc('regler_dette', {
    p_dette_id: detteId,
    p_montant: montant,
    p_compte_tresorerie_id: compteTresorerieId,
  })
  if (error) return { error: error.message }

  revalidatePath('/dettes')
  revalidatePath('/tresorerie')
  return { success: true }
}
