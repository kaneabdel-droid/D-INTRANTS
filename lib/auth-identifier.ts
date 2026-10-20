import type { SupabaseClient } from '@supabase/supabase-js'

export const DOMAINE_AUTH_INTERNE = 'auth.dembasolution.internal'

/**
 * Nettoie et normalise un identifiant ou un numéro de téléphone.
 */
export function normaliserIdentifiant(input: string): string {
  return input.trim().toLowerCase()
}

/**
 * Génère un e-mail synthétique sécurisé pour Supabase Auth à partir d'un identifiant ou téléphone.
 * Cet e-mail est purement technique et n'est jamais affiché aux utilisateurs finaux.
 */
export function genererEmailSynthetique(identifiantOuTelephone: string): string {
  const clean = normaliserIdentifiant(identifiantOuTelephone).replace(/[^a-z0-9_.-]/g, '_')
  return `${clean}@${DOMAINE_AUTH_INTERNE}`
}

/**
 * Détermine si une adresse e-mail est un alias synthétique interne.
 */
export function estEmailSynthetique(email?: string | null): boolean {
  if (!email) return false
  return email.toLowerCase().endsWith(`@${DOMAINE_AUTH_INTERNE}`)
}

/**
 * Résout une chaîne de connexion saisie (e-mail réel, pseudo/identifiant ou téléphone)
 * vers l'adresse e-mail auth correspondante dans Supabase.
 */
export async function resoudreAuthEmail(
  identifiantOuEmail: string,
  supabaseAdmin: SupabaseClient
): Promise<{ email: string; isSynthetic: boolean; userId?: string }> {
  const rawInput = identifiantOuEmail.trim()

  // 1. Si la saisie contient un '@' et n'est pas notre domaine interne, c'est un e-mail réel classique
  if (rawInput.includes('@') && !estEmailSynthetique(rawInput)) {
    return {
      email: rawInput.toLowerCase(),
      isSynthetic: false,
    }
  }

  const cleanIdentifiant = normaliserIdentifiant(rawInput)

  // 2. Recherche par identifiant ou par numéro de téléphone dans public.utilisateurs
  const { data: userRow } = await supabaseAdmin
    .from('utilisateurs')
    .select('id, identifiant, telephone')
    .or(`identifiant.ilike.${cleanIdentifiant},telephone.eq.${cleanIdentifiant}`)
    .maybeSingle()

  if (userRow?.id) {
    // Récupérer le compte auth associé
    const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(userRow.id)
    if (authUser?.user?.email) {
      return {
        email: authUser.user.email,
        isSynthetic: estEmailSynthetique(authUser.user.email),
        userId: userRow.id,
      }
    }
  }

  // 3. Fallback : si l'identifiant n'est pas encore trouvé en table, on teste l'alias synthétique
  return {
    email: genererEmailSynthetique(cleanIdentifiant),
    isSynthetic: true,
  }
}
