// Règles anti double paiement d'abonnement, partagées par le paiement depuis
// l'espace client (app/(dashboard)/abonnement/actions.ts), la demande publique
// (app/tarifs/actions.ts) et le crédit (lib/abonnements/reconcile.ts).

// Au-delà, une page de paiement prestataire est considérée expirée : on en ouvre une nouvelle.
export const DUREE_REUTILISATION_MS = 30 * 60 * 1000

// Un même palier ne se renouvelle qu'à l'approche de l'échéance : payer plus tôt
// est presque toujours un double paiement involontaire (fausse les ventes et
// oblige à rembourser). Un changement de palier reste possible à tout moment.
export const FENETRE_RENOUVELLEMENT_JOURS = 15

export function estRecent(creeLe: string | null | undefined): boolean {
  return Boolean(creeLe) && Date.now() - new Date(creeLe!).getTime() < DUREE_REUTILISATION_MS
}

const dateFr = (d: Date) => d.toLocaleDateString('fr-FR', { timeZone: 'Africa/Dakar' })

/** Message de refus si le palier demandé est déjà payé pour plus de FENETRE_RENOUVELLEMENT_JOURS, sinon null. */
export function refusRenouvellementAnticipe(
  palierActuel: string | null | undefined,
  expireLe: string | null | undefined,
  palierDemande: string
): string | null {
  if (!expireLe || palierActuel !== palierDemande) return null
  const expiration = new Date(expireLe)
  const ouverture = new Date(expiration.getTime() - FENETRE_RENOUVELLEMENT_JOURS * 24 * 60 * 60 * 1000)
  if (ouverture <= new Date()) return null
  return `Votre abonnement est déjà payé jusqu'au ${dateFr(expiration)}. Le renouvellement sera possible à partir du ${dateFr(ouverture)}.`
}
