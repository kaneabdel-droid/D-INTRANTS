'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/utils/supabase/server'
import { requireAdminEntreprise } from '@/lib/auth/getCurrentUserContext'
import { estDeviseValide } from '@/lib/currency'
import type { Matrice } from '@/lib/permissions'

type ActionResult = { success?: true; error?: string; logoUrl?: string }

export async function updateEntrepriseInfos(formData: FormData): Promise<ActionResult> {
  await requireAdminEntreprise()
  const supabase = await createClient()

  const nom = (formData.get('nom') as string)?.trim()
  const adresse = (formData.get('adresse') as string) ?? ''
  const telephone = (formData.get('telephone') as string) ?? ''
  const email = (formData.get('email') as string) ?? ''
  const identification = (formData.get('identification') as string) ?? ''
  const devise = formData.get('devise') as string

  if (!nom) return { error: 'Le nom est requis' }
  if (!estDeviseValide(devise)) return { error: 'Devise invalide' }

  const { error } = await supabase.rpc('update_entreprise_infos', {
    p_nom: nom,
    p_adresse: adresse,
    p_telephone: telephone,
    p_email: email,
    p_identification: identification,
    p_devise: devise,
  })
  if (error) return { error: error.message }

  revalidatePath('/parametres')
  return { success: true }
}

// Upload distinct de la mise à jour du formulaire : le logo se remplace
// indépendamment des autres champs (pas besoin de re-saisir toute la fiche
// pour changer d'image) via update_entreprise_logo, une fois l'upload Storage
// terminé et l'URL publique connue.
export async function uploadLogo(formData: FormData): Promise<ActionResult> {
  const context = await requireAdminEntreprise()
  const supabase = await createClient()

  const file = formData.get('logo') as File | null
  if (!file || file.size === 0) return { error: 'Aucun fichier sélectionné' }
  if (!file.type.startsWith('image/')) return { error: 'Le fichier doit être une image' }
  if (file.size > 2 * 1024 * 1024) return { error: 'Image trop volumineuse (max 2 Mo)' }

  const extension = file.name.split('.').pop() || 'png'
  const path = `${context.entrepriseId}/logo.${extension}`

  const { error: uploadError } = await supabase.storage
    .from('logos')
    .upload(path, file, { upsert: true, contentType: file.type })
  if (uploadError) return { error: uploadError.message }

  const { data: publicUrlData } = supabase.storage.from('logos').getPublicUrl(path)
  const logoUrl = `${publicUrlData.publicUrl}?v=${Date.now()}`

  const { error: rpcError } = await supabase.rpc('update_entreprise_logo', { p_logo_url: logoUrl })
  if (rpcError) return { error: rpcError.message }

  revalidatePath('/parametres')
  return { success: true, logoUrl }
}

// L'écriture est de toute façon bloquée par la policy RLS (admin_entreprise seul) : la vérification ici
// évite un aller-retour inutile.
export async function enregistrerPermissions(matrice: Matrice): Promise<ActionResult> {
  const context = await requireAdminEntreprise()
  const supabase = await createClient()

  const { error } = await supabase
    .from('parametres_permissions')
    .upsert({ entreprise_id: context.entrepriseId, matrice, updated_par: context.userId, updated_at: new Date().toISOString() })
  if (error) return { error: error.message }

  revalidatePath('/', 'layout')
  return { success: true }
}

import { createAdminClient } from '@/utils/supabase/admin'
import { genererEmailSynthetique, normaliserIdentifiant } from '@/lib/auth-identifier'

export type CreerCollaborateurResult = {
  success?: boolean
  error?: string
  collaborateur?: {
    id: string
    role: string | null
    identifiant: string | null
    telephone: string | null
    nom: string | null
    prenom: string | null
    nom_complet: string | null
    magasin_id?: string | null
    magasin_nom?: string | null
  }
}

