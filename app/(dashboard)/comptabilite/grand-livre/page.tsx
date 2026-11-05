import React from 'react'
import Link from 'next/link'
import { BookOpen, Filter, ArrowRight, Scale, CheckCircle2 } from 'lucide-react'
import { getGrandLivre, getPlanComptable, getExercices } from '../actions'
import PrintSectionButton from '@/components/PrintSectionButton'

export default async function GrandLivrePage(props: {
  searchParams: Promise<{ compte?: string; exercice?: string }>
}) {
  const searchParams = await props.searchParams
  const selectedCompte = searchParams.compte || 'tous'
  const selectedExercice = searchParams.exercice

  const [{ lignes, error }, { plan }] = await Promise.all([
    getGrandLivre(selectedCompte, selectedExercice),
    getPlanComptable(),
  ])

  const mapPlan = new Map((plan || []).map((p: any) => [p.compte, p.libelle]))

  const formatCFA = (val: number) =>
    new Intl.NumberFormat('fr-FR', { style: 'decimal', maximumFractionDigits: 0 }).format(val) + ' FCFA'

  let soldeCumule = 0
  const lignesAvecSolde = (lignes || []).map((l: any) => {
    const debit = Number(l.debit) || 0
    const credit = Number(l.credit) || 0
    soldeCumule += debit - credit
    return {
      ...l,
      debit,
      credit,
      soldeProgressif: soldeCumule,
    }
  })

  const totalDebit = (lignes || []).reduce((s, l: any) => s + (Number(l.debit) || 0), 0)
  const totalCredit = (lignes || []).reduce((s, l: any) => s + (Number(l.credit) || 0), 0)
  const soldeFinal = totalDebit - totalCredit

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold font-heading text-foreground">
            Grand Livre Général des Comptes
          </h2>
          <p className="text-xs text-foreground-muted">
            Relevé chronologique et exhaustif de tous les débits, crédits et soldes cumulés compte par compte.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <PrintSectionButton sectionId="grand-livre-print" label="Imprimer le Grand Livre" />
        </div>
      </div>

      {/* Cartes KPI */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-surface rounded-2xl p-4 border border-surface-border shadow-sm">
          <span className="text-xs text-foreground-muted font-medium">Mouvements Débit</span>
          <p className="text-2xl font-bold text-primary mt-1">{formatCFA(totalDebit)}</p>
          <span className="text-[11px] text-foreground-muted">Total des imputations débitrices</span>
        </div>
        <div className="bg-surface rounded-2xl p-4 border border-surface-border shadow-sm">
          <span className="text-xs text-foreground-muted font-medium">Mouvements Crédit</span>
          <p className="text-2xl font-bold text-secondary mt-1">{formatCFA(totalCredit)}</p>
          <span className="text-[11px] text-foreground-muted">Total des imputations créditrices</span>
        </div>
        <div className="bg-surface rounded-2xl p-4 border border-surface-border shadow-sm">
          <span className="text-xs text-foreground-muted font-medium">Solde Net Final</span>
          <p className={`text-2xl font-bold mt-1 ${soldeFinal >= 0 ? 'text-emerald-600' : 'text-amber-600'}`}>
            {formatCFA(Math.abs(soldeFinal))} {soldeFinal >= 0 ? '(Débiteur)' : '(Créditeur)'}
          </p>
          <span className="text-[11px] text-foreground-muted">Position nette du compte</span>
        </div>
      </div>

      {/* Sélecteur de compte */}
      <div className="flex items-center gap-3 bg-surface p-4 rounded-2xl border border-surface-border shadow-sm">
        <Filter className="w-4 h-4 text-primary shrink-0" />
        <span className="text-xs font-semibold text-foreground-muted shrink-0">Filtrer par Compte :</span>
        <form method="get" className="flex-1 flex gap-2">
          <select
            name="compte"
            defaultValue={selectedCompte}
            className="w-full max-w-md rounded-xl bg-background border border-surface-border px-3 py-1.5 text-xs text-foreground font-medium"
          >
            <option value="tous">Tous les comptes (Vue globale)</option>
            {(plan || []).map((p: any) => (
              <option key={p.compte} value={p.compte}>
                {p.compte} — {p.libelle}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="rounded-xl bg-primary text-white text-xs px-4 py-1.5 font-semibold hover:bg-primary/90"
          >
            Afficher
          </button>
        </form>
      </div>

      {/* Tableau du Grand Livre */}
      <div id="grand-livre-print" className="bg-surface rounded-2xl border border-surface-border shadow-sm overflow-hidden">
        <div className="p-4 border-b border-surface-border flex justify-between items-center bg-sidebar/50">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-primary" />
            <span className="text-sm font-bold text-foreground">
              {selectedCompte === 'tous'
                ? 'Grand Livre Complet'
                : `Grand Livre : Compte ${selectedCompte} — ${mapPlan.get(selectedCompte) || ''}`}
            </span>
          </div>
          <span className="text-xs text-foreground-muted">{lignesAvecSolde.length} ligne(s) d'écriture</span>
        </div>

        {lignesAvecSolde.length === 0 ? (
          <div className="p-12 text-center text-foreground-muted text-sm">
            Aucun mouvement enregistré pour ce compte.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs min-w-[700px]">
              <thead className="bg-sidebar border-b border-surface-border text-foreground-muted">
                <tr>
                  <th className="p-3">Date</th>
                  <th className="p-3">Journal</th>
                  <th className="p-3">N° Pièce</th>
                  <th className="p-3">Compte</th>
                  <th className="p-3">Libellé d'Opération</th>
                  <th className="p-3 text-right">Débit</th>
                  <th className="p-3 text-right">Crédit</th>
                  <th className="p-3 text-right">Solde Progressif</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border">
                {lignesAvecSolde.map((l: any) => (
                  <tr key={l.id} className="hover:bg-black/5">
                    <td className="p-3 whitespace-nowrap text-foreground font-medium">
                      {new Date(l.ecriture?.date_ecriture || l.created_at).toLocaleDateString('fr-FR')}
                    </td>
                    <td className="p-3 font-mono font-bold uppercase text-[11px] text-foreground-muted">
                      {l.ecriture?.journal || '-'}
                    </td>
                    <td className="p-3 font-mono text-foreground-muted">
                      {l.ecriture?.numero_piece || '-'}
                    </td>
                    <td className="p-3 font-mono font-bold text-foreground">
                      {l.compte}
                    </td>
                    <td className="p-3 text-foreground">
                      {l.libelle || l.ecriture?.libelle}
                    </td>
                    <td className="p-3 text-right font-semibold text-primary">
                      {l.debit > 0 ? formatCFA(l.debit) : '-'}
                    </td>
                    <td className="p-3 text-right font-semibold text-secondary">
                      {l.credit > 0 ? formatCFA(l.credit) : '-'}
                    </td>
                    <td className={`p-3 text-right font-bold ${l.soldeProgressif >= 0 ? 'text-emerald-600' : 'text-amber-600'}`}>
                      {formatCFA(Math.abs(l.soldeProgressif))} {l.soldeProgressif >= 0 ? 'D' : 'C'}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-sidebar border-t border-surface-border font-bold">
                <tr>
                  <td colSpan={5} className="p-3 text-right text-foreground">
                    Totaux & Position finale :
                  </td>
                  <td className="p-3 text-right text-primary">{formatCFA(totalDebit)}</td>
                  <td className="p-3 text-right text-secondary">{formatCFA(totalCredit)}</td>
                  <td className={`p-3 text-right ${soldeFinal >= 0 ? 'text-emerald-600' : 'text-amber-600'}`}>
                    {formatCFA(Math.abs(soldeFinal))} {soldeFinal >= 0 ? 'D' : 'C'}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
