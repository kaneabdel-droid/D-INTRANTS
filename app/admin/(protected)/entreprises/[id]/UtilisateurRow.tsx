'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { desactiverCompteUtilisateur, modifierProfilUtilisateur, reactiverCompteUtilisateur, retirerUtilisateur } from '../actions'

type Role = 'admin_entreprise' | 'gerant' | 'tresorier'

export default function UtilisateurRow({
  entrepriseId,
  utilisateurId,
  email,
  nomComplet,
  role,
  magasinId,
  magasinNom,
  magasins,
  banni,
}: {
  entrepriseId: string
  utilisateurId: string
  email: string
  nomComplet: string
  role: string
  magasinId: string | null
  magasinNom: string | null
  magasins: { id: string; nom: string }[]
  banni: boolean
}) {
  const [isPending, startTransition] = useTransition()
  const [edition, setEdition] = useState(false)
  const [nouveauRole, setNouveauRole] = useState<Role>(role as Role)
  const [nouveauMagasin, setNouveauMagasin] = useState(magasinId ?? magasins[0]?.id ?? '')
  const avecMagasin = nouveauRole === 'gerant' || nouveauRole === 'tresorier'

  const enregistrerProfil = () => {
    startTransition(async () => {
      const result = await modifierProfilUtilisateur(entrepriseId, utilisateurId, nouveauRole, avecMagasin ? nouveauMagasin : null)
      if (result.error) toast.error(result.error)
      else {
        toast.success('Profil modifié')
        setEdition(false)
      }
    })
  }

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
          onClick={() => setEdition((v) => !v)}
          className="rounded-md bg-primary text-white px-2 py-1 text-xs font-medium disabled:opacity-50"
        >
          Modifier le profil
        </button>

        <button
          disabled={isPending}
          onClick={handleRetirer}
          className="rounded-md bg-danger text-white px-2 py-1 text-xs font-medium disabled:opacity-50"
        >
          Retirer
        </button>
      </div>

      {edition && (
        <div className="flex flex-wrap items-end gap-2 rounded-md border border-surface-border bg-surface p-3">
          <label className="text-xs font-medium text-foreground">
            Profil
            <select
              value={nouveauRole}
              onChange={(e) => setNouveauRole(e.target.value as Role)}
              disabled={isPending}
              className="mt-1 block rounded-md bg-background border border-surface-border text-foreground px-2 py-1.5 text-sm"
            >
              <option value="gerant">Gérant</option>
              <option value="tresorier">Trésorier</option>
              <option value="admin_entreprise">Admin entreprise</option>
            </select>
          </label>
          {avecMagasin && (
            <label className="text-xs font-medium text-foreground">
              Magasin
              <select
                value={nouveauMagasin}
                onChange={(e) => setNouveauMagasin(e.target.value)}
                disabled={isPending}
                className="mt-1 block rounded-md bg-background border border-surface-border text-foreground px-2 py-1.5 text-sm"
              >
                {magasins.map((m) => (
                  <option key={m.id} value={m.id}>{m.nom}</option>
                ))}
              </select>
            </label>
          )}
          <button
            disabled={isPending || (avecMagasin && !nouveauMagasin)}
            onClick={enregistrerProfil}
            className="rounded-md bg-success text-white px-3 py-1.5 text-xs font-medium disabled:opacity-50"
          >
            Enregistrer
          </button>
        </div>
      )}
    </li>
  )
}
