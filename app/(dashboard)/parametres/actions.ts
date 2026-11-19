'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { requireAdminEntreprise } from '@/lib/auth/getCurrentUserContext'
import { estDeviseValide } from '@/lib/currency'
import { PALIERS, type PalierCode } from '@/lib/abonnements/paliers'
import {
  genererEmailSynthetique,
  normaliserIdentifiant,
  extraireChiffresTelephone,
} from '@/lib/auth-identifier'
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

export async function enregistrerPermissions(matrice: Matrice): Promise<ActionResult> {
  const context = await requireAdminEntreprise()
  const supabase = await createClient()

  const { error } = await supabase
    .from('parametres_permissions')
    .upsert({
      entreprise_id: context.entrepriseId,
      matrice,
      updated_par: context.userId,
      updated_at: new Date().toISOString(),
    })
  if (error) return { error: error.message }

  revalidatePath('/', 'layout')
  return { success: true }
}

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
    doit_changer_mot_de_passe?: boolean
  }
}

/**
 * Création d'un collaborateur par l'administrateur de l'entreprise
 * - Identifiant par défaut basé sur le numéro de téléphone normalisé
 * - Option force changement de mot de passe à la première connexion
 * - Contrôle strict des quotas d'utilisateurs autorisés selon la formule
 */
