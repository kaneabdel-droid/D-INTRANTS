'use client'

import { useState, useTransition } from 'react'
import { Banknote, Landmark, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'
import { PALIERS, DUREES, calculerMontantFcfa, type PalierCode, type DureeMois } from '@/lib/abonnements/paliers'
import type { MoyenPaiementManuel } from '@/lib/abonnements/types'
import { changerStatutEntreprise } from '../actions'
import { activerAbonnementEntreprise } from '../../paiements/actions'

export default function EntrepriseActions({
  entrepriseId,
  statut,
  palierActuel,
}: {
  entrepriseId: string
  statut: string
  palierActuel?: string
}) {
  const [isPending, startTransition] = useTransition()
  const [palier, setPalier] = useState<PalierCode>(
    palierActuel && palierActuel in PALIERS ? (palierActuel as PalierCode) : 'standard'
  )
  const [dureeMois, setDureeMois] = useState<DureeMois>(1)
  const [moyen, setMoyen] = useState<MoyenPaiementManuel>('caisse')

  const montant = calculerMontantFcfa(palier, dureeMois)

  const run = (nouveauStatut: 'actif' | 'suspendu') => {
    startTransition(async () => {
      const result = await changerStatutEntreprise(entrepriseId, nouveauStatut)
      if (result.error) toast.error(result.error)
      else toast.success(nouveauStatut === 'suspendu' ? 'Entreprise suspendue' : 'Entreprise réactivée')
    })
  }

  const handleActiverAbonnement = (e: React.FormEvent) => {
    e.preventDefault()
    const labelMoyen = moyen === 'caisse' ? 'Caisse (Espèces)' : 'Virement bancaire'
    if (
      !confirm(
        `Confirmer l'activation immédiate de l'abonnement ${PALIERS[palier].nom} (${dureeMois} mois — ${montant.toLocaleString('fr-FR')} FCFA) par ${labelMoyen} ?`
      )
    ) {
      return
    }
    startTransition(async () => {
      const result = await activerAbonnementEntreprise(entrepriseId, palier, dureeMois, moyen)
      if (result.error) toast.error(result.error)
      else toast.success(`Abonnement ${PALIERS[palier].nom} (${dureeMois} mois) activé par ${labelMoyen}`)
    })
  }

  return (
    <div className="grid md:grid-cols-2 gap-6 mb-6">
      <form onSubmit={handleActiverAbonnement} className="bg-background rounded-xl p-5 border border-surface-border space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold">Activer un abonnement (Caisse / Virement)</h2>
            <p className="text-xs text-foreground-muted">Active directement le paiement et prolonge l&apos;abonnement</p>
          </div>
          <span className="text-sm font-bold text-primary">{montant.toLocaleString('fr-FR')} FCFA</span>
        </div>

        <div className="grid sm:grid-cols-3 gap-3">
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
                  {PALIERS[code].nom}
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
            <label className="block text-xs text-foreground-muted mb-1">Règlement</label>
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => setMoyen('caisse')}
                disabled={isPending}
                className={`flex-1 inline-flex items-center justify-center gap-1 rounded-md border px-2 py-2 text-xs font-medium ${
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
                className={`flex-1 inline-flex items-center justify-center gap-1 rounded-md border px-2 py-2 text-xs font-medium ${
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

        <button
          type="submit"
          disabled={isPending}
          className="inline-flex items-center gap-2 rounded-md bg-success text-white px-4 py-2 text-sm font-semibold hover:opacity-90 disabled:opacity-50"
        >
          <CheckCircle2 className="h-4 w-4" />
          {isPending ? 'Activation...' : 'Activer directement le paiement'}
        </button>
      </form>

      <div className="bg-background rounded-xl p-5 border border-surface-border">
        <h2 className="font-semibold mb-4">Actions</h2>
        <label className="block text-xs text-foreground-muted mb-1">Statut de l&apos;entreprise</label>
        {statut === 'suspendu' ? (
          <button
            disabled={isPending}
            onClick={() => run('actif')}
            className="rounded-md bg-success text-white px-3 py-2 text-sm font-medium disabled:opacity-50"
          >
            Réactiver l&apos;entreprise
          </button>
        ) : (
          <button
            disabled={isPending}
            onClick={() => run('suspendu')}
            className="rounded-md bg-danger text-white px-3 py-2 text-sm font-medium disabled:opacity-50"
          >
            Suspendre l&apos;entreprise
          </button>
        )}
      </div>
    </div>
  )
}
