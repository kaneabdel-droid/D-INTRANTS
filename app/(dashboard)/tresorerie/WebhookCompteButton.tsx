'use client'

import { useState } from 'react'
import { Settings, Copy, Check } from 'lucide-react'
import type { Dictionary } from '@/dictionaries'
import { configurerWebhookMobileMoney, genererCleWebhookMobileMoney } from './actions'

const CORPS_GENERIQUE_EXEMPLE = `{
  "montant": 15000,
  "reference": "TX2609271234",
  "expediteur": "77 000 00 00",
  "libelle": "Paiement boutique"
}`

export default function WebhookCompteButton({
  compteId,
  fournisseur,
  identifiantMarchand,
  aCleWebhook,
  dict,
}: {
  compteId: string
  fournisseur: string | null
  identifiantMarchand: string | null
  aCleWebhook: boolean
  dict: Dictionary
}) {
  const t = dict.tresorerie
  const c = dict.common
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cleGeneree, setCleGeneree] = useState<string | null>(null)
  const [aCleLocal, setACleLocal] = useState(aCleWebhook)
  const [copie, setCopie] = useState(false)

  async function enregistrerConfig(formData: FormData) {
    setLoading(true)
    setError(null)
    const res = await configurerWebhookMobileMoney(formData)
    setLoading(false)
    if (res?.error) setError(res.error)
  }

  async function genererCle() {
    setLoading(true)
    setError(null)
    const res = await genererCleWebhookMobileMoney(compteId)
    setLoading(false)
    if (res?.error) setError(res.error)
    else if (res?.cle) {
      setCleGeneree(res.cle)
      setACleLocal(true)
      setCopie(false)
    }
  }

  const urlWebhook = cleGeneree
    ? `${process.env.NEXT_PUBLIC_SITE_URL ?? (typeof window !== 'undefined' ? window.location.origin : '')}/api/webhooks/mobile-money/${compteId}?secret=${cleGeneree}`
    : null

  async function copier() {
    if (!urlWebhook) return
    await navigator.clipboard.writeText(urlWebhook)
    setCopie(true)
    setTimeout(() => setCopie(false), 2000)
  }

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setIsOpen(true)
        }}
        title={t.webhookButton}
        className="absolute right-1 top-1 rounded p-1 text-foreground-muted hover:bg-background hover:text-foreground"
      >
        <Settings className="h-3 w-3" />
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto" onClick={(e) => e.stopPropagation()}>
          <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
            <div
              className="fixed inset-0 bg-black bg-opacity-75 transition-opacity"
              onClick={(e) => {
                e.preventDefault()
                setIsOpen(false)
              }}
            />
            <div className="relative transform overflow-hidden rounded-lg bg-surface text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg border border-surface-border">
              <div className="max-h-[80vh] overflow-y-auto bg-surface px-4 pb-4 pt-5 sm:p-6 sm:pb-4">
                <h3 className="text-lg font-semibold leading-6 text-foreground mb-2">{t.webhookTitle}</h3>
                <p className="text-xs text-foreground-muted mb-4">{t.webhookIntro}</p>
                {error && <p className="text-xs text-danger mb-2">{error}</p>}

                <form action={enregistrerConfig} className="space-y-4 mb-6">
                  <input type="hidden" name="compte_tresorerie_id" value={compteId} />
                  <div>
                    <label className="block text-sm font-medium text-foreground">{t.webhookFournisseurLabel}</label>
                    <select
                      name="fournisseur_electronique"
                      defaultValue={fournisseur ?? ''}
                      className="mt-1 block w-full rounded-md bg-background border border-surface-border text-foreground px-3 py-2"
                    >
                      <option value="">{t.webhookFournisseurNonChoisi}</option>
                      <option value="wave">{t.webhookFournisseurWave}</option>
                      <option value="orange_money">{t.webhookFournisseurOrange}</option>
                      <option value="generique">{t.webhookFournisseurGenerique}</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground">{t.webhookIdentifiantLabel}</label>
                    <input
                      name="identifiant_marchand"
                      type="text"
                      defaultValue={identifiantMarchand ?? ''}
                      placeholder={t.webhookIdentifiantPlaceholder}
                      className="mt-1 block w-full rounded-md bg-background border border-surface-border text-foreground px-3 py-2"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="rounded-md bg-primary px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-hover disabled:opacity-50"
                  >
                    {loading ? c.creating : t.webhookEnregistrer}
                  </button>
                </form>

                <div className="border-t border-surface-border pt-4">
                  <h4 className="text-sm font-semibold text-foreground mb-1">{t.webhookCleTitre}</h4>
                  <p className="text-xs text-foreground-muted mb-2">
                    {aCleLocal ? t.webhookCleConfiguree : t.webhookAucuneCle}
                  </p>
                  {aCleLocal && !cleGeneree && (
                    <p className="text-xs text-warning mb-2">{t.webhookRegenererAvertissement}</p>
                  )}
                  <button
                    type="button"
                    onClick={genererCle}
                    disabled={loading}
                    className="rounded-md bg-surface border border-surface-border px-3 py-2 text-sm font-semibold text-foreground shadow-sm hover:bg-background disabled:opacity-50"
                  >
                    {aCleLocal ? t.webhookRegenererCle : t.webhookGenererCle}
                  </button>

                  {urlWebhook && (
                    <div className="mt-4">
                      <p className="text-xs font-medium text-success mb-1">{t.webhookCleAffichee}</p>
                      <label className="block text-xs font-medium text-foreground-muted">{t.webhookUrlLabel}</label>
                      <div className="mt-1 flex items-center gap-2">
                        <code className="flex-1 break-all rounded-md bg-background border border-surface-border px-2 py-1.5 text-xs text-foreground">
                          {urlWebhook}
                        </code>
                        <button
                          type="button"
                          onClick={copier}
                          className="shrink-0 rounded-md bg-surface border border-surface-border p-1.5 text-foreground-muted hover:bg-background hover:text-foreground"
                          title={t.webhookCopier}
                        >
                          {copie ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="mt-4">
                    <p className="text-xs font-semibold text-foreground">{t.webhookFormatGeneriqueTitre}</p>
                    <pre className="mt-1 overflow-x-auto rounded-md bg-background border border-surface-border px-2 py-1.5 text-[11px] text-foreground-muted">
                      {CORPS_GENERIQUE_EXEMPLE}
                    </pre>
                  </div>

                  <p className="mt-4 text-[11px] text-foreground-muted">{t.webhookNoteWaveOrange}</p>
                </div>
              </div>
              <div className="bg-background/50 px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="inline-flex w-full justify-center rounded-md bg-surface px-3 py-2 text-sm font-semibold text-foreground shadow-sm ring-1 ring-inset ring-surface-border hover:bg-background sm:mt-0 sm:w-auto"
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
