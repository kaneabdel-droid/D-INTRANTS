import type { PalierCode, DureeMois } from './paliers'

export type ProviderId = 'chariow' | 'moneroo' | 'bictorys' | 'maketou'
export type MoyenPaiementManuel = 'caisse' | 'virement'
export type MoyenPaiementAbonnement = ProviderId | MoyenPaiementManuel

export function estMoyenPaiementManuel(v: string): v is MoyenPaiementManuel {
  return v === 'caisse' || v === 'virement'
}

export function libelleMoyenPaiement(provider: string, metadata?: Record<string, any> | null): string {
  const effectif = (metadata?.moyenPaiementReel as string | undefined) || provider
  if (effectif === 'caisse') return 'Caisse (Espèces)'
  if (effectif === 'virement') return 'Virement bancaire'
  if (effectif === 'maketou') return 'Maketou'
  if (effectif === 'chariow') return 'Chariow'
  if (effectif === 'moneroo') return 'Carte bancaire (Moneroo)'
  if (effectif === 'bictorys') return 'Bictorys'
  if (effectif === 'manuel') return 'Manuel'
  return effectif
}

export type InitierPaiementParams = {
  abonnementId: string
  palier: PalierCode
  dureeMois: DureeMois
  montantFcfa: number
  /** Renseigné pour un client d'un autre pays : paiement en dollars US de ce montant (Moneroo uniquement). */
  montantUsd?: number
  emailClient: string
  prenomClient: string
  nomClient: string
  telephoneLocal: string
  /** ISO2 du pays du numéro (cf. lib/pays.ts), ou AUTRE pour un numéro saisi au format international. */
  telephonePays: string
  retourUrl: string
  nomEntreprise: string
}

export type InitierPaiementResultat =
  | {
      ok: true
      checkoutUrl: string
      referenceProvider: string
      /** Montant réellement facturé par le provider si différent (contrôle anti-fraude côté réconciliation). */
      montantFacture?: number
      deviseFacturee?: string
    }
  | { ok: false; error: string }

export type StatutProvider = 'pending' | 'succeeded' | 'failed' | 'abandoned'

export type StatutPaiementDistant = {
  statut: StatutProvider
  montant?: number
  devise?: string
  payeLe?: Date
}

export interface AdaptateurPaiement {
  readonly id: ProviderId
  initierPaiement(params: InitierPaiementParams): Promise<InitierPaiementResultat>
  /**
   * Re-pull l'état du paiement depuis l'API du provider. Retourne `null` quand
   * le provider ne permet pas de re-vérifier de façon fiable depuis le serveur
   * (cas Bictorys, bloqué par son WAF) — dans ce cas la réconciliation ne peut
   * se faire que via un webhook déjà vérifié, jamais par re-pull.
   */
  recupererStatut(referenceProvider: string): Promise<StatutPaiementDistant | null>
}
