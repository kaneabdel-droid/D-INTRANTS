'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Loader2, CheckCircle2, XCircle, Clock } from 'lucide-react'
import { verifierDemandePublique } from '../actions'

const INTERVALLE_MS = 3000
const MAX_TENTATIVES = 15 // ~45s, garde-fou dur (cf. Chariow.md §8)

export default function RetourClient({ abonnementId }: { abonnementId: string | null }) {
  const [etat, setEtat] = useState<'verification' | 'paye' | 'echoue' | 'lent'>(abonnementId ? 'verification' : 'echoue')
  const tentatives = useRef(0)

  useEffect(() => {
    if (!abonnementId) return

    let annule = false

    async function verifier() {
      const resultat = await verifierDemandePublique(abonnementId!)
      if (annule) return

      if (resultat.statut === 'paye') {
        setEtat('paye')
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
  }, [abonnementId])

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
            <p className="font-semibold">Paiement confirmé — merci !</p>
            <p className="text-sm text-foreground-muted">
              Votre compte entreprise est en cours de création. Vos accès vous seront envoyés par e-mail sous 24h ouvrées.
            </p>
            <Link href="/" className="text-primary hover:text-primary-hover text-sm">Retour à l&apos;accueil</Link>
          </>
        )}
        {etat === 'echoue' && (
          <>
            <XCircle className="h-10 w-10 text-danger mx-auto" />
            <p className="font-semibold">Le paiement n&apos;a pas abouti.</p>
            <Link href="/tarifs" className="text-primary hover:text-primary-hover text-sm">Réessayer</Link>
          </>
        )}
        {etat === 'lent' && (
          <>
            <Clock className="h-10 w-10 text-warning mx-auto" />
            <p className="font-semibold">Le paiement est en cours de traitement.</p>
            <p className="text-sm text-foreground-muted">Cela peut prendre quelques minutes. Vous recevrez la confirmation par e-mail.</p>
            <Link href="/" className="text-primary hover:text-primary-hover text-sm">Retour à l&apos;accueil</Link>
          </>
        )}
      </div>
    </div>
  )
}
