import React from 'react'
import Link from 'next/link'
import { Scale, CheckCircle2, AlertCircle, Printer, BookOpen } from 'lucide-react'
import { getBalance, getExercices } from '../actions'
import PrintSectionButton from '@/components/PrintSectionButton'

export default async function BalancePage(props: {
  searchParams: Promise<{ exercice?: string }>
}) {
  const searchParams = await props.searchParams
  const selectedExercice = searchParams.exercice

  const [{ balance, totaux, error }, { exercices }] = await Promise.all([
    getBalance(selectedExercice),
    getExercices(),
  ])

  const formatCFA = (val: number) =>
    new Intl.NumberFormat('fr-FR', { style: 'decimal', maximumFractionDigits: 0 }).format(val) + ' FCFA'

  const estEquilibre = totaux && Math.abs(totaux.debit - totaux.credit) < 0.01 && Math.abs(totaux.soldeDebiteur - totaux.soldeCrediteur) < 0.01

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold font-heading text-foreground">
            Balance Générale des Comptes (OHADA)
          </h2>
          <p className="text-xs text-foreground-muted">
            Synthèse comptable à 6 colonnes : contrôle de la stricte égalité entre total débits et total crédits.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <PrintSectionButton sectionId="balance-print" label="Imprimer la Balance" />
        </div>
      </div>

      {/* Cartes KPI */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-surface rounded-2xl p-4 border border-surface-border shadow-sm">
          <span className="text-xs text-foreground-muted font-medium">Mouvements Débit & Crédit</span>
          <p className="text-2xl font-bold text-foreground mt-1">{formatCFA(totaux?.debit || 0)}</p>
          <span className="text-[11px] text-foreground-muted">Cumul total des flux enregistrés</span>
        </div>
        <div className="bg-surface rounded-2xl p-4 border border-surface-border shadow-sm">
          <span className="text-xs text-foreground-muted font-medium">Masse des Soldes Débiteurs</span>
          <p className="text-2xl font-bold text-primary mt-1">{formatCFA(totaux?.soldeDebiteur || 0)}</p>
          <span className="text-[11px] text-foreground-muted">Emplois / Actifs / Charges</span>
        </div>
        <div className="bg-surface rounded-2xl p-4 border border-surface-border shadow-sm">
          <span className="text-xs text-foreground-muted font-medium">Contrôle d'Équilibre</span>
          <div className="mt-1 flex items-center gap-1.5">
            {estEquilibre ? (
              <span className="text-lg font-bold text-emerald-600 flex items-center gap-1">
                <CheckCircle2 className="w-5 h-5" /> Parfaitement Équilibrée
              </span>
            ) : (
              <span className="text-lg font-bold text-amber-600 flex items-center gap-1">
                <AlertCircle className="w-5 h-5" /> Déséquilibre Détecté
              </span>
            )}
          </div>
          <span className="text-[11px] text-emerald-600 font-medium">Total Débits = Total Crédits</span>
        </div>
      </div>

      {/* Tableau de la Balance */}
      <div id="balance-print" className="bg-surface rounded-2xl border border-surface-border shadow-sm overflow-hidden">
        <div className="p-4 border-b border-surface-border flex justify-between items-center bg-sidebar/50">
          <div className="flex items-center gap-2">
            <Scale className="w-4 h-4 text-primary" />
            <span className="text-sm font-bold text-foreground">Balance des Comptes ({balance.length} comptes mouvementés)</span>
          </div>
          <span className="text-xs text-foreground-muted">Norme OHADA Révisée</span>
        </div>

        {balance.length === 0 ? (
          <div className="p-12 text-center text-foreground-muted text-sm">
            Aucun compte mouvementé pour l'instant.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs min-w-[750px]">
              <thead className="bg-sidebar border-b border-surface-border text-foreground-muted">
                <tr>
                  <th className="p-3 w-28">N° Compte</th>
                  <th className="p-3">Intitulé du Compte</th>
                  <th className="p-3 w-32 text-right">Mouvements Débit</th>
                  <th className="p-3 w-32 text-right">Mouvements Crédit</th>
                  <th className="p-3 w-32 text-right">Solde Débiteur</th>
                  <th className="p-3 w-32 text-right">Solde Créditeur</th>
                  <th className="p-3 w-16 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border">
                {balance.map((b) => (
                  <tr key={b.compte} className="hover:bg-black/5">
                    <td className="p-3 font-mono font-bold text-foreground">{b.compte}</td>
                    <td className="p-3 font-medium text-foreground">{b.libelle}</td>
                    <td className="p-3 text-right font-semibold text-primary">
                      {b.debit > 0 ? formatCFA(b.debit) : '-'}
                    </td>
                    <td className="p-3 text-right font-semibold text-secondary">
                      {b.credit > 0 ? formatCFA(b.credit) : '-'}
                    </td>
                    <td className="p-3 text-right font-bold text-emerald-600">
                      {b.soldeDebiteur > 0 ? formatCFA(b.soldeDebiteur) : '-'}
                    </td>
                    <td className="p-3 text-right font-bold text-amber-600">
                      {b.soldeCrediteur > 0 ? formatCFA(b.soldeCrediteur) : '-'}
                    </td>
                    <td className="p-3 text-center">
                      <Link
                        href={`/comptabilite/grand-livre?compte=${b.compte}`}
                        className="text-primary hover:underline text-[11px] font-semibold"
                        title="Voir le relevé de compte dans le grand livre"
                      >
                        Relevé
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-sidebar border-t border-surface-border font-bold">
                <tr>
                  <td colSpan={2} className="p-3 text-right text-foreground">
                    Totaux Généraux :
                  </td>
                  <td className="p-3 text-right text-primary">{formatCFA(totaux?.debit || 0)}</td>
                  <td className="p-3 text-right text-secondary">{formatCFA(totaux?.credit || 0)}</td>
                  <td className="p-3 text-right text-emerald-600">{formatCFA(totaux?.soldeDebiteur || 0)}</td>
                  <td className="p-3 text-right text-amber-600">{formatCFA(totaux?.soldeCrediteur || 0)}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
