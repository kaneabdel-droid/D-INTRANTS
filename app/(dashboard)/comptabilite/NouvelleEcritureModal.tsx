'use client'

import React, { useState, useTransition } from 'react'
import { Plus, Trash2, CheckCircle2, AlertCircle, X, Calculator } from 'lucide-react'
import { creerEcriture, type LigneEcritureInput } from './actions'

type ComptePlan = {
  compte: string
  libelle: string
  classe: number
}

export default function NouvelleEcritureModal({
  plan = [],
  exerciceId,
}: {
  plan: ComptePlan[]
  exerciceId?: string
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [erreur, setErreur] = useState<string | null>(null)

  const [journal, setJournal] = useState('od')
  const [dateEcriture, setDateEcriture] = useState(new Date().toISOString().split('T')[0])
  const [numeroPiece, setNumeroPiece] = useState('')
  const [libelle, setLibelle] = useState('')

  const [lignes, setLignes] = useState<LigneEcritureInput[]>([
    { compte: '601', libelle: '', debit: 0, credit: 0 },
    { compte: '401', libelle: '', debit: 0, credit: 0 },
  ])

  const totalDebit = lignes.reduce((s, l) => s + (Number(l.debit) || 0), 0)
  const totalCredit = lignes.reduce((s, l) => s + (Number(l.credit) || 0), 0)
  const ecart = Math.abs(totalDebit - totalCredit)
  const estEquilibre = ecart < 0.01 && totalDebit > 0

  const ajouterLigne = () => {
    setLignes([
      ...lignes,
      { compte: plan[0]?.compte || '531', libelle: '', debit: 0, credit: 0 },
    ])
  }

  const supprimerLigne = (index: number) => {
    if (lignes.length <= 2) return
    setLignes(lignes.filter((_, i) => i !== index))
  }

  const modifierLigne = (index: number, champ: keyof LigneEcritureInput, valeur: any) => {
    const updated = [...lignes]
    updated[index] = { ...updated[index], [champ]: valeur }
    setLignes(updated)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setErreur(null)

    if (!libelle.trim()) {
      setErreur('Le libellé général de l’écriture est obligatoire.')
      return
    }

    if (!estEquilibre) {
      setErreur(`L’écriture n’est pas équilibrée (Écart : ${ecart.toLocaleString('fr-FR')} FCFA). Le total débit doit être strictement égal au total crédit.`)
      return
    }

    const formData = new FormData()
    formData.append('journal', journal)
    formData.append('date_ecriture', dateEcriture)
    formData.append('numero_piece', numeroPiece)
    formData.append('libelle', libelle)
    if (exerciceId) formData.append('exercice_id', exerciceId)
    formData.append('lignes', JSON.stringify(lignes))

    startTransition(async () => {
      const res = await creerEcriture(formData)
      if (res.error) {
        setErreur(res.error)
      } else {
        setIsOpen(false)
        setLibelle('')
        setNumeroPiece('')
        setLignes([
          { compte: '601', libelle: '', debit: 0, credit: 0 },
          { compte: '401', libelle: '', debit: 0, credit: 0 },
        ])
      }
    })
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary/90 transition-colors"
      >
        <Plus className="w-4 h-4" />
        <span>Nouvelle Écriture</span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
          <div className="relative w-full max-w-3xl rounded-2xl bg-surface border border-surface-border shadow-2xl p-6 my-8">
            <div className="flex items-center justify-between pb-4 border-b border-surface-border">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                  <Calculator className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-foreground">Saisie d’Écriture Comptable</h3>
                  <p className="text-xs text-foreground-muted">Principe de la partie double SYSCOHADA (Débit = Crédit)</p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 rounded-lg hover:bg-black/5 text-foreground-muted hover:text-foreground transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {erreur && (
              <div className="mt-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{erreur}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              {/* En-tête */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-medium text-foreground-muted mb-1">Journal</label>
                  <select
                    value={journal}
                    onChange={(e) => setJournal(e.target.value)}
                    className="w-full rounded-xl bg-background border border-surface-border px-3 py-2 text-sm text-foreground focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="achats">🛒 Achats (ACH)</option>
                    <option value="ventes">💰 Ventes (VTE)</option>
                    <option value="caisse">💵 Caisse (CAI)</option>
                    <option value="banque">🏦 Banque (BNQ)</option>
                    <option value="mobile">📱 Mobile Money (MOB)</option>
                    <option value="od">⚙️ Opérations Diverses (OD)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-foreground-muted mb-1">Date d'opération</label>
                  <input
                    type="date"
                    value={dateEcriture}
                    onChange={(e) => setDateEcriture(e.target.value)}
                    required
                    className="w-full rounded-xl bg-background border border-surface-border px-3 py-2 text-sm text-foreground focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-foreground-muted mb-1">N° Pièce / Réf.</label>
                  <input
                    type="text"
                    value={numeroPiece}
                    onChange={(e) => setNumeroPiece(e.target.value)}
                    placeholder="Ex: FAC-2026-001"
                    className="w-full rounded-xl bg-background border border-surface-border px-3 py-2 text-sm text-foreground focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-foreground-muted mb-1">Libellé général *</label>
                  <input
                    type="text"
                    value={libelle}
                    onChange={(e) => setLibelle(e.target.value)}
                    placeholder="Ex: Achat intrants / semences"
                    required
                    className="w-full rounded-xl bg-background border border-surface-border px-3 py-2 text-sm text-foreground focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>

              {/* Lignes d'écritures */}
              <div className="border border-surface-border rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-sidebar border-b border-surface-border text-foreground-muted">
                    <tr>
                      <th className="p-2.5 w-44">Compte SYSCOHADA</th>
                      <th className="p-2.5">Libellé de ligne</th>
                      <th className="p-2.5 w-32 text-right">Débit (FCFA)</th>
                      <th className="p-2.5 w-32 text-right">Crédit (FCFA)</th>
                      <th className="p-2.5 w-10 text-center"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-border">
                    {lignes.map((l, index) => (
                      <tr key={index} className="hover:bg-black/5">
                        <td className="p-2">
                          <select
                            value={l.compte}
                            onChange={(e) => modifierLigne(index, 'compte', e.target.value)}
                            className="w-full rounded-lg bg-background border border-surface-border px-2 py-1.5 text-xs text-foreground"
                          >
                            {plan.map((p) => (
                              <option key={p.compte} value={p.compte}>
                                {p.compte} - {p.libelle}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="p-2">
                          <input
                            type="text"
                            value={l.libelle || ''}
                            placeholder={libelle || 'Détail de la ligne'}
                            onChange={(e) => modifierLigne(index, 'libelle', e.target.value)}
                            className="w-full rounded-lg bg-background border border-surface-border px-2 py-1.5 text-xs text-foreground"
                          >
                          </input>
                        </td>
                        <td className="p-2">
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={l.debit || ''}
                            placeholder="0"
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) || 0
                              modifierLigne(index, 'debit', val)
                              if (val > 0) modifierLigne(index, 'credit', 0)
                            }}
                            className="w-full text-right rounded-lg bg-background border border-surface-border px-2 py-1.5 text-xs font-semibold text-primary"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={l.credit || ''}
                            placeholder="0"
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) || 0
                              modifierLigne(index, 'credit', val)
                              if (val > 0) modifierLigne(index, 'debit', 0)
                            }}
                            className="w-full text-right rounded-lg bg-background border border-surface-border px-2 py-1.5 text-xs font-semibold text-secondary"
                          />
                        </td>
                        <td className="p-2 text-center">
                          <button
                            type="button"
                            onClick={() => supprimerLigne(index)}
                            disabled={lignes.length <= 2}
                            className="p-1 rounded text-foreground-muted hover:text-red-500 disabled:opacity-30 disabled:hover:text-foreground-muted"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Bouton ajouter ligne */}
              <div className="flex justify-between items-center">
                <button
                  type="button"
                  onClick={ajouterLigne}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:text-primary/80"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Ajouter une ligne d’imputation</span>
                </button>

                {/* Barre d'équilibre */}
                <div className="flex items-center gap-4 text-xs font-semibold">
                  <div>
                    <span className="text-foreground-muted mr-1.5">Débit:</span>
                    <span className="text-primary font-bold">{totalDebit.toLocaleString('fr-FR')} FCFA</span>
                  </div>
                  <div>
                    <span className="text-foreground-muted mr-1.5">Crédit:</span>
                    <span className="text-secondary font-bold">{totalCredit.toLocaleString('fr-FR')} FCFA</span>
                  </div>
                  <div className="pl-2 border-l border-surface-border">
                    {estEquilibre ? (
                      <span className="inline-flex items-center gap-1 text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded-full font-bold">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Équilibré
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-amber-600 bg-amber-500/10 px-2 py-0.5 rounded-full font-bold">
                        <AlertCircle className="w-3.5 h-3.5" />
                        Écart: {ecart.toLocaleString('fr-FR')} FCFA
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="pt-4 border-t border-surface-border flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="rounded-xl border border-surface-border px-4 py-2 text-sm font-semibold text-foreground hover:bg-black/5 transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isPending || !estEquilibre}
                  className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-50 transition-colors"
                >
                  {isPending ? 'Enregistrement...' : 'Valider la pièce comptable'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