export async function creerCollaborateur(formData: FormData): Promise<CreerCollaborateurResult> {
  const context = await requireAdminEntreprise()

  const rawIdentifiant = (formData.get('identifiant') as string)?.trim()
  const nomComplet = (formData.get('nom_complet') as string)?.trim() || null
  const telephone = (formData.get('telephone') as string)?.trim() || null
  const emailInput = (formData.get('email') as string)?.trim() || ''
  const password = (formData.get('password') as string) || ''
  const roleInput = ((formData.get('role') as string)?.trim()) || 'gerant'
  const magasinId = (formData.get('magasin_id') as string)?.trim() || null

  if (!rawIdentifiant) {
    return { error: "L'identifiant ou numéro de téléphone est obligatoire." }
  }

  const identifiant = normaliserIdentifiant(rawIdentifiant)
  if (identifiant.length < 3) {
    return { error: "L'identifiant doit comporter au moins 3 caractères." }
  }

  if (!password || password.length < 6) {
    return { error: 'Le mot de passe doit comporter au moins 6 caractères.' }
  }

  const authEmail = emailInput ? emailInput.toLowerCase() : genererEmailSynthetique(identifiant)

  const adminSupabase = createAdminClient()

  // 1. Vérification unicité identifiant / téléphone
  const { data: existant } = await adminSupabase
    .from('utilisateurs')
    .select('id')
    .or(`identifiant.ilike.${identifiant}${telephone ? `,telephone.eq.${telephone}` : ''}`)
    .maybeSingle()

  if (existant) {
    return { error: 'Cet identifiant ou numéro de téléphone est déjà utilisé par un autre collaborateur.' }
  }

  // 2. Création dans auth.users
  const { data: authCreated, error: authError } = await adminSupabase.auth.admin.createUser({
    email: authEmail,
    password,
    email_confirm: true,
    user_metadata: {
      role: roleInput,
      identifiant,
      telephone,
      nom_complet: nomComplet,
      entreprise_id: context.entrepriseId,
      magasin_id: roleInput === 'admin_entreprise' ? null : magasinId,
    },
  })

  if (authError) {
    if (authError.message.toLowerCase().includes('already') || authError.message.toLowerCase().includes('registered')) {
      return {
        error: `L'identifiant "${rawIdentifiant}" ou cet e-mail est déjà utilisé. Veuillez en choisir un autre.`,
      }
    }
    return { error: `Échec de création du compte : ${authError.message}` }
  }

  // 3. Mise à jour / insertion dans public.utilisateurs
  const parts = (nomComplet || '').trim().split(/\s+/)
  const prenom = parts[0] || null
  const nom = parts.slice(1).join(' ') || null

  if (authCreated.user) {
    const { error: userError } = await adminSupabase
      .from('utilisateurs')
      .upsert({
        id: authCreated.user.id,
        entreprise_id: context.entrepriseId,
        magasin_id: roleInput === 'admin_entreprise' ? null : magasinId,
        role: roleInput,
        identifiant,
        nom_complet: nomComplet,
        nom,
        prenom,
        telephone,
      })

    if (userError) {
      return { error: `Compte créé, mais profil incomplet : ${userError.message}` }
    }
  }

  let magasinNom: string | null = null
  if (magasinId) {
    const { data: mag } = await adminSupabase
      .from('magasins')
      .select('nom')
      .eq('id', magasinId)
      .maybeSingle()
    magasinNom = mag?.nom || null
  }

  revalidatePath('/parametres')
  return {
    success: true,
    collaborateur: {
      id: authCreated.user!.id,
      role: roleInput,
      identifiant,
      telephone,
      nom,
      prenom,
      nom_complet: nomComplet,
      magasin_id: roleInput === 'admin_entreprise' ? null : magasinId,
      magasin_nom: magasinNom,
    },
  }
}

export async function supprimerCollaborateur(collaborateurId: string): Promise<{ success?: boolean; error?: string }> {
  const context = await requireAdminEntreprise()

  if (collaborateurId === context.userId) {
    return { error: 'Vous ne pouvez pas supprimer votre propre compte administrateur.' }
  }

  const adminSupabase = createAdminClient()

  // Vérifier appartenance à la même entreprise
  const { data: cible } = await adminSupabase
    .from('utilisateurs')
    .select('id, role')
    .eq('id', collaborateurId)
    .eq('entreprise_id', context.entrepriseId)
    .maybeSingle()

  if (!cible) {
    return { error: 'Collaborateur introuvable dans votre entreprise.' }
  }

  // Supprimer profil utilisateur
  const { error: delProfileError } = await adminSupabase
    .from('utilisateurs')
    .delete()
    .eq('id', collaborateurId)
    .eq('entreprise_id', context.entrepriseId)

  if (delProfileError) {
    return { error: delProfileError.message }
  }

  // Supprimer de Supabase Auth
  await adminSupabase.auth.admin.deleteUser(collaborateurId)

  revalidatePath('/parametres')
  return { success: true }
}

export async function genererLienResetCollaborateur(collaborateurId: string): Promise<{
  success?: boolean
  error?: string
  link?: string
  telephone?: string | null
  identifiant?: string | null
  nomComplet?: string | null
}> {
  const context = await requireAdminEntreprise()
  const adminSupabase = createAdminClient()

  const { data: cible } = await adminSupabase
    .from('utilisateurs')
    .select('id, identifiant, telephone, nom_complet, nom, prenom')
    .eq('id', collaborateurId)
    .eq('entreprise_id', context.entrepriseId)
    .maybeSingle()

  if (!cible) {
    return { error: 'Collaborateur introuvable.' }
  }

  const { data: authUser, error: authErr } = await adminSupabase.auth.admin.getUserById(collaborateurId)
  if (authErr || !authUser?.user?.email) {
    return { error: 'Compte d’authentification introuvable.' }
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://d-intrants.dembasolution.com'
  const redirectTo = `${siteUrl}/auth/callback?next=/update-password`

  const { data: linkData, error: linkError } = await adminSupabase.auth.admin.generateLink({
    type: 'recovery',
    email: authUser.user.email,
    options: { redirectTo },
  })

  if (linkError || !linkData?.properties?.action_link) {
    return { error: linkError?.message || 'Impossible de générer le lien de récupération.' }
  }

  const nomComplet = cible.nom_complet || `${cible.prenom || ''} ${cible.nom || ''}`.trim() || cible.identifiant || 'Collaborateur'

  return {
    success: true,
    link: linkData.properties.action_link,
    telephone: cible.telephone,
    identifiant: cible.identifiant,
    nomComplet,
  }
}

