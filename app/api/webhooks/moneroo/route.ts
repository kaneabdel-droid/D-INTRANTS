import { NextRequest, NextResponse } from 'next/server'
import { verifierSignatureMoneroo, parserEvenementMoneroo } from '@/lib/abonnements/providers/moneroo'
import { reconcilierParReferenceProvider } from '@/lib/abonnements/reconcile'

export const runtime = 'nodejs'

// Pas encore actif tant que MONEROO_WEBHOOK_SECRET n'est pas configuré (voir
// lib/abonnements/registry.ts pour l'activation du provider). Corps brut requis
// pour l'HMAC : express.json() jetterait les octets, ici on lit .text() nous-mêmes.
export async function POST(req: NextRequest) {
  const rawBody = Buffer.from(await req.text(), 'utf-8')
  const signature = req.headers.get('x-moneroo-signature')

  if (!verifierSignatureMoneroo(rawBody, signature)) {
    return NextResponse.json({ error: 'signature invalide' }, { status: 401 })
  }

  let body: unknown
  try {
    body = JSON.parse(rawBody.toString('utf-8'))
  } catch {
    return NextResponse.json({ received: true, ignored: true })
  }

  const evenement = parserEvenementMoneroo(body)
  if (!evenement) return NextResponse.json({ received: true, ignored: true })

  // Re-pull recommandé même après signature vérifiée (défense en profondeur).
  await reconcilierParReferenceProvider('moneroo', evenement.providerReference)
  return NextResponse.json({ received: true })
}
