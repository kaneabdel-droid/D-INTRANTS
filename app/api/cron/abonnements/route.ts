import { NextRequest, NextResponse } from 'next/server'
import { reconcilierPaiementsEnAttente, suspendreEntreprisesExpirees } from '@/lib/abonnements/reconcile'

export const runtime = 'nodejs'

// Filet de sécurité pour les webhooks manqués (rattrape les paiements Chariow/
// Moneroo en_attente restés sans nouvelle) + suspension des entreprises dont
// l'abonnement a expiré (suspension automatique — réactivée au prochain
// paiement réussi, cf. reconcile.ts). Programmé quotidiennement, voir
// vercel.json. Protégé par CRON_SECRET : Vercel Cron ajoute automatiquement
// `Authorization: Bearer $CRON_SECRET` quand cette variable est définie.
export async function GET(req: NextRequest) {
  const secretAttendu = process.env.CRON_SECRET
  const autorisation = req.headers.get('authorization')
  if (!secretAttendu || autorisation !== `Bearer ${secretAttendu}`) {
    return NextResponse.json({ error: 'non autorisé' }, { status: 401 })
  }

  const reconciliation = await reconcilierPaiementsEnAttente()
  const suspensions = await suspendreEntreprisesExpirees()

  return NextResponse.json({ ...reconciliation, suspensions })
}
