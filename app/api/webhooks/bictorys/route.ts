import { NextRequest, NextResponse } from 'next/server'
import { verifierSignatureBictorys, parserEvenementBictorys } from '@/lib/abonnements/providers/bictorys'
import { appliquerEvenementBictorysVerifie } from '@/lib/abonnements/reconcile'

export const runtime = 'nodejs'

// Pas encore actif tant que BICTORYS_WEBHOOK_SECRET n'est pas configuré. À la
// différence de Chariow/Moneroo, aucun re-pull n'est possible côté serveur
// (WAF Bictorys) : une fois la signature vérifiée, le corps du webhook fait foi.
export async function POST(req: NextRequest) {
  const rawBody = Buffer.from(await req.text(), 'utf-8')
  const signature = req.headers.get('x-webhook-signature')
  const timestamp = req.headers.get('x-webhook-timestamp')
  const cleSecrete = req.headers.get('x-secret-key')

  if (!verifierSignatureBictorys(rawBody, signature, timestamp, cleSecrete)) {
    return NextResponse.json({ error: 'signature invalide' }, { status: 401 })
  }

  let body: unknown
  try {
    body = JSON.parse(rawBody.toString('utf-8'))
  } catch {
    return NextResponse.json({ received: true, ignored: true })
  }

  const evenement = parserEvenementBictorys(body)
  if (!evenement) return NextResponse.json({ received: true, ignored: true })

  await appliquerEvenementBictorysVerifie(evenement.providerReference, evenement.statut, evenement.montant, evenement.providerReferenceAttendue)
  return NextResponse.json({ received: true })
}
