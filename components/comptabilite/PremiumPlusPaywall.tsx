'use client'

import React from 'react'
import Link from 'next/link'
import {
  Crown,
  BookOpen,
  Scale,
  FileSpreadsheet,
  Printer,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Building2
} from 'lucide-react'

export default function PremiumPlusPaywall({
  palierActuel = 'standard',
  nomEntreprise = '',
}: {
  palierActuel?: string
  nomEntreprise?: string
}) {
  const fonctionnalites = [
    {
      icon: BookOpen,
      title: 'Livre-Journal des Écritures',
      desc: 'Enregistrement chronologique en partie double conforme SYSCOHADA (Ventes, Achats, Caisse, Banque, Mobile Money, OD).',
    },
    {
      icon: Scale,
      title: 'Grand Livre & Balance Générale',
      desc: 'Relevé exhaustif des mouvements par compte et balance à 6 colonnes conforme OHADA avec vérification d’équilibre débit/crédit.',
    },
    {
      icon: FileSpreadsheet,
      title: 'États Financiers SYSCOHADA',
      desc: 'Bilan Actif & Passif (Système Normal), Compte de Résultat avec Soldes Intermédiaires de Gestion (SIG) et TFT.',
    },
    {
      icon: Printer,
      title: 'Liasse Fiscale Imprimable & Exportable',
      desc: 'Édition officielle conforme aux exigences administratives de la DGID, exportable en CSV et prête à imprimer en PDF.',
    },
    {
      icon: Sparkles,
      title: 'Synchronisation Automatique des Ventes & Achats',
      desc: 'Génération instantanée en 1 clic de toutes les écritures comptables depuis vos tickets de caisse, factures fournisseurs et trésorerie.',
    },
    {
      icon: Building2,
      title: 'Jusqu’à 5 Magasins Inclus',
      desc: 'Déployez jusqu’à 5 points de vente et entrepôts pour votre entreprise avec consolidation comptable multi-sites.',
    },
  ]

  return (
    <div className="max-w-5xl mx-auto py-8 px-4 sm:px-6">
      <div className="relative rounded-3xl border border-amber-500/30 bg-gradient-to-b from-amber-500/10 via-surface to-surface p-8 sm:p-12 shadow-xl overflow-hidden">
        {/* Glow décoratif */}
        <div className="absolute -top-24 -right-24 w-80 h-80 bg-amber-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-80 h-80 bg-primary/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 text-center max-w-3xl mx-auto space-y-4">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30 text-xs font-bold uppercase tracking-wider">
            <Crown className="w-4 h-4 text-amber-500" />
            Niveau Exclusif Premium Plus
          </div>

          <h1 className="text-3xl sm:text-4xl font-extrabold font-heading text-foreground tracking-tight">
            Comptabilité Complète & États Financiers
          </h1>

          <p className="text-base sm:text-lg text-foreground-muted leading-relaxed">
            {nomEntreprise ? `L’entreprise ${nomEntreprise}` : 'Votre compte'} est actuellement sur le forfait{' '}
            <span className="font-semibold text-foreground uppercase">{palierActuel}</span>. Le module de tenue comptable certifiée SYSCOHADA et de liasse financière est réservé aux adhérents{' '}
            <span className="font-bold text-amber-600 dark:text-amber-400">Premium Plus</span>.
          </p>

          <div className="pt-2 pb-6">
            <div className="inline-block p-4 rounded-2xl bg-surface/90 border border-surface-border shadow-sm">
              <span className="text-xs text-foreground-muted block uppercase font-medium tracking-wide">Tarif unique</span>
              <div className="flex items-baseline justify-center gap-1 mt-1">
                <span className="text-3xl sm:text-4xl font-black text-foreground font-heading">15 000</span>
                <span className="text-sm font-semibold text-foreground-muted">FCFA / mois</span>
              </div>
              <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium block mt-1">
                Jusqu’à -10% avec l’engagement annuel (13 500 FCFA/mois)
              </span>
            </div>
          </div>
        </div>

        {/* Grille des fonctionnalités */}
        <div className="relative z-10 grid sm:grid-cols-2 lg:grid-cols-3 gap-4 my-8">
          {fonctionnalites.map((f, i) => (
            <div
              key={i}
              className="p-4 rounded-2xl bg-surface/80 border border-surface-border/80 hover:border-amber-500/40 transition-colors shadow-sm flex flex-col justify-start"
            >
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-3 shrink-0">
                <f.icon className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-foreground mb-1">{f.title}</h3>
              <p className="text-xs text-foreground-muted leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>

        {/* Bouton d'action */}
        <div className="relative z-10 flex flex-col sm:flex-row items-center justify-center gap-4 pt-4 border-t border-surface-border">
          <Link
            href="/abonnement"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-bold px-8 py-3.5 shadow-lg shadow-amber-500/25 transition-all hover:scale-[1.02] text-sm"
          >
            <Crown className="w-4 h-4" />
            <span>Passer à Premium Plus (15 000 FCFA/mois)</span>
            <ArrowRight className="w-4 h-4 ml-1" />
          </Link>
          <Link
            href="/abonnement"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl border border-surface-border bg-surface px-6 py-3.5 text-sm font-semibold text-foreground hover:bg-background transition-colors"
          >
            Comparer tous les forfaits
          </Link>
        </div>

        <div className="mt-8 text-center text-xs text-foreground-muted flex items-center justify-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>Activation instantanée • Paiement sécurisé Wave, Orange Money, Carte ou Virement</span>
        </div>
      </div>
    </div>
  )
}
