'use client'

import { useState } from 'react'
import { Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import type { Dictionary } from '@/dictionaries'
import { updateEcritureTresorerie, deleteEcritureTresorerie } from './actions'

type Compte = { id: string; nom: string }
type Ecriture = {
  id: string
  compte_tresorerie_id: string
  type_mouvement: string
  montant: number
  categorie: string | null
  motif: string | null
  reference_id?: string | null
}

export default function EcritureRowActions({
  ecriture,
  comptes,
  compteContrepartieId,
  dict,
}: {
  ecriture: Ecriture
  comptes: Compte[]
  compteContrepartieId?: string | null
  dict: Dictionary
}) {
  const t = dict.tresorerie
  const c = dict.common
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [compteId, setCompteId] = useState(ecriture.compte_tresorerie_id)
  const [categorie, setCategorie] = useState(ecriture.categorie ?? 'autre')
  const sensForce =
    categorie === 'autres_produits'
      ? 'entree'
      : categorie === 'autres_charges'
        ? 'sortie'
        : categorie === 'virement'
          ? ecriture.categorie === 'virement'
            ? ecriture.type_mouvement
            : 'sortie'
          : null

  const autresComptes = comptes.filter((cpt) => cpt.id !== compteId)

  async function handleUpdate(formData: FormData) {
    setLoading(true)
    setError(null)
    const cId = formData.get('compte_tresorerie_id') as string
    const typeMouvement = formData.get('type_mouvement') as string
    const montant = parseFloat(formData.get('montant') as string) || 0
    const cat = (formData.get('categorie') as string) || 'autre'
    const motif = (formData.get('motif') as string) ?? ''
    const compteDestinationId = (formData.get('compte_destination_id') as string) || undefined
    const res = await updateEcritureTresorerie(ecriture.id, cId, typeMouvement, montant, cat, motif, compteDestinationId)
    setLoading(false)
    if (res?.error) setError(res.error)
    else {
      setIsEditOpen(false)
      toast.success(t.ecritureUpdated)
    }
  }

  async function handleDelete() {
    if (!confirm(t.confirmDeleteEcriture)) return
    const res = await deleteEcritureTresorerie(ecriture.id)
    if (res?.error) toast.error(res.error)
    else toast.success(t.ecritureDeleted)
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
                <h3 className="text-lg font-semibold leading-6 text-foreground mb-4">{t.editEcritureTitle}</h3>
                <form action={handleUpdate} id={`edit-ecriture-${ecriture.id}`} className="space-y-4">
                  {error && <p className="text-xs text-danger">{error}</p>}
                  <div>
                    <label className="block text-sm font-medium text-foreground">{t.compteLabel}</label>
                    <select
                      name="compte_tresorerie_id"
                      value={compteId}
                      onChange={(e) => setCompteId(e.target.value)}
                      required
                      className="mt-1 block w-full rounded-md bg-background border border-surface-border text-foreground px-3 py-2"
                    >
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
                        <select name="type_mouvement" defaultValue={ecriture.type_mouvement} required className="mt-1 block w-full rounded-md bg-background border border-surface-border text-foreground px-3 py-2">
                          <option value="entree">{t.senseEntree}</option>
                          <option value="sortie">{t.senseSortie}</option>
                        </select>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-foreground">{t.montantLabel}</label>
                      <input name="montant" type="number" step="any" min="0.01" required defaultValue={ecriture.montant} className="mt-1 block w-full rounded-md bg-background border border-surface-border text-foreground px-3 py-2" />
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
                    <div className="space-y-1 rounded-lg border border-primary/30 bg-primary/5 p-3">
                      <label className="block text-sm font-medium text-foreground">
                        {ecriture.categorie === 'virement' && ecriture.type_mouvement === 'entree'
                          ? 'Compte source (débité)'
                          : 'Compte de destination (crédité)'}
                      </label>
                      <select
                        name="compte_destination_id"
                        required
                        defaultValue={compteContrepartieId ?? ''}
                        className="mt-1 block w-full rounded-md bg-background border border-surface-border text-foreground px-3 py-2"
                      >
                        <option value="">{c.select}</option>
                        {autresComptes.map((cpt) => (
                          <option key={cpt.id} value={cpt.id}>{cpt.nom}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-foreground">{t.motifLabel}</label>
                    <input name="motif" type="text" defaultValue={ecriture.motif ?? ''} className="mt-1 block w-full rounded-md bg-background border border-surface-border text-foreground px-3 py-2" />
                  </div>
                </form>
              </div>
              <div className="bg-background/50 px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6">
                <button
                  type="submit"
                  form={`edit-ecriture-${ecriture.id}`}
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
