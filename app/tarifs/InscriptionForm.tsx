'use client'

import { useState, useTransition } from 'react'
import { Check, Smartphone } from 'lucide-react'
import { PALIERS, DUREES, calculerMontantFcfa, calculerMontantUsd, TAUX_FCFA_PAR_USD, type PalierCode, type DureeMois } from '@/lib/abonnements/paliers'
import { AUTRE_PAYS, PAYS, paieEnDollars } from '@/lib/pays'
import { demarrerInscription } from './actions'

function formatFcfa(montant: number): string {
  return `${montant.toLocaleString('fr-FR')} FCFA`
}

function formatUsd(montant: number): string {
  return `${montant.toLocaleString('en-US')} $`
}

/** Pays triés selon leur nom dans la langue du visiteur (noms français si le navigateur ne sait pas traduire). */
function paysTries(locale: string) {
  let noms: Intl.DisplayNames | null = null
  try {
    noms = new Intl.DisplayNames([locale], { type: 'region' })
  } catch {}
  return PAYS.map((p) => ({ code: p.code, nom: noms?.of(p.code) ?? p.nom })).sort((a, b) => a.nom.localeCompare(b.nom, locale))
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
  otherCountry: string
  otherCountryName: string
  usdNote: string
  perMonth: string
  afterPaymentNote: string
}

export default function InscriptionForm({ t, locale }: { t: Dict; locale: string }) {
  const [palier, setPalier] = useState<PalierCode>('standard')
  const [dureeMois, setDureeMois] = useState<DureeMois>(1)
  const [nomEntreprise, setNomEntreprise] = useState('')
  const [contactNom, setContactNom] = useState('')
  const [email, setEmail] = useState('')
  const [telephonePays, setTelephonePays] = useState('SN')
  const [telephoneLocal, setTelephoneLocal] = useState('')
  const [nomPaysAutre, setNomPaysAutre] = useState('')
  const [erreur, setErreur] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [moyenPaiement, setMoyenPaiement] = useState('maketou')

  // « Autre pays » : abonnement payé par carte en dollars US
  const enDollars = paieEnDollars(telephonePays)
  const prix = (fcfa: number) => (enDollars ? formatUsd(Math.max(1, Math.round(fcfa / TAUX_FCFA_PAR_USD))) : formatFcfa(fcfa))
  const montant = enDollars ? formatUsd(calculerMontantUsd(palier, dureeMois)) : formatFcfa(calculerMontantFcfa(palier, dureeMois))

  const pretAEnvoyer =
    nomEntreprise.trim() && contactNom.trim() && email.trim() && telephoneLocal.trim() && (!enDollars || nomPaysAutre.trim())

  const handlePayer = () => {
    setErreur(null)
    startTransition(async () => {
      const resultat = await demarrerInscription(nomEntreprise, contactNom, email, telephoneLocal, telephonePays, palier, dureeMois, nomPaysAutre, moyenPaiement)
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
              <p className="text-3xl font-bold font-heading">{prix(info.prixMensuelFcfa)}</p>
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

        <div>
          <label htmlFor="pays" className="block text-sm font-medium text-foreground mb-1">{t.country}</label>
          <select
            id="pays"
            value={telephonePays}
            onChange={(e) => setTelephonePays(e.target.value)}
            disabled={isPending}
            className="w-full rounded-md bg-background border border-surface-border text-foreground px-3 py-2 text-sm"
          >
            {paysTries(locale).map((p) => (
              <option key={p.code} value={p.code}>
                {p.nom}
              </option>
            ))}
            <option value={AUTRE_PAYS}>{t.otherCountry}</option>
          </select>
        </div>

        {enDollars && (
          <div>
            <label htmlFor="nom-pays" className="block text-sm font-medium text-foreground mb-1">{t.otherCountryName}</label>
            <input
              id="nom-pays"
              type="text"
              value={nomPaysAutre}
              onChange={(e) => setNomPaysAutre(e.target.value)}
              disabled={isPending}
              className="w-full rounded-md bg-background border border-surface-border text-foreground px-3 py-2 text-sm"
            />
            <p className="mt-1 text-xs text-foreground-muted">{t.usdNote}</p>
          </div>
        )}

        <div>
          <label htmlFor="telephone" className="block text-sm font-medium text-foreground mb-1">{t.phone}</label>
          <input
            id="telephone"
            type="tel"
            value={telephoneLocal}
            onChange={(e) => setTelephoneLocal(e.target.value)}
            disabled={isPending}
            placeholder={enDollars ? '+44 7700 900123' : '77 123 45 67'}
            className="w-full rounded-md bg-background border border-surface-border text-foreground px-3 py-2 text-sm"
          />
        </div>

        
        {!enDollars && (
          <div className="mt-4">
            <label className="block text-sm font-medium text-foreground mb-3">Moyen de paiement</label>
            <div className="grid grid-cols-2 gap-3">
              <label className={`relative flex flex-col items-center justify-center p-4 rounded-xl border-2 cursor-pointer transition-all ${moyenPaiement === 'maketou' ? 'border-primary bg-primary/5' : 'border-surface-border bg-surface hover:bg-black/5'}`}>
                <input type="radio" name="paymentMethod" value="maketou" checked={moyenPaiement === 'maketou'} onChange={() => setMoyenPaiement('maketou')} className="sr-only" />
                <Smartphone className={`w-6 h-6 mb-2 ${moyenPaiement === 'maketou' ? 'text-primary' : 'text-foreground-muted'}`} />
                <span className={`font-semibold text-sm ${moyenPaiement === 'maketou' ? 'text-primary' : 'text-foreground'}`}>Maketou</span>
              </label>
              <label className={`relative flex flex-col items-center justify-center p-4 rounded-xl border-2 cursor-pointer transition-all ${moyenPaiement === 'chariow' ? 'border-primary bg-primary/5' : 'border-surface-border bg-surface hover:bg-black/5'}`}>
                <input type="radio" name="paymentMethod" value="chariow" checked={moyenPaiement === 'chariow'} onChange={() => setMoyenPaiement('chariow')} className="sr-only" />
                <Smartphone className={`w-6 h-6 mb-2 ${moyenPaiement === 'chariow' ? 'text-primary' : 'text-foreground-muted'}`} />
                <span className={`font-semibold text-sm ${moyenPaiement === 'chariow' ? 'text-primary' : 'text-foreground'}`}>Chariow</span>
              </label>
            </div>
          </div>
        )}
      

        {erreur && <p className="text-sm text-danger">{erreur}</p>}

        <div className="flex items-center justify-between rounded-lg bg-background border border-surface-border px-4 py-3">
          <div>
            <p className="text-sm text-foreground-muted">{t.totalToPay}</p>
            <p className="text-xl font-bold font-heading">{montant}</p>
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
