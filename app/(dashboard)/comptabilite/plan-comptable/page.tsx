import React from 'react'
import { Layers, Plus, Search } from 'lucide-react'
import { getPlanComptable, ajouterComptePlan } from '../actions'

export default async function PlanComptablePage() {
  const { plan, error } = await getPlanComptable()

  const classesLabels: Record<number, string> = {
    1: 'Classe 1 — Capitaux Propres et Dettes Financières',
    2: 'Classe 2 — Actifs Immobilisés',
    3: 'Classe 3 — Stocks et Encours',
    4: 'Classe 4 — Comptes de Tiers (Clients, Fournisseurs, État, Personnel)',
    5: 'Classe 5 — Comptes de Trésorerie (Banque, Caisse, Mobile Money)',
    6: 'Classe 6 — Comptes de Charges des Activités Ordinaires',
    7: 'Classe 7 — Comptes de Produits des Activités Ordinaires',
    8: 'Classe 8 — Comptes des Hors Activités Ordinaires (HAO)',
  }

  // Grouper par classe
  const comptesParClasse: Record<number, any[]> = {}
  for (let i = 1; i <= 8; i++) comptesParClasse[i] = []

  for (const c of plan || []) {
    const cl = Number(c.classe) || Number(c.compte.charAt(0)) || 1
    if (!comptesParClasse[cl]) comptesParClasse[cl] = []
    comptesParClasse[cl].push(c)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold font-heading text-foreground">
            Plan Comptable Général SYSCOHADA Révisé
          </h2>
          <p className="text-xs text-foreground-muted">
            Référentiel officiel normalisé des comptes de l'OHADA (Classes 1 à 8) avec sous-comptes personnalisables.
          </p>
        </div>
      </div>

      {/* Accordéons / Listes des Classes */}
      <div className="space-y-4">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((cl) => {
          const comptes = comptesParClasse[cl] || []
          return (
            <div key={cl} className="bg-surface rounded-2xl border border-surface-border shadow-sm overflow-hidden">
              <div className="p-4 bg-sidebar/50 border-b border-surface-border flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">
                    {cl}
                  </div>
                  <span className="text-sm font-bold text-foreground">{classesLabels[cl]}</span>
                </div>
                <span className="text-xs text-foreground-muted font-semibold">{comptes.length} compte(s)</span>
              </div>

              {comptes.length === 0 ? (
                <div className="p-4 text-xs text-foreground-muted italic">Aucun compte dans cette classe.</div>
              ) : (
                <div className="divide-y divide-surface-border">
                  {comptes.map((c: any) => (
                    <div key={c.id || c.compte} className="p-3 sm:px-4 flex items-center justify-between hover:bg-black/5 text-xs">
                      <div className="flex items-center gap-3">
                        <span className="font-mono font-bold text-primary w-20">{c.compte}</span>
                        <span className="font-medium text-foreground">{c.libelle}</span>
                      </div>
                      <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold bg-surface-border/40 text-foreground-muted">
                        {c.type || 'Standard'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
