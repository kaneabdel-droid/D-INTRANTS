import { redirect } from 'next/navigation'
import { LayoutDashboard, Building2, Inbox, CreditCard, Settings, LogOut } from 'lucide-react'
import { getSharedAdminUser, getLocalUser } from '@/utils/supabase/admin-identity'
import { isAdminEmail } from '@/lib/admin/auth'

// Défense en profondeur : le middleware bloque déjà /admin aux non-admins, mais on
// re-vérifie ici (même pattern que (dashboard)/layout.tsx le fera pour les rôles).
// Double vérification comme dans le middleware : identité admin partagée (SSO
// inter-produits) d'abord, session admin locale à d-intrants en secours. Les deux
// helpers sont mémoïsés par requête (cache() de React) et lancés en parallèle,
// pour ne pas payer deux aller-retours réseau séquentiels à chaque navigation.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const [sharedUser, localUser] = await Promise.all([getSharedAdminUser(), getLocalUser()])

  const user = isAdminEmail(sharedUser?.email) ? sharedUser : localUser

  if (!isAdminEmail(sharedUser?.email) && !isAdminEmail(localUser?.email)) {
    redirect(localUser ? '/dashboard' : '/admin/login')
  }

  const navItems = [
    { href: '/admin', label: 'Tableau de bord', icon: LayoutDashboard },
    { href: '/admin/entreprises', label: 'Entreprises', icon: Building2 },
    { href: '/admin/demandes', label: 'Demandes', icon: Inbox },
    { href: '/admin/paiements', label: 'Paiements', icon: CreditCard },
    { href: '/admin/config', label: 'Configuration', icon: Settings },
  ]

  return (
    <div className="min-h-screen bg-surface flex">
      <aside className="w-64 shrink-0 bg-background border-r border-surface-border flex flex-col">
        <div className="p-6 border-b border-surface-border">
          <p className="font-bold font-heading text-lg">d-intrants Admin</p>
          <p className="text-xs text-foreground-muted mt-1">{user?.email}</p>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map(({ href, label, icon: Icon }) => (
            <a
              key={href}
              href={href}
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-foreground hover:bg-surface transition-colors"
            >
              <Icon className="w-4 h-4" />
              {label}
            </a>
          ))}
        </nav>
        <div className="p-4 border-t border-surface-border">
          <a href="/admin/logout" className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-foreground-muted hover:bg-surface transition-colors">
            <LogOut className="w-4 h-4" />
            Déconnexion
          </a>
        </div>
      </aside>
      <main className="flex-1 p-8 overflow-auto">{children}</main>
    </div>
  )
}
