'use client'

import { useState } from 'react'
import { Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import type { Dictionary } from '@/dictionaries'
import { updateFournisseur, deleteFournisseur } from './actions'
import PrintReleveButton from '@/components/PrintReleveButton'

type Fournisseur = { id: string; nom: string; telephone: string | null; adresse: string | null }

export default function FournisseurRowActions({ fournisseur, dict, magasinId, entreprise }: { fournisseur: Fournisseur; dict: Dictionary; magasinId: string | null; entreprise: any }) {
  const t = dict.fournisseurs
  const c = dict.common
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [nom, setNom] = useState(fournisseur.nom)
  const [telephone, setTelephone] = useState(fournisseur.telephone ?? '')
  const [adresse, setAdresse] = useState(fournisseur.adresse ?? '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const res = await updateFournisseur(fournisseur.id, nom, telephone, adresse)
    setLoading(false)
    if (res?.error) setError(res.error)
    else {
      setIsEditOpen(false)
      toast.success(t.updated)
    }
  }

  async function handleDelete() {
    if (!confirm(t.confirmDelete.replace('{nom}', fournisseur.nom))) return
    const res = await deleteFournisseur(fournisseur.id)
    if (res?.error) toast.error(res.error)
    else toast.success(t.deleted)
  }

  return (
    <>
      <div className="flex justify-end gap-2 items-center">
        <PrintReleveButton 
          releveType="fournisseur" 
          magasinId={magasinId} 
          entreprise={entreprise} 
          referenceId={fournisseur.id}
          referenceName={fournisseur.nom}
        />
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
                <form onSubmit={handleUpdate} id={`edit-fournisseur-${fournisseur.id}`} className="space-y-4">
                  {error && <p className="text-xs text-danger">{error}</p>}
                  <div>
                    <label className="block text-sm font-medium text-foreground">{c.name}</label>
                    <input value={nom} onChange={(e) => setNom(e.target.value)} required className="mt-1 block w-full rounded-md bg-background border border-surface-border text-foreground px-3 py-2" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground">{c.phone}</label>
                    <input value={telephone} onChange={(e) => setTelephone(e.target.value)} className="mt-1 block w-full rounded-md bg-background border border-surface-border text-foreground px-3 py-2" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground">{c.address}</label>
                    <input value={adresse} onChange={(e) => setAdresse(e.target.value)} className="mt-1 block w-full rounded-md bg-background border border-surface-border text-foreground px-3 py-2" />
                  </div>
                </form>
              </div>
              <div className="bg-background/50 px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6">
                <button
                  type="submit"
                  form={`edit-fournisseur-${fournisseur.id}`}
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
