// Matrice de permissions du gérant (table parametres_permissions.matrice) : voir la migration
// permissions_matrice.sql pour la philosophie (restriction additive uniquement, jamais une extension du
// plafond déjà imposé par can_read_magasin()/can_write_magasin()).

export type ActionPermission = 'lire' | 'ecrire' | 'modifier'
export type Matrice = Record<string, Partial<Record<ActionPermission, boolean>>>

/** Une valeur absente de la matrice vaut « autorisé » : rétrocompatible avec une entreprise qui n'a rien configuré. */
export function permissionModule(matrice: Matrice | null | undefined, href: string, action: ActionPermission): boolean {
  const v = matrice?.[href]?.[action]
  return v !== false
}

/** Modules du gérant restreignables (hors tableau de bord, toujours accessible) — clés de dict.nav. */
export const MODULES = [
  { href: '/categories', cle: 'categories' },
  { href: '/articles', cle: 'articles' },
  { href: '/stock', cle: 'stock' },
  { href: '/clients', cle: 'clients' },
  { href: '/fournisseurs', cle: 'fournisseurs' },
  { href: '/ventes', cle: 'ventes' },
  { href: '/achats', cle: 'achats' },
  { href: '/creances', cle: 'creances' },
  { href: '/dettes', cle: 'dettes' },
  { href: '/tresorerie', cle: 'tresorerie' },
  { href: '/charges', cle: 'charges' },
] as const
