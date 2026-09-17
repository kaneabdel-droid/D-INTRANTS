'use client'

import { useTransition } from 'react'
import { toast } from 'sonner'
import { desactiverCompteUtilisateur, reactiverCompteUtilisateur, retirerUtilisateur } from '../actions'

export default function UtilisateurRow({
  entrepriseId,
  utilisateurId,
  email,
  nomComplet,
  role,
  magasinNom,
  banni,
}: {
  entrepriseId: string
  utilisateurId: string
  email: string
  nomComplet: string
  role: string
  magasinNom: string | null
  banni: boolean
}) {
  const [isPending, startTransition] = useTransition()

  const run = (action: () => Promise<{ success?: boolean; error?: string }>, messageSucces: string) => {
    startTransition(async () => {
      const result = await action()
      if (result.error) toast.error(result.error)
      else toast.success(messageSucces)
    })
  }

  const handleRetirer = () => {
    if (!confirm(`Retirer ${email} de cette entreprise et désactiver son compte ?`)) return
    run(() => retirerUtilisateur(entrepriseId, utilisateurId), 'Utilisateur retiré')
  }

  return (
    <li className="py-3 space-y-2">
      <div className="flex justify-between items-center gap-2">
        <div className="min-w-0">
          <p className="truncate font-medium">{nomComplet || email}</p>
          <p className="truncate text-xs text-foreground-muted">
            {email} · <span className="capitalize">{role.replace('_', ' ')}</span>
            {magasinNom ? ` · ${magasinNom}` : ''}
          </p>
        </div>
        {banni && <span className="text-xs text-danger font-medium shrink-0">Désactivé</span>}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {banni ? (
          <button
            disabled={isPending}
            onClick={() => run(() => reactiverCompteUtilisateur(entrepriseId, utilisateurId), 'Compte réactivé')}
            className="rounded-md bg-success text-white px-2 py-1 text-xs font-medium disabled:opacity-50"
          >
            Réactiver
          </button>
        ) : (
          <button
            disabled={isPending}
            onClick={() => run(() => desactiverCompteUtilisateur(entrepriseId, utilisateurId), 'Compte désactivé')}
            className="rounded-md bg-warning text-white px-2 py-1 text-xs font-medium disabled:opacity-50"
          >
            Désactiver
          </button>
        )}

        <button
          disabled={isPending}
          onClick={handleRetirer}
          className="rounded-md bg-danger text-white px-2 py-1 text-xs font-medium disabled:opacity-50"
        >
          Retirer
        </button>
      </div>
    </li>
  )
}
