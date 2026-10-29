'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/utils/supabase/admin'
import { getSharedAdminUser, getLocalUser } from '@/utils/supabase/admin-identity'
import { withRetryResult } from '@/utils/supabase/retry'
import { isAdminEmail } from '@/lib/admin/auth'
import { estPalierValide, estDureeValide } from '@/lib/abonnements/paliers'
import { estMoyenPaiementManuel } from '@/lib/abonnements/types'
import { crediterAbonnementManuel, creerEtActiverAbonnementManuel } from '@/lib/abonnements/reconcile'

type ActionResult = { success?: true; error?: string }

async function checkAdmin(): Promise<string | null> {
  const [sharedUser, localUser] = await Promise.all([getSharedAdminUser(), getLocalUser()])
  return isAdminEmail(sharedUser?.email) || isAdminEmail(localUser?.email) ? null : 'Non autorisé'
}

/**
 * Confirme et active directement un abonnement en attente (ex. paiement Caisse ou Virement)
 * en tant que superadmin.
 */
export async function confirmerPaiementAbonnement(
  abonnementId: string,
  moyenBrut?: string
): Promise<ActionResult> {
  const authError = await checkAdmin()
  if (authError) return { error: authError }

  const moyen = moyenBrut && estMoyenPaiementManuel(moyenBrut) ? moyenBrut : undefined
  const res = await crediterAbonnementManuel(abonnementId, moyen)
  if (!res.ok) return { error: res.raison }

  revalidatePath('/admin/paiements')
  revalidatePath('/admin/demandes')
  revalidatePath('/admin/entreprises')
  return { success: true }
}

/**
 * Crée et active immédiatement un abonnement payé (Caisse ou Virement) pour une entreprise.
 */
export async function activerAbonnementEntreprise(
  entrepriseId: string,
  palierBrut: string,
  dureeMoisBrut: number,
  moyenBrut: string
): Promise<ActionResult> {
  const authError = await checkAdmin()
  if (authError) return { error: authError }
  if (!entrepriseId) return { error: 'Entreprise requise' }
  if (!estPalierValide(palierBrut)) return { error: 'Palier invalide' }
  if (!estDureeValide(dureeMoisBrut)) return { error: 'Durée invalide' }
  if (!estMoyenPaiementManuel(moyenBrut)) return { error: 'Moyen de paiement invalide (Caisse ou Virement requis)' }

  const res = await creerEtActiverAbonnementManuel({
    entrepriseId,
    palier: palierBrut,
    dureeMois: dureeMoisBrut,
    moyen: moyenBrut,
  })
  if (!res.ok) return { error: res.error }

  revalidatePath(`/admin/entreprises/${entrepriseId}`)
  revalidatePath('/admin/entreprises')
  revalidatePath('/admin/paiements')
  return { success: true }
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
