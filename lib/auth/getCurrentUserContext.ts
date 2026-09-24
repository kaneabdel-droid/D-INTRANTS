import { cache } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { permissionModule, type ActionPermission, type Matrice } from '@/lib/permissions'

export type UserContext = {
  userId: string
  email: string | null
  entrepriseId: string
  entrepriseNom: string
  entrepriseStatut: 'actif' | 'suspendu'
  entrepriseDevise: string
  entrepriseLogoUrl: string | null
  role: 'admin_entreprise' | 'gerant'
  magasinId: string | null
  magasinNom: string | null
  permissions: Matrice
}

// Une seule requête, mémoïsée via cache() de React pour la durée de la requête
// serveur en cours : évite de refaire ce lookup dans le layout ET dans chaque
// page.tsx qui en a besoin (contrairement aux lookups répétés de SIGGIE, qui
// n'a qu'un seul niveau de tenancy et se contente d'un lookup par layout).
export const getCurrentUserContext = cache(async (): Promise<UserContext> => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const [{ data }, { data: permData }] = await Promise.all([
    supabase
      .from('utilisateurs')
      // logo_url/email/identification (migration 16) sont volontairement absents
      // de cette requête, contrairement à la page /parametres qui les lit à part :
      // getCurrentUserContext() est le chokepoint utilisé par CHAQUE page du
      // dashboard (via le layout), donc une seule colonne manquante ici casserait
      // l'app entière tant que la migration n'a pas tourné — /parametres, elle,
      // n'affecte qu'elle-même si elle échoue avant la migration.
      .select('entreprise_id, role, magasin_id, entreprises(nom, statut, devise), magasins(nom)')
      .eq('id', user.id)
      .single(),
    // current_entreprise_id() résout l'entreprise côté serveur depuis auth.uid() : peut être lancée en parallèle.
    supabase.from('parametres_permissions').select('matrice').maybeSingle(),
  ])

  if (!data) redirect('/login')

  const entreprise = Array.isArray(data.entreprises) ? data.entreprises[0] : data.entreprises
  const magasin = Array.isArray(data.magasins) ? data.magasins[0] : data.magasins

  return {
    userId: user.id,
    email: user.email ?? null,
    entrepriseId: data.entreprise_id,
    entrepriseNom: entreprise?.nom ?? '',
    entrepriseStatut: entreprise?.statut ?? 'actif',
    entrepriseDevise: entreprise?.devise ?? 'XOF',
    // Volontairement non sélectionné ci-dessus (cf. commentaire sur le select) —
    // toujours null tant que la migration 16 n'a pas tourné ; à relier après.
    entrepriseLogoUrl: null,
    role: data.role,
    magasinId: data.magasin_id,
    magasinNom: magasin?.nom ?? null,
    permissions: (permData?.matrice as Matrice | undefined) ?? {},
  }
})

// Garde-fou serveur pour les pages réservées au gérant (CRUD opérationnel) : un
// lien de nav caché n'est pas un contrôle d'accès, cf. plan §5. À appeler en
// tête de chaque page.tsx d'écriture (categories, articles, stock, ventes,
// achats, creances, dettes, tresorerie, charges).
//
// href/action (facultatifs) ajoutent la vérification de la matrice de permissions au-dessus du plafond
// « gérant » déjà imposé ci-dessus : href est le module ('/articles', '/ventes'…) et action la case cochée
// dans Paramètres → Permissions ('lire' pour une page.tsx, 'ecrire' pour une création, 'modifier' pour une
// modification ou une suppression). Omis, le comportement reste celui d'avant (plafond de rôle seul).
export async function requireGerant(href?: string, action: ActionPermission = 'ecrire'): Promise<UserContext> {
  const context = await getCurrentUserContext()
  if (context.role !== 'gerant') redirect('/dashboard')
  if (href && !permissionModule(context.permissions, href, action)) redirect('/dashboard')
  return context
}

// Symétrique pour les pages réservées à la vue consolidée (comparatif,
// rentabilité) : un gérant tapant l'URL directement est renvoyé à son propre
// tableau de bord plutôt que de voir une page pensée pour plusieurs magasins.
export async function requireAdminEntreprise(): Promise<UserContext> {
  const context = await getCurrentUserContext()
  if (context.role !== 'admin_entreprise') redirect('/dashboard')
  return context
}
