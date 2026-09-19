'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/utils/supabase/admin'
import { getSharedAdminUser, getLocalUser } from '@/utils/supabase/admin-identity'
import { withRetryResult } from '@/utils/supabase/retry'
import { isAdminEmail } from '@/lib/admin/auth'

type ActionResult = { success?: true; error?: string }

async function checkAdmin(): Promise<string | null> {
  const [sharedUser, localUser] = await Promise.all([getSharedAdminUser(), getLocalUser()])
  return isAdminEmail(sharedUser?.email) || isAdminEmail(localUser?.email) ? null : 'Non autorisé'
}

// Supprime un paiement échoué, ou une demande publique jamais rattachée à une
// entreprise (entreprise_id null). Un abonnement déjà rattaché à une entreprise
// et non échoué est l'historique comptable d'une entreprise réelle : refusé ici
// même si l'UI ne propose pas le bouton, la garde côté serveur fait foi.
export async function supprimerAbonnement(abonnementId: string): Promise<ActionResult> {
  const authError = await checkAdmin()
  if (authError) return { error: authError }

  const supabase = createAdminClient()

  const { data: ligne, error: ligneError } = await withRetryResult(() =>
    supabase.from('abonnements').select('id, entreprise_id, statut').eq('id', abonnementId).single()
  )
  if (ligneError || !ligne) return { error: ligneError?.message ?? 'Ligne introuvable' }
  if (ligne.statut !== 'echoue' && ligne.entreprise_id !== null) {
    return { error: 'Seuls les paiements échoués et les demandes non traitées peuvent être supprimés' }
  }

  const { error } = await withRetryResult(() => supabase.from('abonnements').delete().eq('id', abonnementId))
  if (error) return { error: error.message }

  revalidatePath('/admin/paiements')
  revalidatePath('/admin/demandes')
  return { success: true }
}
