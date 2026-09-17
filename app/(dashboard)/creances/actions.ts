'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/utils/supabase/server'
import { requireGerant } from '@/lib/auth/getCurrentUserContext'

type ActionResult = { success?: true; error?: string }

export async function reglerCreance(creanceId: string, montant: number, compteTresorerieId: string): Promise<ActionResult> {
  await requireGerant()
  const supabase = await createClient()

  const { error } = await supabase.rpc('regler_creance', {
    p_creance_id: creanceId,
    p_montant: montant,
    p_compte_tresorerie_id: compteTresorerieId,
  })
  if (error) return { error: error.message }

  revalidatePath('/creances')
  revalidatePath('/tresorerie')
  return { success: true }
}
