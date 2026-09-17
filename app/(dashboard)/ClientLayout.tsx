'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ThemeSwitcher } from '@/components/ThemeSwitcher'
import LanguageSelector from '@/components/LanguageSelector'
import type { Dictionary } from '@/dictionaries'
import {
  LayoutDashboard,
  Tags,
  Package,
  Boxes,
  ShoppingCart,
  Truck,
  Users,
  Building2,
  HandCoins,
  Banknote,
  Wallet,
  Receipt,
  BarChart3,
  TrendingUp,
  CreditCard,
  Settings,
  Menu,
  X,
  LogOut,
} from 'lucide-react'

type Role = 'admin_entreprise' | 'gerant'

const navGerant = [
  { key: 'dashboard', href: '/dashboard', icon: LayoutDashboard },
  { key: 'categories', href: '/categories', icon: Tags },
  { key: 'articles', href: '/articles', icon: Package },
  { key: 'stock', href: '/stock', icon: Boxes },
  { key: 'clients', href: '/clients', icon: Users },
  { key: 'fournisseurs', href: '/fournisseurs', icon: Building2 },
  { key: 'ventes', href: '/ventes', icon: ShoppingCart },
  { key: 'achats', href: '/achats', icon: Truck },
  { key: 'creances', href: '/creances', icon: HandCoins },
  { key: 'dettes', href: '/dettes', icon: Banknote },
  { key: 'tresorerie', href: '/tresorerie', icon: Wallet },
  { key: 'charges', href: '/charges', icon: Receipt },
] as const

// Vue consolidée, lecture seule : pas d'accès aux modules opérationnels (cf.
// plan §5 — chaque page.tsx d'écriture redirige un admin_entreprise vers
// /dashboard même en cas d'accès direct par URL, la nav filtrée n'étant qu'un
// confort, pas un contrôle d'accès).
const navAdminEntreprise = [
  { key: 'dashboard', href: '/dashboard', icon: LayoutDashboard },
  { key: 'comparatif', href: '/comparatif', icon: BarChart3 },
  { key: 'rentabilite', href: '/rentabilite', icon: TrendingUp },
  { key: 'abonnement', href: '/abonnement', icon: CreditCard },
  { key: 'parametres', href: '/parametres', icon: Settings },
] as const

