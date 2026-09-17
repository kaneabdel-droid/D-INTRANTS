'use client'

import { useState, useTransition } from 'react'
import { Check } from 'lucide-react'
import { PALIERS, DUREES, calculerMontantFcfa, type PalierCode, type DureeMois } from '@/lib/abonnements/paliers'
import { PAYS_TELEPHONE_SUPPORTES } from '@/lib/abonnements/telephone'
import { demarrerPaiementAbonnement } from './actions'

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

export default function PlanSelector({ palierActuel, telephoneParDefaut }: { palierActuel?: PalierCode; telephoneParDefaut?: string }) {
  const [palier, setPalier] = useState<PalierCode>(palierActuel ?? 'standard')
  const [dureeMois, setDureeMois] = useState<DureeMois>(1)
  const [telephonePays, setTelephonePays] = useState<string>('SN')
  const [telephoneLocal, setTelephoneLocal] = useState<string>(telephoneParDefaut ?? '')
  const [erreur, setErreur] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const montant = calculerMontantFcfa(palier, dureeMois)

  const handlePayer = () => {
    setErreur(null)
    startTransition(async () => {
      const resultat = await demarrerPaiementAbonnement(palier, dureeMois, telephonePays, telephoneLocal)
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
              <p className="text-2xl font-bold font-heading">{formatFcfa(info.prixMensuelFcfa)}</p>
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

      <div className="grid grid-cols-[7rem_1fr] gap-3">
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Pays</label>
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
          <label className="block text-sm font-medium text-foreground mb-1">Numéro de téléphone</label>
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

      <div className="flex items-center justify-between rounded-lg bg-surface border border-surface-border px-4 py-3">
        <div>
          <p className="text-sm text-foreground-muted">Total à payer</p>
          <p className="text-xl font-bold font-heading">{formatFcfa(montant)}</p>
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
