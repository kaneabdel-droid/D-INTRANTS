'use client'

import React, { useState, useTransition } from 'react'
import { Sparkles, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react'
import { synchroniserOperationsComptables } from './actions'

export default function BoutonSyncOperations() {
  const [isPending, startTransition] = useTransition()
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const handleSync = () => {
    setMessage(null)
    startTransition(async () => {
      try {
        const res = await synchroniserOperationsComptables()
        if (res.success) {
          setMessage({
            type: 'success',
            text: res.count > 0
              ? `${res.count} écriture(s) générée(s) automatiquement depuis vos opérations.`
              : 'Toutes les opérations (ventes, achats, charges) sont déjà à jour en comptabilité.',
          })
          setTimeout(() => setMessage(null), 5000)
        } else {
          setMessage({ type: 'error', text: 'Erreur lors de la synchronisation comptable.' })
        }
      } catch {
        setMessage({ type: 'error', text: 'Impossible de synchroniser les opérations.' })
      }
    })
  }

  return (
    <div className="relative inline-flex items-center">
      <button
        onClick={handleSync}
        disabled={isPending}
        className="inline-flex items-center gap-2 rounded-xl border border-surface-border bg-surface px-3.5 py-2.5 text-sm font-semibold text-foreground hover:bg-black/5 disabled:opacity-50 transition-colors shadow-sm"
        title="Générer automatiquement les écritures pour les ventes, achats et dépenses non comptabilisés"
      >
        <RefreshCw className={`w-4 h-4 text-primary ${isPending ? 'animate-spin' : ''}`} />
        <span>{isPending ? 'Synchronisation...' : 'Synchroniser les Opérations'}</span>
      </button>

      {message && (
        <div
          className={`absolute top-full mt-2 right-0 z-50 whitespace-nowrap px-3 py-1.5 rounded-lg text-xs font-semibold shadow-lg flex items-center gap-1.5 ${
            message.type === 'success'
              ? 'bg-emerald-600 text-white'
              : 'bg-red-600 text-white'
          }`}
        >
          {message.type === 'success' ? (
            <CheckCircle2 className="w-3.5 h-3.5" />
          ) : (
            <AlertCircle className="w-3.5 h-3.5" />
          )}
          <span>{message.text}</span>
        </div>
      )}
    </div>
  )
}
