import type { PalierCode, DureeMois } from './paliers'

export type ProviderId = 'chariow' | 'moneroo' | 'bictorys'

export type InitierPaiementParams = {
  abonnementId: string
  palier: PalierCode
  dureeMois: DureeMois
  montantFcfa: number
  emailClient: string
  prenomClient: string
  nomClient: string
  telephoneLocal: string
  /** ISO2 du pays du numéro (SN, CI, ML, BJ, BF, TG...). */
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
