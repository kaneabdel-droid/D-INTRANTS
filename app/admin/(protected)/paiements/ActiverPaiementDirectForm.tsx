'use client'

import { useState, useTransition } from 'react'
import { Banknote, Landmark, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'
import { PALIERS, DUREES, calculerMontantFcfa, type PalierCode, type DureeMois } from '@/lib/abonnements/paliers'
import type { MoyenPaiementManuel } from '@/lib/abonnements/types'
import { activerAbonnementEntreprise } from './actions'

type EntrepriseOption = { id: string; nom: string; palier: string }

export default function ActiverPaiementDirectForm({ entreprises }: { entreprises: EntrepriseOption[] }) {
  const [entrepriseId, setEntrepriseId] = useState(entreprises[0]?.id ?? '')
  const [palier, setPalier] = useState<PalierCode>((entreprises[0]?.palier as PalierCode) || 'standard')
  const [dureeMois, setDureeMois] = useState<DureeMois>(1)
  const [moyen, setMoyen] = useState<MoyenPaiementManuel>('caisse')
  const [isPending, startTransition] = useTransition()

  const montant = calculerMontantFcfa(palier, dureeMois)

  const handleEntrepriseChange = (id: string) => {
    setEntrepriseId(id)
    const ent = entreprises.find((e) => e.id === id)
    if (ent && ent.palier in PALIERS) {
      setPalier(ent.palier as PalierCode)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!entrepriseId) {
      toast.error('Sélectionnez une entreprise')
      return
    }
    const ent = entreprises.find((x) => x.id === entrepriseId)
    const labelMoyen = moyen === 'caisse' ? 'Caisse (Espèces)' : 'Virement bancaire'
    if (
      !confirm(
        `Confirmer l'activation immédiate de l'abonnement ${PALIERS[palier].nom} (${dureeMois} mois — ${montant.toLocaleString('fr-FR')} FCFA) par ${labelMoyen} pour "${ent?.nom ?? entrepriseId}" ?`
      )
    ) {
      return
    }

    startTransition(async () => {
      const res = await activerAbonnementEntreprise(entrepriseId, palier, dureeMois, moyen)
      if (res.error) {
        toast.error(res.error)
      } else {
        toast.success(`Abonnement ${PALIERS[palier].nom} (${dureeMois} mois) activé pour ${ent?.nom ?? "l'entreprise"}`)
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="bg-background rounded-xl border border-surface-border p-5 mb-6">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <div>
          <h2 className="font-semibold text-base">Activer directement un abonnement (Caisse / Virement)</h2>
          <p className="text-xs text-foreground-muted">
            Enregistre le paiement et crédite immédiatement l&apos;abonnement de l&apos;entreprise.
          </p>
        </div>
        <span className="text-sm font-bold text-primary">
          {montant.toLocaleString('fr-FR')} FCFA
        </span>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
        <div className="lg:col-span-2">
          <label className="block text-xs text-foreground-muted mb-1">Entreprise</label>
          <select
            value={entrepriseId}
            onChange={(e) => handleEntrepriseChange(e.target.value)}
            disabled={isPending || entreprises.length === 0}
            className="w-full rounded-md border border-surface-border bg-surface px-3 py-2 text-sm text-foreground"
          >
            {entreprises.length === 0 && <option value="">Aucune entreprise</option>}
            {entreprises.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nom}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs text-foreground-muted mb-1">Palier</label>
          <select
            value={palier}
            onChange={(e) => setPalier(e.target.value as PalierCode)}
            disabled={isPending}
            className="w-full rounded-md border border-surface-border bg-surface px-3 py-2 text-sm text-foreground"
          >
            {(Object.keys(PALIERS) as PalierCode[]).map((code) => (
              <option key={code} value={code}>
                {PALIERS[code].nom} ({PALIERS[code].prixMensuelFcfa.toLocaleString('fr-FR')} F/m)
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs text-foreground-muted mb-1">Durée</label>
          <select
            value={dureeMois}
            onChange={(e) => setDureeMois(Number(e.target.value) as DureeMois)}
            disabled={isPending}
            className="w-full rounded-md border border-surface-border bg-surface px-3 py-2 text-sm text-foreground"
          >
            {DUREES.map((d) => (
              <option key={d.mois} value={d.mois}>
                {d.label} {d.reduction > 0 ? `(-${Math.round(d.reduction * 100)}%)` : ''}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs text-foreground-muted mb-1">Mode de règlement</label>
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => setMoyen('caisse')}
              disabled={isPending}
              className={`flex-1 inline-flex items-center justify-center gap-1 rounded-md border px-2.5 py-2 text-xs font-medium ${
                moyen === 'caisse'
                  ? 'border-primary bg-primary text-white'
                  : 'border-surface-border bg-surface text-foreground hover:border-primary/50'
              }`}
            >
              <Banknote className="h-3.5 w-3.5" />
              Caisse
            </button>
            <button
              type="button"
              onClick={() => setMoyen('virement')}
              disabled={isPending}
              className={`flex-1 inline-flex items-center justify-center gap-1 rounded-md border px-2.5 py-2 text-xs font-medium ${
                moyen === 'virement'
                  ? 'border-primary bg-primary text-white'
                  : 'border-surface-border bg-surface text-foreground hover:border-primary/50'
              }`}
            >
              <Landmark className="h-3.5 w-3.5" />
              Virement
            </button>
          </div>
        </div>
      </div>

      <div className="mt-4 flex justify-end">
        <button
          type="submit"
          disabled={isPending || !entrepriseId}
          className="inline-flex items-center gap-2 rounded-md bg-success px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
        >
          <CheckCircle2 className="h-4 w-4" />
          {isPending ? 'Activation en cours...' : "Activer directement le paiement"}
        </button>
      </div>
    </form>
  )
}