export async function creerCollaborateur(formData: FormData): Promise<CreerCollaborateurResult> {
  try {
    const context = await requireAdminEntreprise()
    const adminSupabase = createAdminClient()

    // 1. Récupération des informations de palier et vérification des quotas
    const { data: entRow } = await adminSupabase
      .from('entreprises')
      .select('palier, nom')
      .eq('id', context.entrepriseId)
      .single()

    const isDemo = (entRow?.nom ?? '').toLowerCase().includes('sunu')
    const palierCode: PalierCode = isDemo ? 'premium_plus' : ((entRow?.palier as PalierCode) ?? 'standard')
    const palierInfo = PALIERS[palierCode] || PALIERS.standard

    const { count: nombreUtilisateurs } = await adminSupabase
      .from('utilisateurs')
      .select('id', { count: 'exact', head: true })
      .eq('entreprise_id', context.entrepriseId)

    const nbActuel = nombreUtilisateurs ?? 0
    if (palierInfo.utilisateursMax !== null && nbActuel >= palierInfo.utilisateursMax) {
      return {
        error: `Votre formule ${palierInfo.nom} est limitée à ${palierInfo.utilisateursMax} utilisateur(s) (${nbActuel}/${palierInfo.utilisateursMax} atteints). Rendez-vous dans l'onglet Abonnement pour passer à une formule supérieure et ajouter d'autres collaborateurs.`,
      }
    }

    const telephone = (formData.get('telephone') as string)?.trim() || null
    let rawIdentifiant = (formData.get('identifiant') as string)?.trim() || ''

    // Identifiant par défaut = téléphone si non renseigné
    if (!rawIdentifiant && telephone) {
      rawIdentifiant = extraireChiffresTelephone(telephone)
    }

    if (!rawIdentifiant) {
      return { error: 'Veuillez saisir un numéro de téléphone ou un identifiant.' }
    }

    const identifiant = normaliserIdentifiant(rawIdentifiant)
    if (identifiant.length < 3) {
      return { error: "L'identifiant doit comporter au moins 3 caractères." }
    }

    const password = (formData.get('password') as string) || ''
    if (!password || password.length < 6) {
      return { error: 'Le mot de passe provisoire doit comporter au moins 6 caractères.' }
    }

    const nomComplet = (formData.get('nom_complet') as string)?.trim() || null
    const emailInput = (formData.get('email') as string)?.trim() || ''
    const roleInput = ((formData.get('role') as string)?.trim()) || 'gerant'
    const magasinId = (formData.get('magasin_id') as string)?.trim() || null
    const doitChangerMdp = formData.get('doit_changer_mot_de_passe') === 'on' || formData.get('doit_changer_mot_de_passe') === 'true'

    // Vérifier l'affectation au magasin pour les rôles magasins
    if (roleInput !== 'admin_entreprise' && !magasinId) {
      const { data: mags } = await adminSupabase
        .from('magasins')
        .select('id')
        .eq('entreprise_id', context.entrepriseId)
        .eq('statut', 'actif')
        .limit(1)

      if (mags && mags.length > 0) {
        return { error: 'Veuillez sélectionner le magasin auquel sera affecté ce collaborateur.' }
      }
    }

    const authEmail = emailInput ? emailInput.toLowerCase() : genererEmailSynthetique(identifiant, context.entrepriseId)

    // Vérification unicité identifiant / téléphone au sein de l'entreprise (tolérante au schéma cache)
    let existant: { id: string; entreprise_id: string } | null = null
    const cleanPhone = telephone ? extraireChiffresTelephone(telephone) : null

    try {
      let existantQuery = adminSupabase.from('utilisateurs').select('id, entreprise_id')
      if (cleanPhone && cleanPhone.length >= 6) {
        existantQuery = existantQuery.or(`identifiant.ilike.${identifiant},telephone.ilike.%${cleanPhone.slice(-9)}%`)
      } else {
        existantQuery = existantQuery.ilike('identifiant', identifiant)
      }
      const { data: exData, error: exErr } = await existantQuery.limit(1).maybeSingle()
      if (!exErr && exData) {
        existant = exData
      }
    } catch {
      // Ignorer si la colonne identifiant n'est pas encore dans le schéma cache
    }

    if (!existant && cleanPhone && cleanPhone.length >= 6) {
      try {
        const { data: phoneRow } = await adminSupabase
          .from('utilisateurs')
          .select('id, entreprise_id')
          .ilike('telephone', `%${cleanPhone.slice(-9)}%`)
          .limit(1)
          .maybeSingle()
        if (phoneRow) {
          existant = phoneRow
        }
      } catch {
        // Ignorer
      }
    }

    if (existant && existant.entreprise_id === context.entrepriseId) {
      return { error: 'Cet identifiant ou numéro de téléphone est déjà attribué à un collaborateur de votre entreprise.' }
    }

    // Création auth.users
    let authUserId: string | null = null

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
        doit_changer_mot_de_passe: doitChangerMdp,
      },
    })

    if (authCreated?.user?.id) {
      authUserId = authCreated.user.id
    } else if (authError) {
      if (authError.message.toLowerCase().includes('already') || authError.message.toLowerCase().includes('registered')) {
        const { data: { users } } = await adminSupabase.auth.admin.listUsers({ perPage: 1000 })
        const existingUser = users.find((u) => u.email?.toLowerCase() === authEmail.toLowerCase())

        if (existingUser) {
          const { data: profilExistant } = await adminSupabase
            .from('utilisateurs')
            .select('id, entreprise_id')
            .eq('id', existingUser.id)
            .maybeSingle()

          if (!profilExistant || profilExistant.entreprise_id === context.entrepriseId) {
            const { error: updateErr } = await adminSupabase.auth.admin.updateUserById(existingUser.id, {
              password,
              user_metadata: {
                role: roleInput,
                identifiant,
                telephone,
                nom_complet: nomComplet,
                entreprise_id: context.entrepriseId,
                magasin_id: roleInput === 'admin_entreprise' ? null : magasinId,
                doit_changer_mot_de_passe: doitChangerMdp,
              },
            })
            if (updateErr) {
              return { error: `Impossible de configurer le compte : ${updateErr.message}` }
            }
            authUserId = existingUser.id
          } else {
            return {
              error: `L'identifiant "${rawIdentifiant}" est déjà utilisé. Veuillez en choisir un autre.`,
            }
          }
        } else {
          return {
            error: `L'identifiant "${rawIdentifiant}" est déjà utilisé. Veuillez en choisir un autre.`,
          }
        }
      } else {
        return { error: `Échec de création du compte : ${authError.message}` }
      }
    }

    if (!authUserId) {
      return { error: "Échec d'obtention de l'identifiant du compte." }
    }

    // 3. Mise à jour / insertion dans public.utilisateurs (avec fallback résilient)
    const parts = (nomComplet || '').trim().split(/\s+/)
    const prenom = parts[0] || null
    const nom = parts.slice(1).join(' ') || null

    const basePayload: Record<string, any> = {
      id: authUserId,
      entreprise_id: context.entrepriseId,
      magasin_id: roleInput === 'admin_entreprise' ? null : magasinId,
      role: roleInput,
      nom,
      prenom,
      telephone,
    }

    const payloadUtilisateur: Record<string, any> = {
      ...basePayload,
      identifiant,
      nom_complet: nomComplet,
    }

    if (doitChangerMdp) {
      payloadUtilisateur.doit_changer_mot_de_passe = true
    }

    let { error: userError } = await adminSupabase
      .from('utilisateurs')
      .upsert(payloadUtilisateur)

    if (userError && (
      userError.message?.toLowerCase().includes('identifiant') ||
      userError.message?.toLowerCase().includes('nom_complet') ||
      userError.message?.toLowerCase().includes('doit_changer_mot_de_passe')
    )) {
      const retry = await adminSupabase.from('utilisateurs').upsert(basePayload)
      userError = retry.error
    }

    if (userError) {
      if (authCreated?.user?.id) {
        await adminSupabase.auth.admin.deleteUser(authCreated.user.id).catch(() => {})
      }
      return { error: `Échec d'enregistrement du profil : ${userError.message}` }
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
        id: authUserId,
        role: roleInput,
        identifiant,
        telephone,
        nom,
        prenom,
        nom_complet: nomComplet,
        magasin_id: roleInput === 'admin_entreprise' ? null : magasinId,
        magasin_nom: magasinNom,
        doit_changer_mot_de_passe: doitChangerMdp,
      },
    }
  } catch (err: unknown) {
    console.error('Erreur inattendue dans creerCollaborateur:', err)
    const msg = err instanceof Error ? err.message : 'Une erreur inattendue est survenue.'
    return { error: msg }
  }
}

