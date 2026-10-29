'use client'

import { useState, useTransition } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'
import { confirmerPaiementAbonnement } from './actions'
import type { MoyenPaiementManuel } from '@/lib/abonnements/types'

export default function ConfirmerPaiementButton({
  abonnementId,
  moyenParDefaut,
}: {
  abonnementId: string
  moyenParDefaut?: string
}) {
  const initial: MoyenPaiementManuel = moyenParDefaut === 'virement' ? 'virement' : 'caisse'
  const [moyen, setMoyen] = useState<MoyenPaiementManuel>(initial)
  const [isPending, startTransition] = useTransition()

  const handleConfirmer = () => {
    const label = moyen === 'virement' ? 'Virement bancaire' : 'Caisse (Espèces)'
    if (!confirm(`Activer directement cet abonnement comme payé par ${label} ?`)) return

    startTransition(async () => {
      try {
        const result = await confirmerPaiementAbonnement(abonnementId, moyen)
        if (result.error) {
          toast.error(result.error)
        } else {
          toast.success(`Paiement activé (${label})`)
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : String(err))
      }
    })
  }

  return (
    <div className="inline-flex items-center gap-1.5">
      <select
        value={moyen}
        onChange={(e) => setMoyen(e.target.value as MoyenPaiementManuel)}
        disabled={isPending}
        aria-label="Moyen de paiement"
        className="rounded-md border border-surface-border bg-background px-2 py-1 text-xs text-foreground"
      >
        <option value="caisse">Caisse</option>
        <option value="virement">Virement</option>
      </select>
      <button
        type="button"
        onClick={handleConfirmer}
        disabled={isPending}
        className="inline-flex items-center gap-1 rounded-md bg-success px-2.5 py-1 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
      >
        <CheckCircle2 className="h-3.5 w-3.5" />
        {isPending ? 'Activation...' : 'Activer'}
      </button>
    </div>
  )
}

