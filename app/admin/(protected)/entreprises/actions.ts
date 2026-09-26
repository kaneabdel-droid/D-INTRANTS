'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/utils/supabase/admin'
import { getSharedAdminUser, getLocalUser } from '@/utils/supabase/admin-identity'
import { withRetry, withRetryResult } from '@/utils/supabase/retry'
import { isAdminEmail } from '@/lib/admin/auth'
import { PALIERS, type PalierCode } from '@/lib/abonnements/paliers'

type ActionResult = { success?: true; error?: string }

// Identité admin partagée (SSO inter-produits) d'abord, session admin locale à
// d-intrants en secours — même double vérification que middleware.ts et layout.tsx.
// Les deux helpers sont mémoïsés par requête et lancés en parallèle : sans ça,
// chaque action admin payait jusqu'à deux aller-retours réseau séquentiels rien
// que pour l'autorisation, avant même d'exécuter l'écriture demandée.
async function checkAdmin(): Promise<string | null> {
  const [sharedUser, localUser] = await Promise.all([getSharedAdminUser(), getLocalUser()])
  return isAdminEmail(sharedUser?.email) || isAdminEmail(localUser?.email) ? null : 'Non autorisé'
}

// Bannissement long (10 ans) plutôt qu'un vrai champ "désactivé" — même mécanisme
// que SIGGIE, Supabase Auth n'ayant pas de statut désactivé natif.
const BAN_DUREE_DESACTIVATION = '87600h'

export async function creerEntreprise(nom: string, adresse: string, telephone: string, email: string, identification: string, devise: string): Promise<ActionResult> {
  const authError = await checkAdmin()
  if (authError) return { error: authError }
  if (!nom.trim()) return { error: 'Le nom est requis' }

  const supabase = createAdminClient()
  const { error } = await withRetryResult(() =>
    supabase.from('entreprises').insert({
      nom: nom.trim(),
      adresse: adresse.trim() || null,
      telephone: telephone.trim() || null,
      email: email.trim() || null,
      identification: identification.trim() || null,
      devise: devise.trim() || 'XOF',
    })
  )
  if (error) return { error: error.message }

  revalidatePath('/admin/entreprises')
  return { success: true }
}

export async function changerStatutEntreprise(entrepriseId: string, statut: 'actif' | 'suspendu'): Promise<ActionResult> {
  const authError = await checkAdmin()
  if (authError) return { error: authError }

  const supabase = createAdminClient()
  const { error } = await withRetryResult(() =>
    supabase.from('entreprises').update({ statut }).eq('id', entrepriseId)
  )
  if (error) return { error: error.message }

  revalidatePath(`/admin/entreprises/${entrepriseId}`)
  revalidatePath('/admin/entreprises')
  return { success: true }
}

export async function creerMagasin(entrepriseId: string, nom: string, adresse: string, telephone: string): Promise<ActionResult> {
  const authError = await checkAdmin()
  if (authError) return { error: authError }
  if (!nom.trim()) return { error: 'Le nom du magasin est requis' }

  const supabase = createAdminClient()

  // Limite de magasins par palier d'abonnement — bloquant : force la mise à
  // niveau plutôt que de laisser un client dépasser ce pour quoi il paie (cf.
  // lib/abonnements/paliers.ts, seule source de vérité pour magasinsMax).
  const { data: entreprise } = await withRetryResult(() =>
    supabase.from('entreprises').select('palier').eq('id', entrepriseId).single()
  )
  const palier = (entreprise?.palier ?? 'standard') as PalierCode
  // En cas d'échec réseau persistant sur cette vérification, on refuse plutôt que
  // de supposer 0 magasin existant : un faux 0 laisserait dépasser la limite du
  // palier au lieu de la faire respecter.
  const countResult = await withRetry(() =>
    supabase.from('magasins').select('id', { count: 'exact', head: true }).eq('entreprise_id', entrepriseId).eq('statut', 'actif')
  ).catch((e) => ({ count: null, error: e as Error }))
  if (countResult.count === null) {
    return { error: `Impossible de vérifier le nombre de magasins existants : ${countResult.error?.message}` }
  }
  const count = countResult.count
  if ((count ?? 0) >= PALIERS[palier].magasinsMax) {
    return { error: `Limite atteinte : le palier ${PALIERS[palier].nom} autorise au maximum ${PALIERS[palier].magasinsMax} magasin(s). Passez cette entreprise à un palier supérieur pour en ajouter.` }
  }

  const { error } = await withRetryResult(() =>
    supabase.from('magasins').insert({
      entreprise_id: entrepriseId,
      nom: nom.trim(),
      adresse: adresse.trim() || null,
      telephone: telephone.trim() || null,
    })
  )
  if (error) return { error: error.message }

  revalidatePath(`/admin/entreprises/${entrepriseId}`)
  return { success: true }
}