/**
 * Modification d'un collaborateur existant (rôle, magasin assigné, identifiant, téléphone, nom)
 */
export async function modifierCollaborateur(formData: FormData): Promise<{ success?: boolean; error?: string }> {
  try {
    const context = await requireAdminEntreprise()
    const adminSupabase = createAdminClient()

    const collaborateurId = (formData.get('id') as string)?.trim()
    if (!collaborateurId) return { error: 'Identifiant du collaborateur manquant.' }

    const { data: cible } = await adminSupabase
      .from('utilisateurs')
      .select('id, role')
      .eq('id', collaborateurId)
      .eq('entreprise_id', context.entrepriseId)
      .maybeSingle()

    if (!cible) return { error: 'Collaborateur introuvable.' }

    const nomComplet = (formData.get('nom_complet') as string)?.trim() || null
    const telephone = (formData.get('telephone') as string)?.trim() || null
    const rawIdentifiant = (formData.get('identifiant') as string)?.trim()
    const identifiant = rawIdentifiant ? normaliserIdentifiant(rawIdentifiant) : null
    const role = ((formData.get('role') as string)?.trim()) || cible.role
    const magasinId = (formData.get('magasin_id') as string)?.trim() || null
    const doitChangerMdp = formData.get('doit_changer_mot_de_passe') === 'on' || formData.get('doit_changer_mot_de_passe') === 'true'

    const parts = (nomComplet || '').trim().split(/\s+/)
    const prenom = parts[0] || null
    const nom = parts.slice(1).join(' ') || null

    const baseUpdate: Record<string, any> = {
      nom,
      prenom,
      telephone,
      role,
      magasin_id: role === 'admin_entreprise' ? null : magasinId,
    }

    const updatePayload: Record<string, any> = {
      ...baseUpdate,
      nom_complet: nomComplet,
      identifiant,
    }

    if (doitChangerMdp !== undefined) {
      updatePayload.doit_changer_mot_de_passe = doitChangerMdp
    }

    let { error: updErr } = await adminSupabase
      .from('utilisateurs')
      .update(updatePayload)
      .eq('id', collaborateurId)
      .eq('entreprise_id', context.entrepriseId)

    if (updErr && (
      updErr.message?.toLowerCase().includes('identifiant') ||
      updErr.message?.toLowerCase().includes('nom_complet') ||
      updErr.message?.toLowerCase().includes('doit_changer_mot_de_passe')
    )) {
      const retry = await adminSupabase
        .from('utilisateurs')
        .update(baseUpdate)
        .eq('id', collaborateurId)
        .eq('entreprise_id', context.entrepriseId)
      updErr = retry.error
    }

    if (updErr) return { error: updErr.message }

    await adminSupabase.auth.admin.updateUserById(collaborateurId, {
      user_metadata: {
        nom_complet: nomComplet,
        telephone,
        identifiant,
        role,
        magasin_id: role === 'admin_entreprise' ? null : magasinId,
        doit_changer_mot_de_passe: doitChangerMdp,
      },
    }).catch(() => {})

    revalidatePath('/parametres')
    return { success: true }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erreur lors de la modification.'
    return { error: msg }
  }
}

/**
 * Réinitialisation directe de mot de passe par l'administrateur
 */
