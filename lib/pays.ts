// Pays proposés à l'inscription et au paiement de l'abonnement : tous les pays dont la devise est gérée par
// l'application (lib/currency.ts), plus « Autre pays ». Un client d'un autre pays règle son abonnement en
// dollars US (carte, via Moneroo) et son entreprise travaille « sans unité » : ses montants s'affichent sans devise.

import type { DeviseCode } from '@/lib/currency'

export type Pays = { code: string; nom: string; indicatif: string; devise: DeviseCode }

export const PAYS: Pays[
  // Autres pays ajoutés
  { code: 'DZ', nom: 'Algérie', indicatif: '213', devise: 'AUCUNE' },
  { code: 'AO', nom: 'Angola', indicatif: '244', devise: 'AUCUNE' },
  { code: 'BW', nom: 'Botswana', indicatif: '267', devise: 'AUCUNE' },
  { code: 'BI', nom: 'Burundi', indicatif: '257', devise: 'AUCUNE' },
  { code: 'CV', nom: 'Cap-Vert', indicatif: '238', devise: 'AUCUNE' },
  { code: 'KM', nom: 'Comores', indicatif: '269', devise: 'AUCUNE' },
  { code: 'CD', nom: 'RD Congo', indicatif: '243', devise: 'AUCUNE' },
  { code: 'DJ', nom: 'Djibouti', indicatif: '253', devise: 'AUCUNE' },
  { code: 'EG', nom: 'Égypte', indicatif: '20', devise: 'AUCUNE' },
  { code: 'ER', nom: 'Érythrée', indicatif: '291', devise: 'AUCUNE' },
  { code: 'SZ', nom: 'Eswatini', indicatif: '268', devise: 'AUCUNE' },
  { code: 'ET', nom: 'Éthiopie', indicatif: '251', devise: 'AUCUNE' },
  { code: 'KE', nom: 'Kenya', indicatif: '254', devise: 'AUCUNE' },
  { code: 'LS', nom: 'Lesotho', indicatif: '266', devise: 'AUCUNE' },
  { code: 'LR', nom: 'Liberia', indicatif: '231', devise: 'AUCUNE' },
  { code: 'LY', nom: 'Libye', indicatif: '218', devise: 'AUCUNE' },
  { code: 'MG', nom: 'Madagascar', indicatif: '261', devise: 'AUCUNE' },
  { code: 'MW', nom: 'Malawi', indicatif: '265', devise: 'AUCUNE' },
  { code: 'MU', nom: 'Maurice', indicatif: '230', devise: 'AUCUNE' },
  { code: 'MZ', nom: 'Mozambique', indicatif: '258', devise: 'AUCUNE' },
  { code: 'NA', nom: 'Namibie', indicatif: '264', devise: 'AUCUNE' },
  { code: 'RW', nom: 'Rwanda', indicatif: '250', devise: 'AUCUNE' },
  { code: 'ST', nom: 'Sao Tomé-et-Principe', indicatif: '239', devise: 'AUCUNE' },
  { code: 'SC', nom: 'Seychelles', indicatif: '248', devise: 'AUCUNE' },
  { code: 'SL', nom: 'Sierra Leone', indicatif: '232', devise: 'AUCUNE' },
  { code: 'SO', nom: 'Somalie', indicatif: '252', devise: 'AUCUNE' },
  { code: 'ZA', nom: 'Afrique du Sud', indicatif: '27', devise: 'AUCUNE' },
  { code: 'SS', nom: 'Soudan du Sud', indicatif: '211', devise: 'AUCUNE' },
  { code: 'SD', nom: 'Soudan', indicatif: '249', devise: 'AUCUNE' },
  { code: 'TZ', nom: 'Tanzanie', indicatif: '255', devise: 'AUCUNE' },
  { code: 'TN', nom: 'Tunisie', indicatif: '216', devise: 'AUCUNE' },
  { code: 'UG', nom: 'Ouganda', indicatif: '256', devise: 'AUCUNE' },
  { code: 'ZM', nom: 'Zambie', indicatif: '260', devise: 'AUCUNE' },
  { code: 'ZW', nom: 'Zimbabwe', indicatif: '263', devise: 'AUCUNE' },
  { code: 'SA', nom: 'Arabie saoudite', indicatif: '966', devise: 'AUCUNE' },
  { code: 'AE', nom: 'Émirats arabes unis', indicatif: '971', devise: 'AUCUNE' },
  { code: 'QA', nom: 'Qatar', indicatif: '974', devise: 'AUCUNE' },
  { code: 'KW', nom: 'Koweït', indicatif: '965', devise: 'AUCUNE' },
  { code: 'BH', nom: 'Bahreïn', indicatif: '973', devise: 'AUCUNE' },
  { code: 'OM', nom: 'Oman', indicatif: '968', devise: 'AUCUNE' },
  { code: 'YE', nom: 'Yémen', indicatif: '967', devise: 'AUCUNE' },
  { code: 'JO', nom: 'Jordanie', indicatif: '962', devise: 'AUCUNE' },
  { code: 'LB', nom: 'Liban', indicatif: '961', devise: 'AUCUNE' },
  { code: 'SY', nom: 'Syrie', indicatif: '963', devise: 'AUCUNE' },
  { code: 'IQ', nom: 'Irak', indicatif: '964', devise: 'AUCUNE' },
  { code: 'IN', nom: 'Inde', indicatif: '91', devise: 'AUCUNE' },
  { code: 'PK', nom: 'Pakistan', indicatif: '92', devise: 'AUCUNE' },
  { code: 'BD', nom: 'Bangladesh', indicatif: '880', devise: 'AUCUNE' },
  { code: 'LK', nom: 'Sri Lanka', indicatif: '94', devise: 'AUCUNE' },
  { code: 'NP', nom: 'Népal', indicatif: '977', devise: 'AUCUNE' },
  { code: 'BT', nom: 'Bhoutan', indicatif: '975', devise: 'AUCUNE' },
  { code: 'MV', nom: 'Maldives', indicatif: '960', devise: 'AUCUNE' },
  { code: 'AF', nom: 'Afghanistan', indicatif: '93', devise: 'AUCUNE' },

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
