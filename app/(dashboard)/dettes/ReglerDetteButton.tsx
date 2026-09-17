'use client'

import { useState } from 'react'
import { Banknote } from 'lucide-react'
import { toast } from 'sonner'
import type { Dictionary } from '@/dictionaries'
import { reglerDette } from './actions'

type Compte = { id: string; nom: string }

export default function ReglerDetteButton({ detteId, montantRestant, comptes, dict }: { detteId: string; montantRestant: number; comptes: Compte[]; dict: Dictionary }) {
  const t = dict.dettes
  const c = dict.common
  const [isOpen, setIsOpen] = useState(false)
  const [montant, setMontant] = useState(montantRestant)
  const [compteId, setCompteId] = useState(comptes[0]?.id ?? '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const res = await reglerDette(detteId, montant, compteId)
    setLoading(false)
    if (res?.error) setError(res.error)
    else {
      setIsOpen(false)
      toast.success(t.settled)
    }
  }

  return (
    <>
      <button onClick={() => setIsOpen(true)} className="flex items-center gap-1 rounded-md bg-primary px-2 py-1 text-xs font-medium text-white hover:bg-primary-hover">
        <Banknote className="h-3 w-3" /> {t.reglerButton}
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
            <div className="fixed inset-0 bg-black bg-opacity-75 transition-opacity" onClick={() => setIsOpen(false)} />

            <div className="relative transform overflow-hidden rounded-lg bg-surface text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-sm border border-surface-border">
              <div className="bg-surface px-4 pb-4 pt-5 sm:p-6 sm:pb-4">
                <h3 className="text-lg font-semibold leading-6 text-foreground mb-4">{t.reglerTitle}</h3>
                <form onSubmit={handleSubmit} id={`regler-dette-${detteId}`} className="space-y-4">
                  {error && <p className="text-xs text-danger">{error}</p>}
                  <p className="text-sm text-foreground-muted">{t.resteDu} <strong className="text-foreground">{montantRestant.toLocaleString('fr-FR')}</strong></p>
                  <div>
                    <label className="block text-sm font-medium text-foreground">{c.compteTresorerie}</label>
                    <select value={compteId} onChange={(e) => setCompteId(e.target.value)} required className="mt-1 block w-full rounded-md bg-background border border-surface-border text-foreground px-3 py-2">
                      <option value="" disabled>{c.select}</option>
                      {comptes.map((cpt) => (
                        <option key={cpt.id} value={cpt.id}>{cpt.nom}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground">{t.montantRegle}</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      max={montantRestant}
                      value={montant}
                      onChange={(e) => setMontant(parseFloat(e.target.value) || 0)}
                      required
                      className="mt-1 block w-full rounded-md bg-background border border-surface-border text-foreground px-3 py-2"
                    />
                  </div>
                </form>
              </div>
              <div className="bg-background/50 px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6">
                <button
                  type="submit"
                  form={`regler-dette-${detteId}`}
                  disabled={loading || comptes.length === 0}
                  className="inline-flex w-full justify-center rounded-md bg-primary px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-hover sm:ml-3 sm:w-auto disabled:opacity-50"
                >
                  {loading ? c.saving : c.confirm}
                </button>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="mt-3 inline-flex w-full justify-center rounded-md bg-surface px-3 py-2 text-sm font-semibold text-foreground shadow-sm ring-1 ring-inset ring-surface-border hover:bg-background sm:mt-0 sm:w-auto"
                >
                  {c.cancel}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
