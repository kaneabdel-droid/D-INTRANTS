'use server'

import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { isAdminEmail } from '@/lib/admin/auth'
import { resoudreAuthEmail } from '@/lib/auth-identifier'

export type LoginActionResult = {
  success?: boolean
  error?: string
  redirectUrl?: string
  userContext?: {
    userId: string
    nomComplet: string
    identifiant: string
    telephone?: string | null
    email?: string | null
    role: string
    entrepriseId: string
    entrepriseNom: string
    magasinId?: string | null
    magasinNom?: string | null
    devise: string
  }
}

export async function login(formData: FormData): Promise<LoginActionResult> {
  const cookieStore = await cookies()

  // Vérification de verrouillage temporaire (anti-brute force)
  const lockoutUntil = cookieStore.get('lockout_until')?.value
  if (lockoutUntil && parseInt(lockoutUntil) > Date.now()) {
    return {
      error: 'Trop de tentatives échouées. Veuillez patienter 1 minute avant de réessayer.',
    }
  }

  const supabase = await createClient()

  const rawIdentifier = ((formData.get('email') as string) || (formData.get('identifier') as string) || '').trim()
  const password = (formData.get('password') as string) || ''

  if (!rawIdentifier) {
    return { error: 'Veuillez renseigner votre identifiant, téléphone ou e-mail.' }
  }
  if (!password) {
    return { error: 'Veuillez saisir votre mot de passe.' }
  }

  // Résolution de l'identifiant (e-mail, téléphone ou identifiant textuel)
  let resolvedEmail = rawIdentifier
  try {
    const adminSupabase = createAdminClient()
    const resolved = await resoudreAuthEmail(rawIdentifier, adminSupabase)
    resolvedEmail = resolved.email
  } catch {
    resolvedEmail = rawIdentifier
  }

  const { data: signInData, error } = await supabase.auth.signInWithPassword({
    email: resolvedEmail,
    password,
  })

  if (error) {
    const attemptsCookie = cookieStore.get('login_attempts')?.value
    const attempts = attemptsCookie ? parseInt(attemptsCookie) + 1 : 1

    if (attempts >= 3) {
      cookieStore.set('lockout_until', (Date.now() + 60_000).toString(), { maxAge: 60 })
      cookieStore.delete('login_attempts')
      return {
        error: 'Trop de tentatives échouées. Veuillez patienter 1 minute avant de réessayer.',
      }
    } else {
      cookieStore.set('login_attempts', attempts.toString(), { maxAge: 300 })
      return {
        error: 'Identifiant ou mot de passe incorrect.',
      }
    }
  }

  // Réinitialisation du suivi des tentatives
  cookieStore.delete('login_attempts')
  cookieStore.delete('lockout_until')

  // Super-admin sans entreprise : orientation vers /admin/login
  if (isAdminEmail(resolvedEmail) || (signInData?.user?.email && isAdminEmail(signInData.user.email))) {
    const { data: rattachement } = await supabase
      .from('utilisateurs')
      .select('id')
      .eq('id', signInData.user.id)
      .maybeSingle()
    if (!rattachement) {
      await supabase.auth.signOut()
      return {
        redirectUrl: `/admin/login?message=${encodeURIComponent("Compte administrateur plateforme : connectez-vous sur l'espace d'administration.")}`,
      }
    }
  }

  // Récupération du contexte complet de l'utilisateur pour le cache hors-ligne
  const { data: userProfile } = await supabase
    .from('utilisateurs')
    .select('id, identifiant, telephone, nom, prenom, nom_complet, role, entreprise_id, magasin_id, entreprises(nom, devise), magasins(nom)')
    .eq('id', signInData.user.id)
    .maybeSingle()

  const entreprise = Array.isArray(userProfile?.entreprises) ? userProfile?.entreprises[0] : userProfile?.entreprises
  const magasin = Array.isArray(userProfile?.magasins) ? userProfile?.magasins[0] : userProfile?.magasins

  const nomComplet = userProfile?.nom_complet ||
    `${userProfile?.prenom || ''} ${userProfile?.nom || ''}`.trim() ||
    userProfile?.identifiant ||
    'Collaborateur'

  revalidatePath('/', 'layout')

  return {
    success: true,
    redirectUrl: '/dashboard',
    userContext: userProfile ? {
      userId: userProfile.id,
      nomComplet,
      identifiant: userProfile.identifiant || rawIdentifier,
      telephone: userProfile.telephone,
      email: signInData.user.email,
      role: userProfile.role,
      entrepriseId: userProfile.entreprise_id,
      entrepriseNom: entreprise?.nom || '',
      magasinId: userProfile.magasin_id,
      magasinNom: magasin?.nom || null,
      devise: entreprise?.devise || 'XOF',
    } : undefined,
  }
}
