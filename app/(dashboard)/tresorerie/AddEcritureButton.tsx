'use client'

import { useState } from 'react'
import { Plus, ArrowRightLeft } from 'lucide-react'
import type { Dictionary } from '@/dictionaries'
import { addEcritureTresorerie } from './actions'

type Compte = { id: string; nom: string }

export default function AddEcritureButton({ comptes, dict }: { comptes: Compte[]; dict: Dictionary }) {
  const t = dict.tresorerie
  const c = dict.common
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [compteId, setCompteId] = useState('')
  const [categorie, setCategorie] = useState('autres_produits')
  const sensForce =
    categorie === 'autres_produits'
      ? 'entree'
      : categorie === 'autres_charges' || categorie === 'virement'
        ? 'sortie'
        : null

  const autresComptes = comptes.filter((cpt) => cpt.id !== compteId)

  async function handleSubmit(formData: FormData) {
    setLoading(true)
    setError(null)
    const res = await addEcritureTresorerie(formData)
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
        <Plus className="h-4 w-4" /> {t.newEcritureButton}
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
            <div className="fixed inset-0 bg-black bg-opacity-75 transition-opacity" onClick={() => setIsOpen(false)} />

            <div className="relative transform overflow-hidden rounded-lg bg-surface text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-md border border-surface-border">
              <div className="bg-surface px-4 pb-4 pt-5 sm:p-6 sm:pb-4">
                <h3 className="text-lg font-semibold leading-6 text-foreground mb-4">{t.newEcritureTitle}</h3>
                <form action={handleSubmit} id="add-ecriture-form" className="space-y-4">
                  {error && <p className="text-xs text-danger">{error}</p>}
                  <div>
                    <label className="block text-sm font-medium text-foreground">
                      {categorie === 'virement' ? `${t.compteLabel} source (débité)` : t.compteLabel}
                    </label>
                    <select
                      name="compte_tresorerie_id"
                      value={compteId}
                      onChange={(e) => setCompteId(e.target.value)}
                      required
                      className="mt-1 block w-full rounded-md bg-background border border-surface-border text-foreground px-3 py-2"
                    >
                      <option value="">{c.select}</option>
                      {comptes.map((cpt) => (
                        <option key={cpt.id} value={cpt.id}>{cpt.nom}</option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-foreground">{t.senseLabel}</label>
                      {sensForce ? (
                        <>
                          <select value={sensForce} disabled className="mt-1 block w-full rounded-md bg-background border border-surface-border text-foreground px-3 py-2 opacity-70">
                            <option value="entree">{t.senseEntree}</option>
                            <option value="sortie">{t.senseSortie}</option>
                          </select>
                          <input type="hidden" name="type_mouvement" value={sensForce} />
                        </>
                      ) : (
                        <select name="type_mouvement" required className="mt-1 block w-full rounded-md bg-background border border-surface-border text-foreground px-3 py-2">
                          <option value="entree">{t.senseEntree}</option>
                          <option value="sortie">{t.senseSortie}</option>
                        </select>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-foreground">{t.montantLabel}</label>
                      <input name="montant" type="number" step="any" min="0.01" required className="mt-1 block w-full rounded-md bg-background border border-surface-border text-foreground px-3 py-2" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground">{t.categorieLabel}</label>
                    <select name="categorie" value={categorie} onChange={(e) => setCategorie(e.target.value)} className="mt-1 block w-full rounded-md bg-background border border-surface-border text-foreground px-3 py-2">
                      <option value="autres_produits">{t.categorieAutresProduits}</option>
                      <option value="autres_charges">{t.categorieAutresCharges}</option>
                      <option value="virement">{t.categorieVirement}</option>
                      <option value="remboursement">{t.categorieRemboursement}</option>
                      <option value="retrait">{t.categorieRetrait}</option>
                      <option value="autre">{t.categorieAutre}</option>
                    </select>
                  </div>

                  {categorie === 'virement' && (
                    <div className="space-y-2 rounded-lg border border-primary/30 bg-primary/5 p-3">
                      <label className="block text-sm font-medium text-foreground">
                        Compte de destination (crédité)
                      </label>
                      <select
                        name="compte_destination_id"
                        required
                        defaultValue=""
                        className="mt-1 block w-full rounded-md bg-background border border-surface-border text-foreground px-3 py-2"
                      >
                        <option value="">{c.select}</option>
                        {autresComptes.map((cpt) => (
                          <option key={cpt.id} value={cpt.id}>{cpt.nom}</option>
                        ))}
                      </select>
                      <p className="flex items-start gap-1.5 text-xs text-primary">
                        <ArrowRightLeft className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                        <span>
                          Équilibrage automatique : une sortie sera enregistrée sur le compte source et une entrée du même montant sera passée automatiquement sur le compte de destination.
                        </span>
                      </p>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-foreground">{t.motifLabel}</label>
                    <input name="motif" type="text" className="mt-1 block w-full rounded-md bg-background border border-surface-border text-foreground px-3 py-2" />
                  </div>
                </form>
              </div>
              <div className="bg-background/50 px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6">
                <button
                  type="submit"
                  form="add-ecriture-form"
                  disabled={loading || comptes.length === 0 || (categorie === 'virement' && autresComptes.length === 0)}
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
