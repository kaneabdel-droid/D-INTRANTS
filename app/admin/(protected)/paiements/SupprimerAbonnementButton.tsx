'use client'

import { useState, useTransition } from 'react'
import { Trash2 } from 'lucide-react'
import { supprimerAbonnement } from './actions'

export default function SupprimerAbonnementButton({
  abonnementId,
  confirmation,
}: {
  abonnementId: string
  confirmation: string
}) {
  const [isPending, startTransition] = useTransition()
  const [erreur, setErreur] = useState<string | null>(null)

  const handleSupprimer = () => {
    if (!confirm(confirmation)) return
    setErreur(null)
    startTransition(async () => {
      try {
        const result = await supprimerAbonnement(abonnementId)
        if (result.error) setErreur(result.error)
      } catch (err) {
        setErreur(err instanceof Error ? err.message : String(err))
      }
    })
  }

  return (
    <div>
      <button
        onClick={handleSupprimer}
        disabled={isPending}
        title="Supprimer"
        className="text-foreground-muted hover:text-danger p-1 disabled:opacity-50"
      >
        <Trash2 className="h-4 w-4" />
      </button>
      {erreur && <p className="text-xs text-danger">{erreur}</p>}
    </div>
  )
}