export async function reinitialiserMotDePasseCollaborateur(formData: FormData): Promise<{ success?: boolean; error?: string }> {
  try {
    const context = await requireAdminEntreprise()
    const adminSupabase = createAdminClient()

    const collaborateurId = (formData.get('id') as string)?.trim()
    const newPassword = (formData.get('password') as string) || ''
    const doitChanger = formData.get('doit_changer_mot_de_passe') === 'on' || formData.get('doit_changer_mot_de_passe') === 'true'

    if (!collaborateurId) return { error: 'Identifiant collaborateur manquant.' }
    if (!newPassword || newPassword.length < 6) {
      return { error: 'Le nouveau mot de passe doit comporter au moins 6 caractères.' }
    }

    const { data: cible } = await adminSupabase
      .from('utilisateurs')
      .select('id')
      .eq('id', collaborateurId)
      .eq('entreprise_id', context.entrepriseId)
      .maybeSingle()

    if (!cible) return { error: 'Collaborateur introuvable.' }

    const { error: authErr } = await adminSupabase.auth.admin.updateUserById(collaborateurId, {
      password: newPassword,
      user_metadata: {
        doit_changer_mot_de_passe: doitChanger,
      },
    })

    if (authErr) return { error: authErr.message }

    try {
      await adminSupabase
        .from('utilisateurs')
        .update({ doit_changer_mot_de_passe: doitChanger })
        .eq('id', collaborateurId)
    } catch {
      // Tolérance si la colonne doit_changer_mot_de_passe n'existe pas en base
    }

    revalidatePath('/parametres')
    return { success: true }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erreur lors de la réinitialisation.'
    return { error: msg }
  }
}

export async function supprimerCollaborateur(collaborateurId: string): Promise<{ success?: boolean; error?: string }> {
  const context = await requireAdminEntreprise()

  if (collaborateurId === context.userId) {
    return { error: 'Vous ne pouvez pas supprimer votre propre compte administrateur.' }
  }

  const adminSupabase = createAdminClient()

  const { data: cible } = await adminSupabase
    .from('utilisateurs')
    .select('id, role')
    .eq('id', collaborateurId)
    .eq('entreprise_id', context.entrepriseId)
    .maybeSingle()

  if (!cible) {
    return { error: 'Collaborateur introuvable dans votre entreprise.' }
  }

  const { error: delProfileError } = await adminSupabase
    .from('utilisateurs')
    .delete()
    .eq('id', collaborateurId)
    .eq('entreprise_id', context.entrepriseId)

  if (delProfileError) {
    return { error: delProfileError.message }
  }

  await adminSupabase.auth.admin.deleteUser(collaborateurId).catch(() => {})

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

  let cible: any = null
  try {
    const { data: cData } = await adminSupabase
      .from('utilisateurs')
      .select('id, telephone, nom, prenom')
      .eq('id', collaborateurId)
      .eq('entreprise_id', context.entrepriseId)
      .maybeSingle()
    cible = cData
  } catch {
    // Ignorer
  }

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

/**
 * Création d'un magasin par l'administrateur de l'entreprise
 * - Contrôle strict du quota de magasins autorisés selon la formule
 */
export async function creerMagasin(formData: FormData): Promise<{
  success?: boolean
  error?: string
  magasin?: { id: string; nom: string; adresse?: string | null; telephone?: string | null }
}> {
  try {
    const context = await requireAdminEntreprise()
    const adminSupabase = createAdminClient()

    const nom = (formData.get('nom') as string)?.trim()
    const adresse = (formData.get('adresse') as string)?.trim() || null
    const telephone = (formData.get('telephone') as string)?.trim() || null

    if (!nom) {
      return { error: 'Le nom du magasin est obligatoire.' }
    }

    const { data: entRow } = await adminSupabase
      .from('entreprises')
      .select('palier, nom')
      .eq('id', context.entrepriseId)
      .single()

    const isDemo = (entRow?.nom ?? '').toLowerCase().includes('sunu')
    const palierCode: PalierCode = isDemo ? 'premium_plus' : ((entRow?.palier as PalierCode) ?? 'standard')
    const palierInfo = PALIERS[palierCode] || PALIERS.standard

    const { count: nombreMagasins } = await adminSupabase
      .from('magasins')
      .select('id', { count: 'exact', head: true })
      .eq('entreprise_id', context.entrepriseId)
      .eq('statut', 'actif')

    const nbActuel = nombreMagasins ?? 0
    if (nbActuel >= palierInfo.magasinsMax) {
      return {
        error: `Votre formule ${palierInfo.nom} est limitée à ${palierInfo.magasinsMax} magasin(s) (${nbActuel}/${palierInfo.magasinsMax} atteints). Rendez-vous dans l'onglet Abonnement pour passer à une formule supérieure et ouvrir un nouveau point de vente.`,
      }
    }

    const { data: mag, error: magErr } = await adminSupabase
      .from('magasins')
      .insert({
        entreprise_id: context.entrepriseId,
        nom,
        adresse,
        telephone,
        statut: 'actif',
      })
      .select('id, nom, adresse, telephone')
      .single()

    if (magErr) {
      return { error: `Échec de création du magasin : ${magErr.message}` }
    }

    revalidatePath('/parametres')
    return {
      success: true,
      magasin: mag,
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erreur lors de la création du magasin.'
    return { error: msg }
  }
}
