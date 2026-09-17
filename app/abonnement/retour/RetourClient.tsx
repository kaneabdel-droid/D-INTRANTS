'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Loader2, CheckCircle2, XCircle, Clock } from 'lucide-react'
import { verifierPaiementAbonnement } from '@/app/(dashboard)/abonnement/actions'

const INTERVALLE_MS = 3000
const MAX_TENTATIVES = 15 // ~45s, garde-fou dur (cf. Chariow.md §8)

export default function RetourClient({ abonnementId }: { abonnementId: string | null }) {
  const router = useRouter()
  const [etat, setEtat] = useState<'verification' | 'paye' | 'echoue' | 'lent'>(abonnementId ? 'verification' : 'echoue')
  const tentatives = useRef(0)

  useEffect(() => {
    if (!abonnementId) return

    let annule = false

    async function verifier() {
      const resultat = await verifierPaiementAbonnement(abonnementId!)
      if (annule) return

      if (resultat.statut === 'paye') {
        setEtat('paye')
        setTimeout(() => router.push('/dashboard'), 1500)
        return
      }
      if (resultat.statut === 'echoue') {
        setEtat('echoue')
        return
      }

      tentatives.current += 1
      if (tentatives.current >= MAX_TENTATIVES) {
        setEtat('lent')
        return
      }
      setTimeout(verifier, INTERVALLE_MS)
    }

    verifier()
    return () => {
      annule = true
    }
  }, [abonnementId, router])

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center space-y-4">
        {etat === 'verification' && (
          <>
            <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto" />
            <p className="text-foreground-muted">Vérification du paiement...</p>
          </>
        )}
        {etat === 'paye' && (
          <>
            <CheckCircle2 className="h-10 w-10 text-success mx-auto" />
            <p className="font-semibold">Paiement confirmé — abonnement activé.</p>
          </>
        )}
        {etat === 'echoue' && (
          <>
            <XCircle className="h-10 w-10 text-danger mx-auto" />
            <p className="font-semibold">Le paiement n&apos;a pas abouti.</p>
            <Link href="/abonnement" className="text-primary hover:text-primary-hover text-sm">Réessayer</Link>
          </>
        )}
        {etat === 'lent' && (
          <>
            <Clock className="h-10 w-10 text-warning mx-auto" />
            <p className="font-semibold">Le paiement est en cours de traitement.</p>
            <p className="text-sm text-foreground-muted">Cela peut prendre quelques minutes (le paiement sera confirmé automatiquement). Vous pouvez revenir plus tard.</p>
            <Link href="/dashboard" className="text-primary hover:text-primary-hover text-sm">Retour au tableau de bord</Link>
          </>
        )}
      </div>
    </div>
  )
}
