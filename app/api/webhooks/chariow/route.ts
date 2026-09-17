import { NextRequest, NextResponse } from 'next/server'
import crypto from 'node:crypto'
import { reconcilierParReferenceProvider, reconcilierParAbonnementId } from '@/lib/abonnements/reconcile'

export const runtime = 'nodejs'

function comparaisonConstante(a: string, b: string): boolean {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  return bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB)
}

// Chariow n'a pas de signature de corps : secret dans l'URL (?secret=...),
// comparé en temps constant — cf. Chariow.md §7. Zéro confiance dans le corps
// pour le STATUT : il sert seulement à identifier quelle vente re-vérifier
// auprès de l'API Chariow (reconcilierParReferenceProvider re-pull toujours).
export async function POST(req: NextRequest) {
  const secretAttendu = process.env.CHARIOW_WEBHOOK_SECRET
  const secretRecu = req.nextUrl.searchParams.get('secret')
  if (!secretAttendu || !secretRecu || !comparaisonConstante(secretRecu, secretAttendu)) {
    return NextResponse.json({ error: 'secret invalide' }, { status: 401 })
  }

  let body: {
    data?: { purchase?: { id?: string; custom_metadata?: { abonnementId?: string } } }
    purchase?: { id?: string }
    sale_id?: string
    custom_metadata?: { abonnementId?: string }
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ received: true, ignored: true })
  }

  const saleId = body.data?.purchase?.id || body.purchase?.id || body.sale_id
  const abonnementId = body.custom_metadata?.abonnementId || body.data?.purchase?.custom_metadata?.abonnementId

  if (saleId) {
    await reconcilierParReferenceProvider('chariow', saleId)
  } else if (abonnementId) {
    await reconcilierParAbonnementId(abonnementId)
  } else {
    return NextResponse.json({ received: true, ignored: true })
  }

  return NextResponse.json({ received: true })
}
