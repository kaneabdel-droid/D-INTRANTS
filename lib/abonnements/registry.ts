// Point unique de bascule entre providers de paiement : au lancement, seul
// Chariow a des clés API valides. Une fois Moneroo ou Bictorys activé côté
// dashboard, basculer PAYMENT_PROVIDER_ACTIF dans l'environnement suffit — le
// reste du code (checkout, webhooks, cron) est écrit contre l'interface
// AdaptateurPaiement et ne connaît pas le provider actif à l'avance.

import type { AdaptateurPaiement, ProviderId } from './types'
import { chariowAdapter } from './providers/chariow'
import { monerooAdapter } from './providers/moneroo'
import { bictorysAdapter } from './providers/bictorys'
import { maketouAdapter } from './providers/maketou'

const ADAPTATEURS: Record<ProviderId, AdaptateurPaiement> = {
  chariow: chariowAdapter,
  moneroo: monerooAdapter,
  bictorys: bictorysAdapter,
  maketou: maketouAdapter,
}

export function providerActif(): ProviderId {
  const v = process.env.PAYMENT_PROVIDER_ACTIF
  if (v === 'moneroo' || v === 'bictorys' || v === 'chariow' || v === 'maketou') return v
  return 'chariow'
}

export function adaptateurActif(): AdaptateurPaiement {
  return ADAPTATEURS[providerActif()]
}

export function adaptateurPour(provider: ProviderId): AdaptateurPaiement {
  return ADAPTATEURS[provider]
}
