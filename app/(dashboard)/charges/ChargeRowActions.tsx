'use client'

import { useState } from 'react'
import { Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import type { Dictionary } from '@/dictionaries'
import { updateCharge, deleteCharge } from './actions'

type Compte = { id: string; nom: string }
type Charge = {
  id: string
  categorie: string
  libelle: string | null
  montant: number
  date_charge: string
  recurrente: boolean
  compte_tresorerie_id: string | null
}

export default function ChargeRowActions({ charge, comptes, dict }: { charge: Charge; comptes: Compte[]; dict: Dictionary }) {
  const t = dict.charges
  const c = dict.common
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleUpdate(formData: FormData) {
    setLoading(true)
    setError(null)
    const categorie = formData.get('categorie') as string
    const libelle = (formData.get('libelle') as string) ?? ''
    const montant = parseFloat(formData.get('montant') as string) || 0
    const dateCharge = formData.get('date_charge') as string
    const recurrente = formData.get('recurrente') === 'on'
    const compteTresorerieId = (formData.get('compte_tresorerie_id') as string) || null
    const res = await updateCharge(charge.id, categorie, libelle, montant, dateCharge, recurrente, compteTresorerieId)
    setLoading(false)
    if (res?.error) setError(res.error)
    else {
      setIsEditOpen(false)
      toast.success(t.updated)
    }
  }

  async function handleDelete() {
    if (!confirm(t.confirmDelete)) return
    const res = await deleteCharge(charge.id)
    if (res?.error) toast.error(res.error)
    else toast.success(t.deleted)
  }

  return (
    <>
      <div className="flex justify-end gap-2">
        <button onClick={() => setIsEditOpen(true)} className="text-foreground-muted hover:text-primary p-1" title={c.edit}>
          <Pencil className="h-4 w-4" />
        </button>
        <button onClick={handleDelete} className="text-foreground-muted hover:text-danger p-1" title={c.delete}>
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {isEditOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
            <div className="fixed inset-0 bg-black bg-opacity-75 transition-opacity" onClick={() => setIsEditOpen(false)} />

            <div className="relative transform overflow-hidden rounded-lg bg-surface text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-md border border-surface-border">
              <div className="bg-surface px-4 pb-4 pt-5 sm:p-6 sm:pb-4">
                <h3 className="text-lg font-semibold leading-6 text-foreground mb-4">{t.editTitle}</h3>
                <form action={handleUpdate} id={`edit-charge-${charge.id}`} className="space-y-4">
                  {error && <p className="text-xs text-danger">{error}</p>}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-foreground">{t.categorieLabel}</label>
                      <select name="categorie" defaultValue={charge.categorie} className="mt-1 block w-full rounded-md bg-background border border-surface-border text-foreground px-3 py-2">
                        <option value="loyer">{t.categorieLoyer}</option>
                        <option value="salaires">{t.categorieSalaires}</option>
                        <option value="electricite">{t.categorieElectricite}</option>
                        <option value="transport">{t.categorieTransport}</option>
                        <option value="autre">{t.categorieAutre}</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-foreground">{t.montantLabel}</label>
                      <input name="montant" type="number" step="0.01" min="0.01" required defaultValue={charge.montant} className="mt-1 block w-full rounded-md bg-background border border-surface-border text-foreground px-3 py-2" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground">{t.libelleLabel}</label>
                    <input name="libelle" type="text" defaultValue={charge.libelle ?? ''} className="mt-1 block w-full rounded-md bg-background border border-surface-border text-foreground px-3 py-2" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-foreground">{t.dateLabel}</label>
                      <input name="date_charge" type="date" required defaultValue={charge.date_charge?.slice(0, 10)} className="mt-1 block w-full rounded-md bg-background border border-surface-border text-foreground px-3 py-2" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-foreground">{t.compteDebiteLabel}</label>
                      <select name="compte_tresorerie_id" defaultValue={charge.compte_tresorerie_id ?? ''} className="mt-1 block w-full rounded-md bg-background border border-surface-border text-foreground px-3 py-2">
                        <option value="">{t.compteAucun}</option>
                        {comptes.map((cpt) => (
                          <option key={cpt.id} value={cpt.id}>{cpt.nom}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <label className="flex items-center gap-2 text-sm text-foreground">
                    <input name="recurrente" type="checkbox" defaultChecked={charge.recurrente} className="rounded border-surface-border" />
                    {t.recurrenteCheckbox}
                  </label>
                </form>
              </div>
              <div className="bg-background/50 px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6">
                <button
                  type="submit"
                  form={`edit-charge-${charge.id}`}
                  disabled={loading}
                  className="inline-flex w-full justify-center rounded-md bg-primary px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-hover sm:ml-3 sm:w-auto disabled:opacity-50"
                >
                  {loading ? c.saving : c.save}
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditOpen(false)}
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
