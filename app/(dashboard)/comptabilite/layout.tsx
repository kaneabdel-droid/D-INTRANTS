import React from 'react'
import Link from 'next/link'
import { getCurrentUserContext } from '@/lib/auth/getCurrentUserContext'
import PremiumPlusPaywall from '@/components/comptabilite/PremiumPlusPaywall'
import {
  BookOpen,
  FileText,
  Scale,
  FileSpreadsheet,
  Layers,
  Crown,
  Sparkles,
  BookmarkCheck,
} from 'lucide-react'

export default async function ComptabiliteLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const context = await getCurrentUserContext()
  const isPremiumPlus = context.entreprisePalier === 'premium_plus'

  // Garde-fou strict : si l'entreprise n'est pas sur le forfait Premium Plus,
  // afficher l'écran de présentation et de mise à niveau exclusif.
  if (!isPremiumPlus) {
    return (
      <PremiumPlusPaywall
        palierActuel={context.entreprisePalier}
        nomEntreprise={context.entrepriseNom}
      />
    )
  }

  const tabs = [
    { href: '/comptabilite', label: 'Livre-Journal des Écritures', icon: FileText },
    { href: '/comptabilite/grand-livre', label: 'Grand Livre des Comptes', icon: BookOpen },
    { href: '/comptabilite/balance', label: 'Balance Générale (OHADA)', icon: Scale },
    { href: '/comptabilite/plan-comptable', label: 'Plan Comptable Révisé', icon: Layers },
    { href: '/comptabilite/etats-financiers', label: 'États Financiers & Liasse Fiscale', icon: FileSpreadsheet, badge: 'SYSCOHADA' },
  ]

  return (
    <div className="space-y-6">
      {/* En-tête principal */}
      <div className="border-b border-surface-border pb-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-500/20 to-primary/20 flex items-center justify-center text-amber-600 dark:text-amber-400 border border-amber-500/30 shadow-sm">
              <BookOpen className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl sm:text-3xl font-extrabold font-heading text-foreground">
                  Comptabilité & États Financiers
                </h1>
                <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 text-[11px] font-bold">
                  <Crown className="w-3 h-3 text-amber-500" /> Premium Plus
                </span>
              </div>
              <p className="text-xs sm:text-sm text-foreground-muted mt-0.5">
                Système Normal SYSCOHADA : Pièces comptables, balance générale, compte de résultat et bilan conformes OHADA.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-3 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 text-xs font-semibold flex items-center gap-1.5 shadow-sm">
              <BookmarkCheck className="w-4 h-4 text-emerald-500" />
              <span>Forfait 15 000 FCFA/mois Actif</span>
            </span>
          </div>
        </div>
      </div>

      {/* Barre d'onglets */}
      <nav className="flex flex-wrap gap-2 border-b border-surface-border pb-3" aria-label="Navigation Comptabilité">
        {tabs.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className="group inline-flex items-center gap-2 rounded-xl border border-surface-border bg-surface px-3.5 py-2 text-xs sm:text-sm font-semibold text-foreground-muted hover:text-foreground hover:border-primary/40 hover:bg-black/5 transition-all shadow-sm"
          >
            <t.icon className="w-4 h-4 text-primary group-hover:scale-110 transition-transform" />
            <span>{t.label}</span>
            {t.badge && (
              <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.2 rounded font-bold">
                {t.badge}
              </span>
            )}
          </Link>
        ))}
      </nav>

      {/* Contenu de la page */}
      {children}
    </div>
  )
}