export async function archiverMagasin(entrepriseId: string, magasinId: string): Promise<ActionResult> {
  const authError = await checkAdmin()
  if (authError) return { error: authError }

  const supabase = createAdminClient()
  const { error } = await withRetryResult(() =>
    supabase.from('magasins').update({ statut: 'archive' }).eq('id', magasinId)
  )
  if (error) return { error: error.message }

  revalidatePath(`/admin/entreprises/${entrepriseId}`)
  return { success: true }
}

// Pas de trigger handle_new_user côté d-intrants (aucune auto-inscription à
// intercepter, contrairement à SIGGIE) : les deux étapes (auth + ligne
// utilisateurs) sont faites directement ici, avec compensation en cas d'échec
// de la seconde pour éviter un compte auth orphelin — cf. plan §4.
export async function creerUtilisateur(
  entrepriseId: string,
  email: string,
  password: string,
  role: 'admin_entreprise' | 'gerant' | 'tresorier',
  magasinId: string | null,
  nom: string,
  prenom: string
): Promise<ActionResult> {
  const authError = await checkAdmin()
  if (authError) return { error: authError }
  if (!email.trim()) return { error: "L'email est requis" }
  if (!password || password.length < 6) return { error: 'Le mot de passe doit contenir au moins 6 caractères' }
  if ((role === 'gerant' || role === 'tresorier') && !magasinId) return { error: 'Un magasin est requis pour un gérant ou un trésorier' }
  if (role === 'admin_entreprise' && magasinId) return { error: "Un admin entreprise n'est rattaché à aucun magasin" }

  const supabase = createAdminClient()
  const { data: created, error: createError } = await withRetryResult(() =>
    supabase.auth.admin.createUser({
      email: email.trim(),
      password,
      email_confirm: true,
    })
  )
  if (createError || !created?.user) return { error: createError?.message ?? 'Échec de la création du compte' }

  const { error: insertError } = await withRetryResult(() =>
    supabase.from('utilisateurs').insert({
      id: created.user.id,
      entreprise_id: entrepriseId,
      magasin_id: magasinId,
      role,
      nom: nom.trim() || null,
      prenom: prenom.trim() || null,
    })
  )
  if (insertError) {
    await withRetry(() => supabase.auth.admin.deleteUser(created.user.id)).catch(() => {}) // évite un compte auth orphelin
    return { error: insertError.message }
  }

  revalidatePath(`/admin/entreprises/${entrepriseId}`)
  return { success: true }
}

export async function modifierProfilUtilisateur(
  entrepriseId: string,
  utilisateurId: string,
  role: 'admin_entreprise' | 'gerant' | 'tresorier',
  magasinId: string | null
): Promise<ActionResult> {
  const authError = await checkAdmin()
  if (authError) return { error: authError }
  if (!['admin_entreprise', 'gerant', 'tresorier'].includes(role)) return { error: 'Rôle invalide' }
  if ((role === 'gerant' || role === 'tresorier') && !magasinId) return { error: 'Un magasin est requis pour un gérant ou un trésorier' }
  if (role === 'admin_entreprise' && magasinId) return { error: "Un admin entreprise n'est rattaché à aucun magasin" }

  const supabase = createAdminClient()

  const { data: utilisateur } = await withRetryResult(() =>
    supabase.from('utilisateurs').select('id').eq('id', utilisateurId).eq('entreprise_id', entrepriseId).maybeSingle()
  )
  if (!utilisateur) return { error: "Utilisateur introuvable dans cette entreprise" }

  if (magasinId) {
    const { data: magasin } = await withRetryResult(() =>
      supabase.from('magasins').select('id').eq('id', magasinId).eq('entreprise_id', entrepriseId).eq('statut', 'actif').maybeSingle()
    )
    if (!magasin) return { error: 'Magasin introuvable ou archivé' }
  }

  const { error } = await withRetryResult(() =>
    supabase.from('utilisateurs').update({ role, magasin_id: magasinId }).eq('id', utilisateurId).eq('entreprise_id', entrepriseId)
  )
  if (error) {
    return {
      error: error.message.includes('duplicate')
        ? "Cette entreprise a déjà un admin entreprise : changez d'abord son profil"
        : error.message,
    }
  }

  revalidatePath(`/admin/entreprises/${entrepriseId}`)
  return { success: true }
}

