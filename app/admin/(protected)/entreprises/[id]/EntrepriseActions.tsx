'use client'

import { useTransition } from 'react'
import { toast } from 'sonner'
import { changerStatutEntreprise } from '../actions'

export default function EntrepriseActions({ entrepriseId, statut }: { entrepriseId: string; statut: string }) {
  const [isPending, startTransition] = useTransition()

  const run = (nouveauStatut: 'actif' | 'suspendu') => {
    startTransition(async () => {
      const result = await changerStatutEntreprise(entrepriseId, nouveauStatut)
      if (result.error) toast.error(result.error)
      else toast.success(nouveauStatut === 'suspendu' ? 'Entreprise suspendue' : 'Entreprise réactivée')
    })
  }

  return (
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
  )
}
