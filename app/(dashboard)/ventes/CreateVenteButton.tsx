'use client'

import { useState } from 'react'
import { useForm, useFieldArray, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import type { Dictionary } from '@/dictionaries'
import { creerVente } from './actions'

type Article = { id: string; designation: string; unite: string; prix_vente: number }
type Client = { id: string; nom: string }

const ligneSchema = z.object({
  article_id: z.string().min(1, 'Article requis'),
  quantite: z.coerce.number().positive('Doit être > 0'),
  prix_unitaire: z.coerce.number().nonnegative('Doit être ≥ 0'),
})

const venteSchema = z.object({
  client_id: z.string(),
  mode_paiement: z.enum(['comptant', 'credit', 'mixte']),
  montant_paye: z.coerce.number().nonnegative('Doit être ≥ 0'),
  lignes: z.array(ligneSchema).min(1, 'Ajoutez au moins une ligne'),
})

type VenteForm = z.infer<typeof venteSchema>

export default function CreateVenteButton({ articles, clients, dict }: { articles: Article[]; clients: Client[]; dict: Dictionary }) {
  const t = dict.ventes
  const c = dict.common
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { register, control, handleSubmit, watch, reset, setValue, formState: { errors } } = useForm<VenteForm>({
    resolver: zodResolver(venteSchema),
    defaultValues: {
      client_id: '',
      mode_paiement: 'comptant',
      montant_paye: 0,
      lignes: [{ article_id: '', quantite: 1, prix_unitaire: 0 }],
    },
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'lignes' })
  const lignes = watch('lignes')
  const modePaiement = watch('mode_paiement')
  const montantTotal = lignes.reduce((sum, l) => sum + (Number(l.quantite) || 0) * (Number(l.prix_unitaire) || 0), 0)

  const close = () => {
    setIsOpen(false)
    setError(null)
    reset()
  }

  const onSubmit = async (values: VenteForm) => {
    setLoading(true)
    setError(null)
    const res = await creerVente(
      values.client_id || null,
      values.mode_paiement,
      values.montant_paye,
      values.lignes
    )
    setLoading(false)
    if (res?.error) setError(res.error)
    else {
      close()
      toast.success(t.saved)
    }
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
            <div className="fixed inset-0 bg-black bg-opacity-75 transition-opacity" onClick={close} />

            <div className="relative transform overflow-hidden rounded-lg bg-surface text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-2xl border border-surface-border">
              <div className="bg-surface px-4 pb-4 pt-5 sm:p-6 sm:pb-4 max-h-[75vh] overflow-y-auto">
                <h3 className="text-lg font-semibold leading-6 text-foreground mb-4">{t.newTitle}</h3>
                <form onSubmit={handleSubmit(onSubmit)} id="creer-vente-form" className="space-y-4">
                  {error && <p className="text-xs text-danger">{error}</p>}

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-foreground">{t.clientOptional}</label>
                      <select {...register('client_id')} className="mt-1 block w-full rounded-md bg-background border border-surface-border text-foreground px-3 py-2">
                        <option value="">{t.walkInClient}</option>
                        {clients.map((cl) => (
                          <option key={cl.id} value={cl.id}>{cl.nom}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-foreground">{t.modePaiementLabel}</label>
                      <select {...register('mode_paiement')} className="mt-1 block w-full rounded-md bg-background border border-surface-border text-foreground px-3 py-2">
                        <option value="comptant">{t.comptant}</option>
                        <option value="credit">{t.credit}</option>
                        <option value="mixte">{t.mixte}</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-sm font-medium text-foreground">{t.lignesLabel}</label>
                      <button
                        type="button"
                        onClick={() => append({ article_id: '', quantite: 1, prix_unitaire: 0 })}
                        className="text-xs font-medium text-primary hover:text-primary-hover flex items-center gap-1"
                      >
                        <Plus className="h-3 w-3" /> {t.addLine}
                      </button>
                    </div>
                    {errors.lignes?.message && <p className="text-xs text-danger mb-2">{errors.lignes.message}</p>}

                    <div className="space-y-2">
                      {fields.map((field, index) => (
                        <div key={field.id} className="grid grid-cols-[1fr_5rem_6rem_auto] gap-2 items-start">
                          <Controller
                            control={control}
                            name={`lignes.${index}.article_id`}
                            render={({ field: f }) => (
                              <select
                                {...f}
                                onChange={(e) => {
                                  f.onChange(e)
                                  const article = articles.find((a) => a.id === e.target.value)
                                  if (article) {
                                    setValue(`lignes.${index}.prix_unitaire`, article.prix_vente)
                                  }
                                }}
                                className="rounded-md bg-background border border-surface-border text-foreground px-2 py-2 text-sm"
                              >
                                <option value="">{t.articlePlaceholder}</option>
                                {articles.map((a) => (
                                  <option key={a.id} value={a.id}>{a.designation}</option>
                                ))}
                              </select>
                            )}
                          />
                          <input
                            type="number"
                            step="0.01"
                            placeholder={t.quantitePlaceholder}
                            {...register(`lignes.${index}.quantite`)}
                            className="rounded-md bg-background border border-surface-border text-foreground px-2 py-2 text-sm"
                          />
                          <input
                            type="number"
                            step="0.01"
                            placeholder={t.prixUnitairePlaceholder}
                            {...register(`lignes.${index}.prix_unitaire`)}
                            className="rounded-md bg-background border border-surface-border text-foreground px-2 py-2 text-sm"
                          />
                          <button
                            type="button"
                            onClick={() => fields.length > 1 && remove(index)}
                            className="text-foreground-muted hover:text-danger p-2"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t border-surface-border pt-3">
                    <span className="text-sm text-foreground-muted">{t.totalLabel}</span>
                    <span className="text-lg font-bold text-foreground">{montantTotal.toLocaleString('fr-FR')}</span>
                  </div>

                  {(modePaiement === 'comptant' || modePaiement === 'mixte') && (
                    <div>
                      <label className="block text-sm font-medium text-foreground">{t.montantPayeLabel}</label>
                      <input
                        type="number"
                        step="0.01"
                        {...register('montant_paye')}
                        className="mt-1 block w-full rounded-md bg-background border border-surface-border text-foreground px-3 py-2"
                      />
                      {errors.montant_paye && <p className="text-xs text-danger mt-1">{errors.montant_paye.message}</p>}
                    </div>
                  )}
                </form>
              </div>
              <div className="bg-background/50 px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6">
                <button
                  type="submit"
                  form="creer-vente-form"
                  disabled={loading}
                  className="inline-flex w-full justify-center rounded-md bg-primary px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-hover sm:ml-3 sm:w-auto disabled:opacity-50"
                >
                  {loading ? c.saving : t.validate}
                </button>
                <button
                  type="button"
                  onClick={close}
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
