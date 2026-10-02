// Pays proposés à l'inscription et au paiement de l'abonnement : tous les pays dont la devise est gérée par
// l'application (lib/currency.ts), plus « Autre pays ». Un client d'un autre pays règle son abonnement en
// dollars US (carte, via Moneroo) et son entreprise travaille « sans unité » : ses montants s'affichent sans devise.

import type { DeviseCode } from '@/lib/currency'

export type Pays = { code: string; nom: string; indicatif: string; devise: DeviseCode }

export const PAYS: Pays[] = [
  // Franc CFA BCEAO (UEMOA)
  { code: 'SN', nom: 'Sénégal', indicatif: '221', devise: 'XOF' },
  { code: 'CI', nom: "Côte d'Ivoire", indicatif: '225', devise: 'XOF' },
  { code: 'ML', nom: 'Mali', indicatif: '223', devise: 'XOF' },
  { code: 'BF', nom: 'Burkina Faso', indicatif: '226', devise: 'XOF' },
  { code: 'BJ', nom: 'Bénin', indicatif: '229', devise: 'XOF' },
  { code: 'TG', nom: 'Togo', indicatif: '228', devise: 'XOF' },
  { code: 'NE', nom: 'Niger', indicatif: '227', devise: 'XOF' },
  { code: 'GW', nom: 'Guinée-Bissau', indicatif: '245', devise: 'XOF' },
  // Franc CFA BEAC (CEMAC)
  { code: 'CM', nom: 'Cameroun', indicatif: '237', devise: 'XAF' },
  { code: 'GA', nom: 'Gabon', indicatif: '241', devise: 'XAF' },
  { code: 'CG', nom: 'Congo', indicatif: '242', devise: 'XAF' },
  { code: 'TD', nom: 'Tchad', indicatif: '235', devise: 'XAF' },
  { code: 'CF', nom: 'Centrafrique', indicatif: '236', devise: 'XAF' },
  { code: 'GQ', nom: 'Guinée équatoriale', indicatif: '240', devise: 'XAF' },
  // Autres devises africaines gérées
  { code: 'GN', nom: 'Guinée', indicatif: '224', devise: 'GNF' },
  { code: 'MR', nom: 'Mauritanie', indicatif: '222', devise: 'MRU' },
  { code: 'MA', nom: 'Maroc', indicatif: '212', devise: 'MAD' },
  // Zone euro
  { code: 'FR', nom: 'France', indicatif: '33', devise: 'EUR' },
  { code: 'BE', nom: 'Belgique', indicatif: '32', devise: 'EUR' },
  { code: 'LU', nom: 'Luxembourg', indicatif: '352', devise: 'EUR' },
  { code: 'DE', nom: 'Allemagne', indicatif: '49', devise: 'EUR' },
  { code: 'AT', nom: 'Autriche', indicatif: '43', devise: 'EUR' },
  { code: 'NL', nom: 'Pays-Bas', indicatif: '31', devise: 'EUR' },
  { code: 'ES', nom: 'Espagne', indicatif: '34', devise: 'EUR' },
  { code: 'PT', nom: 'Portugal', indicatif: '351', devise: 'EUR' },
  { code: 'IT', nom: 'Italie', indicatif: '39', devise: 'EUR' },
  { code: 'IE', nom: 'Irlande', indicatif: '353', devise: 'EUR' },
  { code: 'FI', nom: 'Finlande', indicatif: '358', devise: 'EUR' },
  { code: 'GR', nom: 'Grèce', indicatif: '30', devise: 'EUR' },
  { code: 'CY', nom: 'Chypre', indicatif: '357', devise: 'EUR' },
  { code: 'MT', nom: 'Malte', indicatif: '356', devise: 'EUR' },
  { code: 'SK', nom: 'Slovaquie', indicatif: '421', devise: 'EUR' },
  { code: 'SI', nom: 'Slovénie', indicatif: '386', devise: 'EUR' },
  { code: 'HR', nom: 'Croatie', indicatif: '385', devise: 'EUR' },
  { code: 'EE', nom: 'Estonie', indicatif: '372', devise: 'EUR' },
  { code: 'LV', nom: 'Lettonie', indicatif: '371', devise: 'EUR' },
  { code: 'LT', nom: 'Lituanie', indicatif: '370', devise: 'EUR' },
  // Dollar US
  { code: 'US', nom: 'États-Unis', indicatif: '1', devise: 'USD' },
  { code: 'EC', nom: 'Équateur', indicatif: '593', devise: 'USD' },
  { code: 'SV', nom: 'Salvador', indicatif: '503', devise: 'USD' },
  { code: 'PA', nom: 'Panama', indicatif: '507', devise: 'USD' },
  { code: 'TL', nom: 'Timor oriental', indicatif: '670', devise: 'USD' },
]

/** Code du choix « Autre pays » : pas d'indicatif connu, paiement en dollars US. */
export const AUTRE_PAYS = 'AUTRE'

export function trouverPays(code: string | null | undefined): Pays | undefined {
  return PAYS.find((p) => p.code === code)
}

/** Un client d'un pays non listé paie son abonnement en dollars US. */
export function paieEnDollars(codePays: string | null | undefined): boolean {
  return codePays === AUTRE_PAYS
}

/** Nom affichable d'un pays (le nom saisi pour « Autre pays »). */
export function nomPays(code: string, nomAutre?: string | null): string {
  if (code === AUTRE_PAYS) return nomAutre?.trim() || 'Autre pays'
  return trouverPays(code)?.nom ?? code
}
