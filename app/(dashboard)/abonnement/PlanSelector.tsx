'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Smartphone, Banknote, Landmark, CheckCircle2 } from 'lucide-react'
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
  const router = useRouter()
  const [palier, setPalier] = useState<PalierCode>(palierActuel ?? 'standard')
  const [dureeMois, setDureeMois] = useState<DureeMois>(1)
  const [telephonePays, setTelephonePays] = useState<string>(autrePays ? AUTRE_PAYS : 'SN')
  const [telephoneLocal, setTelephoneLocal] = useState<string>(telephoneParDefaut ?? '')
  const [erreur, setErreur] = useState<string | null>(null)
  const [confirmationManuelle, setConfirmationManuelle] = useState<'caisse' | 'virement' | null>(null)
  const [isPending, startTransition] = useTransition()
  const [moyenPaiement, setMoyenPaiement] = useState('maketou')

  const enDollars = paieEnDollars(telephonePays)
  const estManuel = !enDollars && (moyenPaiement === 'caisse' || moyenPaiement === 'virement')
  const prix = (fcfa: number) => (enDollars ? formatUsd(Math.max(1, Math.round(fcfa / TAUX_FCFA_PAR_USD))) : formatFcfa(fcfa))
  const montant = enDollars ? formatUsd(calculerMontantUsd(palier, dureeMois)) : formatFcfa(calculerMontantFcfa(palier, dureeMois))

  const handlePayer = () => {
    setErreur(null)
    setConfirmationManuelle(null)
    startTransition(async () => {
      const resultat = await demarrerPaiementAbonnement(palier, dureeMois, telephonePays, telephoneLocal, moyenPaiement)
      if ('error' in resultat) {
        setErreur(typeof resultat.error === 'string' ? resultat.error : JSON.stringify(resultat.error))
        return
      }
      if ('modeManuel' in resultat) {
        setConfirmationManuelle(resultat.modeManuel)
        router.refresh()
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
          <label htmlFor="telephone" className="block text-sm font-medium text-foreground mb-1">
            Numéro de téléphone {estManuel && <span className="text-foreground-muted font-normal">(optionnel)</span>}
          </label>
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
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
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
            <label className={`relative flex flex-col items-center justify-center p-4 rounded-xl border-2 cursor-pointer transition-all ${moyenPaiement === 'caisse' ? 'border-primary bg-primary/5' : 'border-surface-border bg-surface hover:bg-black/5'}`}>
              <input type="radio" name="paymentMethod" value="caisse" checked={moyenPaiement === 'caisse'} onChange={() => setMoyenPaiement('caisse')} className="sr-only" />
              <Banknote className={`w-6 h-6 mb-2 ${moyenPaiement === 'caisse' ? 'text-primary' : 'text-foreground-muted'}`} />
              <span className={`font-semibold text-sm ${moyenPaiement === 'caisse' ? 'text-primary' : 'text-foreground'}`}>Caisse (Espèces)</span>
            </label>
            <label className={`relative flex flex-col items-center justify-center p-4 rounded-xl border-2 cursor-pointer transition-all ${moyenPaiement === 'virement' ? 'border-primary bg-primary/5' : 'border-surface-border bg-surface hover:bg-black/5'}`}>
              <input type="radio" name="paymentMethod" value="virement" checked={moyenPaiement === 'virement'} onChange={() => setMoyenPaiement('virement')} className="sr-only" />
              <Landmark className={`w-6 h-6 mb-2 ${moyenPaiement === 'virement' ? 'text-primary' : 'text-foreground-muted'}`} />
              <span className={`font-semibold text-sm ${moyenPaiement === 'virement' ? 'text-primary' : 'text-foreground'}`}>Virement</span>
            </label>
          </div>
        </div>
      )}

      {!enDollars && moyenPaiement === 'virement' && (
        <div className="rounded-lg bg-surface border border-surface-border p-4 text-sm space-y-1">
          <p className="font-medium text-foreground">Instructions de virement bancaire</p>
          <p className="font-mono text-primary font-semibold">SN048 08002 01057183001 43</p>
          <p className="text-xs text-foreground-muted">
            Effectuez le virement en indiquant le nom de votre entreprise en motif. Votre abonnement sera activé dès validation par l&apos;administrateur.
          </p>
        </div>
      )}

      {!enDollars && moyenPaiement === 'caisse' && (
        <div className="rounded-lg bg-surface border border-surface-border p-4 text-sm space-y-1">
          <p className="font-medium text-foreground">Paiement en espèces à la caisse</p>
          <p className="text-xs text-foreground-muted">
            Enregistrez votre demande ci-dessous : votre abonnement sera activé directement dès réception du règlement en caisse par l&apos;administrateur.
          </p>
        </div>
      )}

      {confirmationManuelle && (
        <div className="flex items-start gap-3 rounded-lg bg-success/10 border border-success/20 p-4 text-sm text-success">
          <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">
              Demande de paiement par {confirmationManuelle === 'caisse' ? 'caisse (espèces)' : 'virement bancaire'} enregistrée !
            </p>
            <p className="text-xs mt-1 text-foreground-muted">
              Votre abonnement sera activé dès validation du règlement par le super-administrateur.
            </p>
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
          disabled={isPending || (!estManuel && !telephoneLocal.trim())}
          className="rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-hover disabled:opacity-50"
        >
          {isPending
            ? estManuel
              ? 'Enregistrement...'
              : 'Redirection...'
            : estManuel
              ? `Valider (${moyenPaiement === 'caisse' ? 'Caisse' : 'Virement'})`
              : 'Payer maintenant'}
        </button>
      </div>
    </div>
  )
}