export async function desactiverCompteUtilisateur(entrepriseId: string, utilisateurId: string): Promise<ActionResult> {
  const authError = await checkAdmin()
  if (authError) return { error: authError }

  const supabase = createAdminClient()
  const { error } = await withRetryResult(() =>
    supabase.auth.admin.updateUserById(utilisateurId, { ban_duration: BAN_DUREE_DESACTIVATION })
  )
  if (error) return { error: error.message }

  revalidatePath(`/admin/entreprises/${entrepriseId}`)
  return { success: true }
}

export async function reactiverCompteUtilisateur(entrepriseId: string, utilisateurId: string): Promise<ActionResult> {
  const authError = await checkAdmin()
  if (authError) return { error: authError }

  const supabase = createAdminClient()
  const { error } = await withRetryResult(() =>
    supabase.auth.admin.updateUserById(utilisateurId, { ban_duration: 'none' })
  )
  if (error) return { error: error.message }

  revalidatePath(`/admin/entreprises/${entrepriseId}`)
  return { success: true }
}

export async function retirerUtilisateur(entrepriseId: string, utilisateurId: string): Promise<ActionResult> {
  const authError = await checkAdmin()
  if (authError) return { error: authError }

  const supabase = createAdminClient()

  // Même contrainte que SIGGIE : utilisateurs.id -> auth.users n'a pas de cascade,
  // donc on désactive le compte auth puis on supprime la ligne de rattachement
  // (la suppression pure et simple casserait les FK des lignes qu'il a créées :
  // ventes.utilisateur_id, mouvements_stock.utilisateur_id, etc. — désactiver
  // plutôt que supprimer préserve cet historique).
  const { error: banError } = await withRetryResult(() =>
    supabase.auth.admin.updateUserById(utilisateurId, { ban_duration: BAN_DUREE_DESACTIVATION })
  )
  if (banError) return { error: banError.message }

  revalidatePath(`/admin/entreprises/${entrepriseId}`)
  return { success: true }
}

/**
 * Suppression définitive d'une entreprise : supprime aussi les comptes auth de
 * ses utilisateurs (la cascade sur `entreprises` efface les lignes `magasins`,
 * `utilisateurs`, `ventes`, etc., mais pas les comptes auth.users sous-jacents,
 * qui resteraient orphelins et connectables sans aucune entreprise).
 */
export async function supprimerEntreprise(entrepriseId: string): Promise<ActionResult> {
  const authError = await checkAdmin()
  if (authError) return { error: authError }

  const supabase = createAdminClient()

  const { data: utilisateurs } = await withRetryResult(() =>
    supabase.from('utilisateurs').select('id').eq('entreprise_id', entrepriseId)
  )

  // L'entreprise d'abord (cascade sur magasins/utilisateurs/ventes/...), puis les
  // comptes auth : supprimer un compte auth avant que sa ligne utilisateurs ait
  // disparu échouerait (contrainte de clé étrangère violée).
  const { error } = await withRetryResult(() => supabase.from('entreprises').delete().eq('id', entrepriseId))
  if (error) return { error: error.message }

  const echecsSuppressionAuth: string[] = []
  for (const u of utilisateurs ?? []) {
    const { error: authDeleteError } = await withRetryResult(() => supabase.auth.admin.deleteUser(u.id))
    if (authDeleteError) echecsSuppressionAuth.push(`${u.id} (${authDeleteError.message})`)
  }

  if (echecsSuppressionAuth.length > 0) {
    return {
      error: `Entreprise supprimée, mais ${echecsSuppressionAuth.length} compte(s) auth n'ont pas pu être supprimés et restent orphelins : ${echecsSuppressionAuth.join(', ')}. Nettoyage manuel requis.`,
    }
  }

  return { success: true }
}