export default function ClientLayout({
  children,
  role,
  entrepriseNom,
  magasinNom,
  locale,
  dict,
}: {
  children: React.ReactNode
  role: Role
  entrepriseNom: string
  magasinNom: string | null
  locale: string
  dict: Dictionary
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const pathname = usePathname()
  const [pathnamePrecedent, setPathnamePrecedent] = useState(pathname)
  const nav = dict.nav

  const navigation = role === 'gerant' ? navGerant : navAdminEntreprise

  // Ferme la sidebar mobile à chaque changement de route (y compris navigation
  // navigateur avant/arrière, pas seulement via les liens dont l'onClick le
  // fait déjà) — ajustement d'état pendant le rendu plutôt que dans un effet,
  // pour éviter un rendu en cascade évitable (cf. règle react-hooks/set-state-in-effect).
  if (pathname !== pathnamePrecedent) {
    setPathnamePrecedent(pathname)
    setSidebarOpen(false)
  }

  return (
    <div>
      {/* Mobile sidebar */}
      <div className={`relative z-50 lg:hidden ${sidebarOpen ? '' : 'hidden'}`}>
        <div className="fixed inset-0 bg-background/80" onClick={() => setSidebarOpen(false)} />

        <div className="fixed inset-0 flex">
          <div className="relative mr-16 flex w-full max-w-xs flex-1">
            <div className="absolute left-full top-0 flex w-16 justify-center pt-5">
              <button type="button" className="-m-2.5 p-2.5" onClick={() => setSidebarOpen(false)}>
                <span className="sr-only">{nav.closeSidebar}</span>
                <X className="h-6 w-6 text-white" aria-hidden="true" />
              </button>
            </div>

            <div className="flex grow flex-col gap-y-5 overflow-y-auto bg-[var(--sidebar)] px-6 pb-4">
              <div className="flex h-16 shrink-0 items-center">
                <h1 className="text-2xl font-bold text-primary font-heading">d-intrants</h1>
              </div>
              <nav className="flex flex-1 flex-col">
                <ul role="list" className="-mx-2 space-y-1">
                  {navigation.map((item) => (
                    <li key={item.key}>
                      <Link
                        href={item.href}
                        onClick={() => setSidebarOpen(false)}
                        className={`group flex items-center gap-x-3 rounded-md p-2 text-sm leading-6 font-semibold ${
                          pathname === item.href
                            ? 'bg-primary text-white'
                            : 'text-foreground-muted hover:text-foreground hover:bg-black/5'
                        }`}
                      >
                        <item.icon className={`h-6 w-6 shrink-0 ${pathname === item.href ? 'text-white' : 'text-foreground-muted group-hover:text-foreground'}`} aria-hidden="true" />
                        <span className="truncate">{nav[item.key]}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            </div>
          </div>
        </div>
      </div>

      {/* Static sidebar for desktop */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:z-50 lg:flex lg:w-60 lg:flex-col">
        <div className="flex grow flex-col gap-y-5 overflow-y-auto bg-[var(--sidebar)] border-r border-surface-border px-4 pb-4">
          <div className="flex h-16 shrink-0 items-center">
            <h1 className="text-3xl font-bold text-primary font-heading tracking-wide">d-intrants</h1>
          </div>
          <nav className="flex flex-1 flex-col">
            <ul role="list" className="flex flex-1 flex-col gap-y-7">
              <li>
                <ul role="list" className="-mx-2 space-y-1">
                  {navigation.map((item) => (
                    <li key={item.key}>
                      <Link
                        href={item.href}
                        className={`group flex items-center gap-x-3 rounded-md p-2 text-sm leading-6 font-semibold transition-colors ${
                          pathname === item.href
                            ? 'bg-primary text-white'
                            : 'text-foreground-muted hover:text-foreground hover:bg-black/5'
                        }`}
                      >
                        <item.icon className={`h-6 w-6 shrink-0 ${pathname === item.href ? 'text-white' : 'text-foreground-muted group-hover:text-foreground'}`} aria-hidden="true" />
                        <span className="truncate">{nav[item.key]}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </li>

              <li className="mt-auto">
                <a
                  href="/logout"
                  className="group -mx-2 flex gap-x-3 rounded-md p-2 text-sm font-semibold leading-6 text-foreground-muted hover:bg-black/5 hover:text-danger transition-colors"
                >
                  <LogOut className="h-6 w-6 shrink-0 text-foreground-muted group-hover:text-danger" aria-hidden="true" />
                  {nav.logout}
                </a>
              </li>
            </ul>
          </nav>
        </div>
      </div>

      <div className="lg:pl-60">
        <div className="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-x-4 border-b border-surface-border bg-background px-4 shadow-sm sm:gap-x-6 sm:px-6 lg:px-8">
          <button type="button" className="-m-2.5 p-2.5 text-foreground-muted lg:hidden" onClick={() => setSidebarOpen(true)}>
            <span className="sr-only">{nav.openSidebar}</span>
            <Menu className="h-6 w-6" aria-hidden="true" />
          </button>

          <div className="h-6 w-px bg-surface-border lg:hidden" aria-hidden="true" />

          <div className="flex flex-1 min-w-0 gap-x-4 self-stretch lg:gap-x-6">
            <div className="flex flex-1"></div>
            <div className="flex min-w-0 items-center gap-x-3 sm:gap-x-4 lg:gap-x-6">
              <LanguageSelector currentLang={locale} />
              <ThemeSwitcher />
              <div className="min-w-0 max-w-[10rem] truncate text-sm font-semibold leading-6 text-foreground sm:max-w-xs">
                {entrepriseNom}
                {magasinNom && <span className="text-foreground-muted font-normal"> · {magasinNom}</span>}
              </div>
            </div>
          </div>
        </div>

        <main className="py-10">
          <div className="px-4 sm:px-6 lg:px-8">{children}</div>
        </main>
      </div>
    </div>
  )
}
