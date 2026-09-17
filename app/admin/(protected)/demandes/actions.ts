'use server'

import { revalidatePath } from 'next/cache'
import { addMonths } from 'date-fns'
import { createAdminClient } from '@/utils/supabase/admin'
import { getSharedAdminUser, getLocalUser } from '@/utils/supabase/admin-identity'
import { withRetryResult } from '@/utils/supabase/retry'
import { isAdminEmail } from '@/lib/admin/auth'
import type { PalierCode, DureeMois } from '@/lib/abonnements/paliers'

type ActionResult = { success?: true; error?: string }

async function checkAdmin(): Promise<string | null> {
  const [sharedUser, localUser] = await Promise.all([getSharedAdminUser(), getLocalUser()])
  return isAdminEmail(sharedUser?.email) || isAdminEmail(localUser?.email) ? null : 'Non autorisé'
}

// Rattache une demande publique payée (abonnements.entreprise_id null, cf.
// app/tarifs/actions.ts) à une entreprise que l'admin vient de créer via le
// flux habituel (/admin/entreprises) — même calcul de période que
// lib/abonnements/reconcile.ts, pour que la nouvelle entreprise démarre
// directement sur le palier payé plutôt qu'en 'standard' non payé par défaut.
export async function traiterDemande(abonnementId: string, entrepriseId: string): Promise<ActionResult> {
  const authError = await checkAdmin()
  if (authError) return { error: authError }

  const supabase = createAdminClient()

  const { data: ligne, error: ligneError } = await withRetryResult(() =>
    supabase.from('abonnements').select('id, entreprise_id, statut, palier, duree_mois').eq('id', abonnementId).single()
  )
  if (ligneError || !ligne) return { error: ligneError?.message ?? 'Demande introuvable' }
  if (ligne.entreprise_id !== null) return { error: 'Cette demande est déjà rattachée à une entreprise' }
  if (ligne.statut !== 'paye') return { error: "Cette demande n'est pas encore payée" }

  const { data: entreprise, error: entrepriseError } = await withRetryResult(() =>
    supabase.from('entreprises').select('id, palier, abonnement_expire_le').eq('id', entrepriseId).single()
  )
  if (entrepriseError || !entreprise) return { error: entrepriseError?.message ?? 'Entreprise introuvable' }

  const palier = ligne.palier as PalierCode
  const dureeMois = ligne.duree_mois as DureeMois
  const maintenant = new Date()
  const encoreActif = Boolean(entreprise.abonnement_expire_le) && new Date(entreprise.abonnement_expire_le!) > maintenant && entreprise.palier === palier
  const base = encoreActif ? new Date(entreprise.abonnement_expire_le!) : maintenant
  const nouvelleExpiration = addMonths(base, dureeMois)

  const { error: majAbonnement } = await withRetryResult(() =>
    supabase.from('abonnements').update({ entreprise_id: entrepriseId, periode_debut: base.toISOString(), periode_fin: nouvelleExpiration.toISOString() }).eq('id', abonnementId)
  )
  if (majAbonnement) return { error: majAbonnement.message }

  const { error: majEntreprise } = await withRetryResult(() =>
    supabase.from('entreprises').update({ palier, abonnement_expire_le: nouvelleExpiration.toISOString(), statut: 'actif' }).eq('id', entrepriseId)
  )
  if (majEntreprise) return { error: majEntreprise.message }

  revalidatePath('/admin/demandes')
  revalidatePath('/admin/entreprises')
  revalidatePath(`/admin/entreprises/${entrepriseId}`)
  return { success: true }
}
