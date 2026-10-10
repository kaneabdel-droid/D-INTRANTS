'use client'

import { useState, useTransition } from 'react'
import { Check, Smartphone } from 'lucide-react'
import { PALIERS, DUREES, calculerMontantFcfa, calculerMontantUsd, TAUX_FCFA_PAR_USD, type PalierCode, type DureeMois } from '@/lib/abonnements/paliers'
import { AUTRE_PAYS, PAYS, paieEnDollars } from '@/lib/pays'
import { demarrerPaiementAbonnement } from './actions'

const PAYS_TRIES = [...PAYS].sort((a, b) => a.nom.localeCompare(b.nom, 'fr'))

function formatFcfa(montant: number): string {
  return `${montant.toLocaleString('fr-FR')} FCFA`
}

function formatUsd(montant: number): string {
  return `${montant.toLocaleString('en-US')} $`
}

export default function PlanSelector({
  palierActuel,
  telephoneParDefaut,
  autrePays = false,
}: {
  palierActuel?: PalierCode
  telephoneParDefaut?: string
  /** Entreprise « sans unité » (pays dont la devise n'est pas gérée) : « Autre pays » présélectionné, paiement en dollars. */
  autrePays?: boolean
}) {
  const [palier, setPalier] = useState<PalierCode>(palierActuel ?? 'standard')
  const [dureeMois, setDureeMois] = useState<DureeMois>(1)
  const [telephonePays, setTelephonePays] = useState<string>(autrePays ? AUTRE_PAYS : 'SN')
  const [telephoneLocal, setTelephoneLocal] = useState<string>(telephoneParDefaut ?? '')
  const [erreur, setErreur] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [moyenPaiement, setMoyenPaiement] = useState('maketou')

  // « Autre pays » : abonnement payé par carte en dollars US
  const enDollars = paieEnDollars(telephonePays)
  const prix = (fcfa: number) => (enDollars ? formatUsd(Math.max(1, Math.round(fcfa / TAUX_FCFA_PAR_USD))) : formatFcfa(fcfa))
  const montant = enDollars ? formatUsd(calculerMontantUsd(palier, dureeMois)) : formatFcfa(calculerMontantFcfa(palier, dureeMois))

  const handlePayer = () => {
    setErreur(null)
    startTransition(async () => {
      const resultat = await demarrerPaiementAbonnement(palier, dureeMois, telephonePays, telephoneLocal, moyenPaiement)
      if ('error' in resultat) {
        setErreur(resultat.error)
        return
      }
      window.location.href = resultat.checkoutUrl
    })
  }

  return (
    <div className="space-y-6">
      <div className="grid sm:grid-cols-3 gap-4">
        {(Object.keys(PALIERS) as PalierCode[]).map((code) => {
          const info = PALIERS[code]
          const selectionne = palier === code
          return (
            <button
              key={code}
              type="button"
              onClick={() => setPalier(code)}
              className={`text-left rounded-xl border p-4 transition-colors ${
                selectionne ? 'border-primary bg-primary/5' : 'border-surface-border bg-background hover:border-primary/50'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold">{info.nom}</span>
                {selectionne && <Check className="h-4 w-4 text-primary" />}
                {palierActuel === code && !selectionne && <span className="text-xs text-foreground-muted">Actuel</span>}
              </div>
              <p className="text-2xl font-bold font-heading">{prix(info.prixMensuelFcfa)}</p>
              <p className="text-xs text-foreground-muted">/ mois</p>
              <p className="text-sm text-foreground-muted mt-2">
                {info.magasinsMax} magasin{info.magasinsMax > 1 ? 's' : ''}
              </p>
            </button>
          )
        })}
      </div>

      <div>
        <label className="block text-sm font-medium text-foreground mb-2">Durée</label>
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

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="pays" className="block text-sm font-medium text-foreground mb-1">Pays</label>
          <select
            id="pays"
            value={telephonePays}
            onChange={(e) => setTelephonePays(e.target.value)}
            disabled={isPending}
            className="w-full rounded-md bg-background border border-surface-border text-foreground px-3 py-2 text-sm"
          >
            {PAYS_TRIES.map((p) => (
              <option key={p.code} value={p.code}>
                {p.nom}
              </option>
            ))}
            <option value={AUTRE_PAYS}>Autre pays</option>
          </select>
        </div>
        <div>
          <label htmlFor="telephone" className="block text-sm font-medium text-foreground mb-1">Numéro de téléphone</label>
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
      </div>
      {enDollars && (
        <p className="text-xs text-foreground-muted">Hors des pays listés, l’abonnement se paie par carte bancaire en dollars US (numéro au format international).</p>
      )}

      
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

      <div className="flex items-center justify-between rounded-lg bg-surface border border-surface-border px-4 py-3">
        <div>
          <p className="text-sm text-foreground-muted">Total à payer</p>
          <p className="text-xl font-bold font-heading">{montant}</p>
        </div>
        <button
          type="button"
          onClick={handlePayer}
          disabled={isPending || !telephoneLocal.trim()}
          className="rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-hover disabled:opacity-50"
        >
          {isPending ? 'Redirection...' : 'Payer maintenant'}
        </button>
      </div>
    </div>
  )
}
