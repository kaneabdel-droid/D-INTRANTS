import { redirect } from 'next/navigation'
import { getCurrentUserContext } from '@/lib/auth/getCurrentUserContext'
import { getLocale, getDictionary } from '@/dictionaries'
import ClientLayout from './ClientLayout'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // getCurrentUserContext() redirige déjà vers /login si aucune session (cf.
  // lib/auth/getCurrentUserContext.ts) — pas besoin de re-vérifier ici.
  const context = await getCurrentUserContext()

  // Abonnement expiré (ou suspension manuelle) : /compte-suspendu vit hors de
  // ce layout pour rester accessible à un admin_entreprise qui doit encore
  // pouvoir payer pour réactiver son compte (cf. lib/abonnements/reconcile.ts,
  // suspendreEntreprisesExpirees()).
  if (context.entrepriseStatut === 'suspendu') redirect('/compte-suspendu')

  const locale = await getLocale()
  const dict = await getDictionary(locale)

  return (
    <ClientLayout
      role={context.role}
      entrepriseNom={context.entrepriseNom}
      magasinNom={context.magasinNom}
      permissions={context.permissions}
      locale={locale}
      dict={dict}
    >
      {children}
    </ClientLayout>
  )
}
