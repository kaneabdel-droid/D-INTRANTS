'use client'

import { useTransition } from 'react'
import { toast } from 'sonner'
import { archiverMagasin } from '../actions'

export default function MagasinRow({
  entrepriseId,
  magasinId,
  nom,
  adresse,
  statut,
}: {
  entrepriseId: string
  magasinId: string
  nom: string
  adresse: string | null
  statut: string
}) {
  const [isPending, startTransition] = useTransition()

  const handleArchiver = () => {
    if (!confirm(`Archiver le magasin "${nom}" ? Il restera consultable mais ne sera plus utilisable pour de nouvelles opérations.`)) return
    startTransition(async () => {
      const result = await archiverMagasin(entrepriseId, magasinId)
      if (result.error) toast.error(result.error)
      else toast.success(`"${nom}" archivé`)
    })
  }

  return (
    <li className="py-3 flex items-center justify-between gap-2">
      <div className="min-w-0">
        <p className="truncate font-medium">{nom}</p>
        {adresse && <p className="truncate text-xs text-foreground-muted">{adresse}</p>}
      </div>
      {statut === 'archive' ? (
        <span className="text-xs text-foreground-muted font-medium shrink-0">Archivé</span>
      ) : (
        <button
          disabled={isPending}
          onClick={handleArchiver}
          className="shrink-0 rounded-md bg-surface-border px-2 py-1 text-xs font-medium text-foreground hover:bg-surface-border/70 disabled:opacity-50"
        >
          Archiver
        </button>
      )}
    </li>
  )
}
