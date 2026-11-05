import React from 'react'
import Link from 'next/link'
import {
  FileText,
  Filter,
  CheckCircle2,
  AlertCircle,
  Calendar,
  Layers,
  ArrowRight,
} from 'lucide-react'
import { getEcritures, getPlanComptable, getExercices } from './actions'
import NouvelleEcritureModal from './NouvelleEcritureModal'
import ImportJournauxModal from './ImportJournauxModal'
import BoutonSyncOperations from './BoutonSyncOperations'
import PrintSectionButton from '@/components/PrintSectionButton'

export default async function ComptabiliteJournalPage(props: {
  searchParams: Promise<{ journal?: string; exercice?: string }>
}) {
  const searchParams = await props.searchParams
  const selectedJournal = searchParams.journal || 'tous'
  const selectedExercice = searchParams.exercice

  const [{ ecritures, error }, { plan }, { exercices }] = await Promise.all([
    getEcritures(selectedJournal, selectedExercice),
    getPlanComptable(),
    getExercices(),
  ])

  // Statistiques du journal
  const totalDebits = ecritures.reduce((acc, ec) => {
    return acc + (ec.lignes_ecritures_comptables || []).reduce((s: number, l: any) => s + Number(l.debit || 0), 0)
  }, 0)

  const totalCredits = ecritures.reduce((acc, ec) => {
    return acc + (ec.lignes_ecritures_comptables || []).reduce((s: number, l: any) => s + Number(l.credit || 0), 0)
  }, 0)

  const formatCFA = (val: number) =>
    new Intl.NumberFormat('fr-FR', { style: 'decimal', maximumFractionDigits: 0 }).format(val) + ' FCFA'

  const journalConfig: Record<string, { label: string; badge: string; color: string }> = {
    achats: { label: 'Achats (Fournisseurs)', badge: 'ACH', color: 'bg-amber-500/10 text-amber-600 border-amber-500/20' },
    ventes: { label: 'Ventes (Clients)', badge: 'VTE', color: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' },
    caisse: { label: 'Caisse Principale', badge: 'CAI', color: 'bg-blue-500/10 text-blue-600 border-blue-500/20' },
    banque: { label: 'Banque & Virements', badge: 'BNQ', color: 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20' },
    mobile: { label: 'Mobile Money (Wave / OM)', badge: 'MOB', color: 'bg-sky-500/10 text-sky-600 border-sky-500/20' },
    od: { label: 'Opérations Diverses', badge: 'OD', color: 'bg-purple-500/10 text-purple-600 border-purple-500/20' },
  }

  const journals = [
    { id: 'tous', label: 'Tous les journaux' },
    { id: 'ventes', label: '💰 Ventes (VTE)' },
    { id: 'achats', label: '🛒 Achats (ACH)' },
    { id: 'caisse', label: '💵 Caisse (CAI)' },
    { id: 'banque', label: '🏦 Banque (BNQ)' },
    { id: 'mobile', label: '📱 Mobile Money (MOB)' },
    { id: 'od', label: '⚙️ Opérations Diverses (OD)' },
  ]

  return (
    <div className="space-y-6">
      {/* Barre d'action supérieure */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold font-heading text-foreground">
            Livre-Journal des Écritures
          </h2>
          <p className="text-xs text-foreground-muted">
            Enregistrement chronologique et numéroté de tous les flux financiers de l'entreprise.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <BoutonSyncOperations />
          <PrintSectionButton sectionId="journal-print" label="Imprimer le Journal" />
          <ImportJournauxModal />
          <NouvelleEcritureModal plan={plan || []} exerciceId={selectedExercice} />
        </div>
      </div>

      {/* Cartes KPI */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-surface rounded-2xl p-4 border border-surface-border shadow-sm">
          <span className="text-xs text-foreground-muted font-medium">Nombre de Pièces</span>
          <p className="text-2xl font-bold text-foreground mt-1">{ecritures.length}</p>
          <span className="text-[11px] text-foreground-muted">Écritures enregistrées dans ce journal</span>
        </div>
        <div className="bg-surface rounded-2xl p-4 border border-surface-border shadow-sm">
          <span className="text-xs text-foreground-muted font-medium">Total Débits Période</span>
          <p className="text-2xl font-bold text-primary mt-1">{formatCFA(totalDebits)}</p>
          <span className="text-[11px] text-emerald-600 font-medium">Emplois / Charges / Entrées de fonds</span>
        </div>
        <div className="bg-surface rounded-2xl p-4 border border-surface-border shadow-sm">
          <span className="text-xs text-foreground-muted font-medium">Total Crédits Période</span>
          <p className="text-2xl font-bold text-secondary mt-1">{formatCFA(totalCredits)}</p>
          <span className="text-[11px] text-emerald-600 font-medium flex items-center gap-1 mt-0.5">
            {Math.abs(totalDebits - totalCredits) < 0.01 ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Équilibre parfait Débit = Crédit</span>
              </>
            ) : (
              <>
                <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
                <span className="text-amber-500">Déséquilibre : {formatCFA(Math.abs(totalDebits - totalCredits))}</span>
              </>
            )}
          </span>
        </div>
      </div>

      {/* Filtres par Journal */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-foreground-muted mr-1 flex items-center gap-1">
          <Filter className="w-3.5 h-3.5" /> Filtrer :
        </span>
        {journals.map((j) => {
          const actif = selectedJournal === j.id
          return (
            <Link
              key={j.id}
              href={`/comptabilite?journal=${j.id}${selectedExercice ? `&exercice=${selectedExercice}` : ''}`}
              className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors ${
                actif
                  ? 'bg-primary text-white shadow-sm'
                  : 'bg-surface text-foreground-muted hover:text-foreground border border-surface-border'
              }`}
            >
              {j.label}
            </Link>
          )
        })}
      </div>

      {/* Tableau du Journal */}
      <div id="journal-print" className="bg-surface rounded-2xl border border-surface-border shadow-sm overflow-hidden">
        <div className="p-4 border-b border-surface-border flex justify-between items-center bg-sidebar/50">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary" />
            <span className="text-sm font-bold text-foreground">Écritures du Journal ({ecritures.length})</span>
          </div>
          <span className="text-xs text-foreground-muted">SYSCOHADA Révisé</span>
        </div>

        {ecritures.length === 0 ? (
          <div className="p-12 text-center text-foreground-muted space-y-3">
            <p className="text-sm">Aucune écriture comptable enregistrée dans ce journal.</p>
            <p className="text-xs">
              Cliquez sur <strong>« Synchroniser les Opérations »</strong> pour générer les écritures à partir de vos ventes et achats, ou sur <strong>« Nouvelle Écriture »</strong> pour une saisie manuelle.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-surface-border">
            {ecritures.map((ec) => {
              const conf = journalConfig[ec.journal] || {
                label: ec.journal,
                badge: ec.journal.toUpperCase().slice(0, 3),
                color: 'bg-gray-500/10 text-gray-600 border-gray-500/20',
              }

              const pieceDebit = (ec.lignes_ecritures_comptables || []).reduce((s: number, l: any) => s + Number(l.debit || 0), 0)
              const pieceCredit = (ec.lignes_ecritures_comptables || []).reduce((s: number, l: any) => s + Number(l.credit || 0), 0)

              return (
                <div key={ec.id} className="p-4 hover:bg-black/5 transition-colors space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded-md font-bold text-[10px] border ${conf.color}`}>
                        {conf.badge}
                      </span>
                      <span className="font-semibold text-foreground">
                        {new Date(ec.date_ecriture).toLocaleDateString('fr-FR')}
                      </span>
                      {ec.numero_piece && (
                        <span className="font-mono text-foreground-muted bg-surface-border/40 px-1.5 py-0.5 rounded">
                          N° {ec.numero_piece}
                        </span>
                      )}
                      <span className="font-medium text-foreground">{ec.libelle}</span>
                    </div>

                    <div className="flex items-center gap-3 font-semibold text-xs">
                      <span className="text-primary">D: {formatCFA(pieceDebit)}</span>
                      <span className="text-secondary">C: {formatCFA(pieceCredit)}</span>
                      {Math.abs(pieceDebit - pieceCredit) < 0.01 ? (
                        <span className="text-emerald-600 text-[11px] font-bold">✓ Équilibrée</span>
                      ) : (
                        <span className="text-amber-500 text-[11px] font-bold">⚠ Déséquilibre</span>
                      )}
                    </div>
                  </div>

                  {/* Lignes d'imputation */}
                  <div className="pl-4 sm:pl-8 pt-1">
                    <table className="w-full text-xs">
                      <tbody>
                        {(ec.lignes_ecritures_comptables || []).map((ligne: any) => (
                          <tr key={ligne.id} className="border-t border-surface-border/40 text-foreground-muted">
                            <td className="py-1 w-24 font-mono font-bold text-foreground">{ligne.compte}</td>
                            <td className="py-1">{ligne.libelle || ec.libelle}</td>
                            <td className="py-1 w-28 text-right font-medium text-primary">
                              {Number(ligne.debit) > 0 ? formatCFA(Number(ligne.debit)) : '-'}
                            </td>
                            <td className="py-1 w-28 text-right font-medium text-secondary">
                              {Number(ligne.credit) > 0 ? formatCFA(Number(ligne.credit)) : '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
