// Source de vérité unique pour les paliers d'abonnement et leurs prix — reflète
// paliers_abonnement en base (13_abonnements.sql), qui n'est là que comme garde-fou
// lisible en SQL. Toute évolution de prix/limite doit être répercutée aux deux endroits.

export type PalierCode = 'standard' | 'medium' | 'premium'
export type DureeMois = 1 | 6 | 12

export const PALIERS: Record<PalierCode, { nom: string; magasinsMax: number; prixMensuelFcfa: number }> = {
  standard: { nom: 'Standard', magasinsMax: 1, prixMensuelFcfa: 5000 },
  medium: { nom: 'Médium', magasinsMax: 2, prixMensuelFcfa: 7500 },
  premium: { nom: 'Premium', magasinsMax: 3, prixMensuelFcfa: 10000 },
}

export const DUREES: { mois: DureeMois; label: string; reduction: number }[] = [
  { mois: 1, label: '1 mois', reduction: 0 },
  { mois: 6, label: '6 mois', reduction: 0.05 },
  { mois: 12, label: '12 mois', reduction: 0.10 },
]

export function estPalierValide(v: string): v is PalierCode {
  return v === 'standard' || v === 'medium' || v === 'premium'
}

export function estDureeValide(v: number): v is DureeMois {
  return v === 1 || v === 6 || v === 12
}

// Arrondi à l'entier le plus proche : les montants FCFA n'ont pas de décimales
// (Chariow/PayTech rejettent d'ailleurs les prix non entiers).
export function calculerMontantFcfa(palier: PalierCode, dureeMois: DureeMois): number {
  const reduction = DUREES.find((d) => d.mois === dureeMois)?.reduction ?? 0
  const brut = PALIERS[palier].prixMensuelFcfa * dureeMois
  return Math.round(brut * (1 - reduction))
}
