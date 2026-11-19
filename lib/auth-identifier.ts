import type { SupabaseClient } from '@supabase/supabase-js'

export const DOMAINE_AUTH_INTERNE = 'auth.dembasolution.internal'

/**
 * Nettoie et normalise un identifiant ou un numéro de téléphone.
 * Retire un éventuel '@' initial (affiché dans l'UI sous la forme @identifiant)
 * et convertit les espaces en tirets bas pour former un identifiant valide.
 */
export function normaliserIdentifiant(input: string): string {
  return input
    .trim()
    .replace(/^@+/, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
}

/**
 * Extrait uniquement les chiffres d'un numéro de téléphone.
 */
export function extraireChiffresTelephone(input?: string | null): string {
  if (!input) return ''
  return input.replace(/\D/g, '')
}

/**
 * Génère un e-mail synthétique sécurisé pour Supabase Auth à partir d'un identifiant ou téléphone.
 * Cet e-mail est purement technique et n'est jamais affiché aux utilisateurs finaux.
 */
export function genererEmailSynthetique(identifiantOuTelephone: string, entrepriseId?: string): string {
  const clean = normaliserIdentifiant(identifiantOuTelephone).replace(/[^a-z0-9_.-]/g, '_')
  const suffix = entrepriseId ? `.${entrepriseId.slice(0, 8)}` : ''
  return `${clean}${suffix}@${DOMAINE_AUTH_INTERNE}`
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

  if (rawInput.includes('@') && !estEmailSynthetique(rawInput)) {
    return {
      email: rawInput.toLowerCase(),
      isSynthetic: false,
    }
  }

  const cleanIdentifiant = normaliserIdentifiant(rawInput)
  const phoneDigits = extraireChiffresTelephone(rawInput)

  try {
    let userRow: { id: string } | null = null

    // 1. Recherche par identifiant ou téléphone si la colonne identifiant existe
    try {
      let query = supabaseAdmin
        .from('utilisateurs')
        .select('id, telephone')

      if (phoneDigits.length >= 7) {
        const phoneEnd = phoneDigits.slice(-9)
        query = query.or(`identifiant.ilike.${cleanIdentifiant},telephone.ilike.%${phoneEnd}%`)
      } else {
        query = query.ilike('identifiant', cleanIdentifiant)
      }

      const { data, error: qErr } = await query.limit(1).maybeSingle()
      if (!qErr && data) {
        userRow = data
      }
    } catch {
      // Tolérance si la colonne identifiant n'est pas dans le schéma cache
    }

    // 2. Fallback par téléphone direct
    if (!userRow && phoneDigits.length >= 7) {
      try {
        const phoneEnd = phoneDigits.slice(-9)
        const { data: phoneMatch } = await supabaseAdmin
          .from('utilisateurs')
          .select('id')
          .ilike('telephone', `%${phoneEnd}%`)
          .limit(1)
          .maybeSingle()
        if (phoneMatch) {
          userRow = phoneMatch
        }
      } catch {
        // Ignorer
      }
    }

    if (userRow?.id) {
      const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(userRow.id)
      if (authUser?.user?.email) {
        return {
          email: authUser.user.email,
          isSynthetic: estEmailSynthetique(authUser.user.email),
          userId: userRow.id,
        }
      }
    }
  } catch (err) {
    // Fallback en cas d'erreur de requête
  }

  return {
    email: genererEmailSynthetique(cleanIdentifiant),
    isSynthetic: true,
  }
}
