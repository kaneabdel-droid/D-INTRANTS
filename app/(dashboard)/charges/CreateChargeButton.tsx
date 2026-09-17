'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import type { Dictionary } from '@/dictionaries'
import { addCharge } from './actions'

type Compte = { id: string; nom: string }

export default function CreateChargeButton({ comptes, dict }: { comptes: Compte[]; dict: Dictionary }) {
  const t = dict.charges
  const c = dict.common
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(formData: FormData) {
    setLoading(true)
    setError(null)
    const res = await addCharge(formData)
    setLoading(false)
    if (res?.error) setError(res.error)
    else setIsOpen(false)
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-hover"
      >
        <Plus className="h-4 w-4" /> {t.newButton}
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
            <div className="fixed inset-0 bg-black bg-opacity-75 transition-opacity" onClick={() => setIsOpen(false)} />

            <div className="relative transform overflow-hidden rounded-lg bg-surface text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-md border border-surface-border">
              <div className="bg-surface px-4 pb-4 pt-5 sm:p-6 sm:pb-4">
                <h3 className="text-lg font-semibold leading-6 text-foreground mb-4">{t.newTitle}</h3>
                <form action={handleSubmit} id="add-charge-form" className="space-y-4">
                  {error && <p className="text-xs text-danger">{error}</p>}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-foreground">{t.categorieLabel}</label>
                      <select name="categorie" className="mt-1 block w-full rounded-md bg-background border border-surface-border text-foreground px-3 py-2">
                        <option value="loyer">{t.categorieLoyer}</option>
                        <option value="salaires">{t.categorieSalaires}</option>
                        <option value="electricite">{t.categorieElectricite}</option>
                        <option value="transport">{t.categorieTransport}</option>
                        <option value="autre">{t.categorieAutre}</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-foreground">{t.montantLabel}</label>
                      <input name="montant" type="number" step="0.01" min="0.01" required className="mt-1 block w-full rounded-md bg-background border border-surface-border text-foreground px-3 py-2" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground">{t.libelleLabel}</label>
                    <input name="libelle" type="text" className="mt-1 block w-full rounded-md bg-background border border-surface-border text-foreground px-3 py-2" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-foreground">{t.dateLabel}</label>
                      <input name="date_charge" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} className="mt-1 block w-full rounded-md bg-background border border-surface-border text-foreground px-3 py-2" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-foreground">{t.compteDebiteLabel}</label>
                      <select name="compte_tresorerie_id" className="mt-1 block w-full rounded-md bg-background border border-surface-border text-foreground px-3 py-2">
                        <option value="">{t.compteAucun}</option>
                        {comptes.map((cpt) => (
                          <option key={cpt.id} value={cpt.id}>{cpt.nom}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <label className="flex items-center gap-2 text-sm text-foreground">
                    <input name="recurrente" type="checkbox" className="rounded border-surface-border" />
                    {t.recurrenteCheckbox}
                  </label>
                </form>
              </div>
              <div className="bg-background/50 px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6">
                <button
                  type="submit"
                  form="add-charge-form"
                  disabled={loading}
                  className="inline-flex w-full justify-center rounded-md bg-primary px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-hover sm:ml-3 sm:w-auto disabled:opacity-50"
                >
                  {loading ? c.saving : c.save}
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
