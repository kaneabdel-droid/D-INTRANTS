'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { traiterDemande } from './actions'

export default function RattacherDemandeForm({ abonnementId, entreprises }: { abonnementId: string; entreprises: { id: string; nom: string }[] }) {
  const router = useRouter()
  const [entrepriseId, setEntrepriseId] = useState('')
  const [isPending, startTransition] = useTransition()
  const [message, setMessage] = useState<string | null>(null)

  const rattacher = () => {
    if (!entrepriseId) {
      setMessage('Choisissez une entreprise')
      return
    }
    setMessage(null)
    startTransition(async () => {
      const result = await traiterDemande(abonnementId, entrepriseId)
      if (result.error) setMessage(result.error)
      else router.refresh()
    })
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex gap-2">
        <select
          value={entrepriseId}
          onChange={(e) => setEntrepriseId(e.target.value)}
          disabled={isPending}
          className="rounded-md border border-surface-border bg-surface px-2 py-1.5 text-xs"
        >
          <option value="">Choisir…</option>
          {entreprises.map((e) => (
            <option key={e.id} value={e.id}>{e.nom}</option>
          ))}
        </select>
        <button
          onClick={rattacher}
          disabled={isPending}
          className="rounded-md bg-primary text-white px-3 py-1.5 text-xs font-medium disabled:opacity-50"
        >
          {isPending ? '...' : 'Rattacher'}
        </button>
      </div>
      {message && <p className="text-xs text-danger">{message}</p>}
    </div>
  )
}
