'use client'

import { useState } from 'react'
import { Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import type { Dictionary } from '@/dictionaries'
import { updateArticle, deleteArticle, toggleArticleActif } from './actions'

type Article = {
  id: string
  designation: string
  reference: string | null
  categorie_id: string | null
  unite: string
  prix_vente: number
  seuil_alerte: number
  actif: boolean
}
type Categorie = { id: string; nom: string }

export default function ArticleRowActions({ article, categories, dict }: { article: Article; categories: Categorie[]; dict: Dictionary }) {
  const t = dict.articles
  const c = dict.common
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleUpdate(formData: FormData) {
    setLoading(true)
    setError(null)
    const res = await updateArticle(article.id, formData)
    setLoading(false)
    if (res?.error) setError(res.error)
    else {
      setIsEditOpen(false)
      toast.success(t.updated)
    }
  }

  async function handleDelete() {
    if (!confirm(t.confirmDelete.replace('{nom}', article.designation))) return
    const res = await deleteArticle(article.id)
    if (res?.error) toast.error(res.error)
    else toast.success(t.deleted)
  }

  async function handleToggle() {
    const res = await toggleArticleActif(article.id, !article.actif)
    if (res?.error) toast.error(res.error)
  }

  return (
    <>
      <div className="flex justify-end items-center gap-2">
        <button
          onClick={handleToggle}
          className={`text-xs font-medium px-2 py-1 rounded-full ${article.actif ? 'bg-success/10 text-success' : 'bg-foreground-muted/10 text-foreground-muted'}`}
        >
          {article.actif ? t.active : t.inactive}
        </button>
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

            <div className="relative transform overflow-hidden rounded-lg bg-surface text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg border border-surface-border">
              <div className="bg-surface px-4 pb-4 pt-5 sm:p-6 sm:pb-4">
                <h3 className="text-lg font-semibold leading-6 text-foreground mb-4">{t.editTitle}</h3>
                <form action={handleUpdate} id={`edit-article-${article.id}`} className="space-y-4">
                  {error && <p className="text-xs text-danger">{error}</p>}
                  <div>
                    <label className="block text-sm font-medium text-foreground">{t.designationLabel}</label>
                    <input name="designation" type="text" defaultValue={article.designation} required className="mt-1 block w-full rounded-md bg-background border border-surface-border text-foreground px-3 py-2" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-foreground">{t.referenceLabel}</label>
                      <input name="reference" type="text" defaultValue={article.reference ?? ''} className="mt-1 block w-full rounded-md bg-background border border-surface-border text-foreground px-3 py-2" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-foreground">{t.categorieLabel}</label>
                      <select name="categorie_id" defaultValue={article.categorie_id ?? ''} className="mt-1 block w-full rounded-md bg-background border border-surface-border text-foreground px-3 py-2">
                        <option value="">{t.noCategorie}</option>
                        {categories.map((cat) => (
                          <option key={cat.id} value={cat.id}>{cat.nom}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-foreground">{t.uniteLabel}</label>
                      <input name="unite" type="text" defaultValue={article.unite} className="mt-1 block w-full rounded-md bg-background border border-surface-border text-foreground px-3 py-2" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-foreground">{t.prixVenteLabel}</label>
                      <input name="prix_vente" type="number" step="0.01" min="0" defaultValue={article.prix_vente} required className="mt-1 block w-full rounded-md bg-background border border-surface-border text-foreground px-3 py-2" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-foreground">{t.seuilAlerteLabel}</label>
                      <input name="seuil_alerte" type="number" step="0.01" min="0" defaultValue={article.seuil_alerte} className="mt-1 block w-full rounded-md bg-background border border-surface-border text-foreground px-3 py-2" />
                    </div>
                  </div>
                </form>
              </div>
              <div className="bg-background/50 px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6">
                <button
                  type="submit"
                  form={`edit-article-${article.id}`}
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
