'use client'

import { useState } from 'react'
import { Ban, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import type { Dictionary } from '@/dictionaries'
import { annulerVente } from './actions'

export default function AnnulerVenteButton({ venteId, dict }: { venteId: string; dict: Dictionary }) {
  const t = dict.ventes
  const c = dict.common
  const [loading, setLoading] = useState(false)

  async function handleClick() {
    if (!confirm(t.confirmCancel)) return
    setLoading(true)
    const res = await annulerVente(venteId)
    setLoading(false)
    if (res?.error) toast.error(res.error)
    else toast.success(t.cancelled)
  }

  return (
    <button onClick={handleClick} disabled={loading} className="text-foreground-muted hover:text-danger p-1 disabled:opacity-50" title={t.cancelButton}>
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ban className="h-4 w-4" />}
    </button>
  )
}
