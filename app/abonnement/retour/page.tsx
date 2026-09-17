import { requireAdminEntreprise } from '@/lib/auth/getCurrentUserContext'
import RetourClient from './RetourClient'

// Volontairement HORS du groupe (dashboard) : ce layout redirige vers
// /compte-suspendu tant que l'entreprise est suspendue (cf.
// app/(dashboard)/layout.tsx), ce qui court-circuiterait cette page de
// confirmation pile dans le cas qui l'utilise le plus — un paiement fait
// DEPUIS /compte-suspendu pour lever la suspension. requireAdminEntreprise()
// ne vérifie que le rôle, pas le statut de l'entreprise : sûr à appeler ici.
export default async function RetourAbonnementPage({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  await requireAdminEntreprise()
  const { id } = await searchParams
  return <RetourClient abonnementId={id ?? null} />
}
