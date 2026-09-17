'use client'

import { useState, useTransition } from 'react'
import { Check } from 'lucide-react'
import { PALIERS, DUREES, calculerMontantFcfa, type PalierCode, type DureeMois } from '@/lib/abonnements/paliers'
import { PAYS_TELEPHONE_SUPPORTES } from '@/lib/abonnements/telephone'
import { demarrerInscription } from './actions'

const NOM_PAYS: Record<string, string> = {
  SN: 'Sénégal',
  CI: "Côte d'Ivoire",
  ML: 'Mali',
  BJ: 'Bénin',
  BF: 'Burkina Faso',
  TG: 'Togo',
}

function formatFcfa(montant: number): string {
  return `${montant.toLocaleString('fr-FR')} FCFA`
}

type Dict = {
  duration: string
  companyName: string
  companyNamePlaceholder: string
  contactName: string
  contactNamePlaceholder: string
  email: string
  country: string
  phone: string
  totalToPay: string
  payNow: string
  redirecting: string
  storesUpTo: string
  perMonth: string
  afterPaymentNote: string
}

export default function InscriptionForm({ t }: { t: Dict }) {
  const [palier, setPalier] = useState<PalierCode>('standard')
  const [dureeMois, setDureeMois] = useState<DureeMois>(1)
  const [nomEntreprise, setNomEntreprise] = useState('')
  const [contactNom, setContactNom] = useState('')
  const [email, setEmail] = useState('')
  const [telephonePays, setTelephonePays] = useState('SN')
  const [telephoneLocal, setTelephoneLocal] = useState('')
  const [erreur, setErreur] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const montant = calculerMontantFcfa(palier, dureeMois)

  const pretAEnvoyer = nomEntreprise.trim() && contactNom.trim() && email.trim() && telephoneLocal.trim()

  const handlePayer = () => {
    setErreur(null)
    startTransition(async () => {
      const resultat = await demarrerInscription(nomEntreprise, contactNom, email, telephoneLocal, telephonePays, palier, dureeMois)
      if ('error' in resultat) {
        setErreur(resultat.error)
        return
      }
      window.location.href = resultat.checkoutUrl
    })
  }

  return (
    <div className="space-y-8">
      <div className="grid sm:grid-cols-3 gap-4">
        {(Object.keys(PALIERS) as PalierCode[]).map((code) => {
          const info = PALIERS[code]
          const selectionne = palier === code
          return (
            <button
              key={code}
              type="button"
              onClick={() => setPalier(code)}
              className={`text-left rounded-2xl border p-6 transition-all ${
                selectionne ? 'border-primary bg-primary/5 shadow-md' : 'border-surface-border bg-surface hover:border-primary/50'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-lg">{info.nom}</span>
                {selectionne && <Check className="h-5 w-5 text-primary" />}
              </div>
              <p className="text-3xl font-bold font-heading">{formatFcfa(info.prixMensuelFcfa)}</p>
              <p className="text-sm text-foreground-muted mb-3">{t.perMonth}</p>
              <p className="text-sm text-foreground-muted">
                {t.storesUpTo.replace('{n}', String(info.magasinsMax))}
              </p>
            </button>
          )
        })}
      </div>

      <div className="max-w-lg mx-auto rounded-2xl border border-surface-border bg-surface p-6 sm:p-8 space-y-5">
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">{t.duration}</label>
          <div className="flex gap-2">
            {DUREES.map((d) => (
              <button
                key={d.mois}
                type="button"
                onClick={() => setDureeMois(d.mois)}
                className={`flex-1 rounded-md border px-3 py-2 text-sm ${
                  dureeMois === d.mois ? 'border-primary bg-primary text-white' : 'border-surface-border bg-background text-foreground hover:border-primary/50'
                }`}
              >
                {d.label}
                {d.reduction > 0 && <span className="block text-xs opacity-80">-{Math.round(d.reduction * 100)}%</span>}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-1">{t.companyName}</label>
          <input
            type="text"
            value={nomEntreprise}
            onChange={(e) => setNomEntreprise(e.target.value)}
            disabled={isPending}
            placeholder={t.companyNamePlaceholder}
            className="w-full rounded-md bg-background border border-surface-border text-foreground px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-1">{t.contactName}</label>
          <input
            type="text"
            value={contactNom}
            onChange={(e) => setContactNom(e.target.value)}
            disabled={isPending}
            placeholder={t.contactNamePlaceholder}
            className="w-full rounded-md bg-background border border-surface-border text-foreground px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-1">{t.email}</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={isPending}
            placeholder="vous@exemple.com"
            className="w-full rounded-md bg-background border border-surface-border text-foreground px-3 py-2 text-sm"
          />
        </div>

        <div className="grid grid-cols-[7rem_1fr] gap-3">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">{t.country}</label>
            <select
              value={telephonePays}
              onChange={(e) => setTelephonePays(e.target.value)}
              disabled={isPending}
              className="w-full rounded-md bg-background border border-surface-border text-foreground px-2 py-2 text-sm"
            >
              {PAYS_TELEPHONE_SUPPORTES.map((code) => (
                <option key={code} value={code}>
                  {NOM_PAYS[code] ?? code}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">{t.phone}</label>
            <input
              type="tel"
              value={telephoneLocal}
              onChange={(e) => setTelephoneLocal(e.target.value)}
              disabled={isPending}
              placeholder="77 123 45 67"
              className="w-full rounded-md bg-background border border-surface-border text-foreground px-3 py-2 text-sm"
            />
          </div>
        </div>

        {erreur && <p className="text-sm text-danger">{erreur}</p>}

        <div className="flex items-center justify-between rounded-lg bg-background border border-surface-border px-4 py-3">
          <div>
            <p className="text-sm text-foreground-muted">{t.totalToPay}</p>
            <p className="text-xl font-bold font-heading">{formatFcfa(montant)}</p>
          </div>
          <button
            type="button"
            onClick={handlePayer}
            disabled={isPending || !pretAEnvoyer}
            className="rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-hover disabled:opacity-50"
          >
            {isPending ? t.redirecting : t.payNow}
          </button>
        </div>
        <p className="text-xs text-foreground-muted text-center">
          {t.afterPaymentNote}
        </p>
      </div>
    </div>
  )
}
