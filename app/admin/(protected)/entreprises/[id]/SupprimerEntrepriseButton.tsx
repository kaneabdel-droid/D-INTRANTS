'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle } from 'lucide-react'
import { supprimerEntreprise } from '../actions'

export default function SupprimerEntrepriseButton({ entrepriseId, nomEntreprise }: { entrepriseId: string; nomEntreprise: string }) {
  const router = useRouter()
  const [confirmation, setConfirmation] = useState('')
  const [isPending, startTransition] = useTransition()
  const [message, setMessage] = useState<string | null>(null)

  const peutSupprimer = confirmation.trim() === nomEntreprise

  const handleSupprimer = () => {
    if (!peutSupprimer) return
    if (!confirm(`Dernière confirmation : supprimer définitivement "${nomEntreprise}" (magasins, comptes, ventes, tout) ? Cette action est irréversible.`)) return

    setMessage(null)
    startTransition(async () => {
      try {
        const result = await supprimerEntreprise(entrepriseId)
        if (result.error) {
          setMessage(`Erreur : ${result.error}`)
        } else {
          router.push('/admin/entreprises')
        }
      } catch (err) {
        setMessage(`Erreur inattendue : ${err instanceof Error ? err.message : String(err)}`)
      }
    })
  }

  return (
    <div className="bg-danger/5 border border-danger/20 rounded-xl p-5 mt-8">
      <h2 className="font-semibold mb-2 flex items-center gap-2 text-danger">
        <AlertTriangle className="w-4 h-4" /> Zone dangereuse
      </h2>
      <p className="text-sm text-foreground-muted mb-4">
        Supprime définitivement cette entreprise, ses magasins, ses comptes utilisateurs
        et toutes ses données (stock, ventes, achats, trésorerie). Aucune annulation possible.
      </p>

      {message && <p className="text-sm text-danger mb-3">{message}</p>}

      <div className="flex flex-wrap items-center gap-2">
        <label className="text-xs text-foreground-muted">
          Tape <span className="font-mono font-semibold">{nomEntreprise}</span> pour confirmer :
        </label>
        <input
          value={confirmation}
          onChange={(e) => setConfirmation(e.target.value)}
          disabled={isPending}
          className="rounded-md border border-surface-border bg-surface px-3 py-1.5 text-sm"
        />
        <button
          disabled={!peutSupprimer || isPending}
          onClick={handleSupprimer}
          className="rounded-md bg-danger text-white px-3 py-1.5 text-sm font-medium disabled:opacity-50"
        >
          {isPending ? 'Suppression...' : 'Supprimer définitivement'}
        </button>
      </div>
    </div>
  )
}
