// Normalisation de téléphone minimale pour les checkouts mobile money.
//
// Contrairement au modèle BYOK complet documenté dans la skill izisaas
// (voir __MACOSX/../"izisaas mobile money skills"/references/*.md), qui utilise
// libphonenumber pour couvrir le monde entier, on se contente des indicatifs des
// pays listés dans lib/pays.ts (pas de dépendance supplémentaire). Pour « Autre
// pays », le client saisit son numéro au format international (+…).
import { AUTRE_PAYS, PAYS } from '@/lib/pays'

const INDICATIFS: Record<string, string> = Object.fromEntries(PAYS.map((p) => [p.code, p.indicatif]))

export const PAYS_TELEPHONE_SUPPORTES = [...PAYS.map((p) => p.code), AUTRE_PAYS]

// Chariow exige { number: national SANS le 0 ni l'indicatif, country_code: ISO2 }
// (cf. Chariow.md §3bis) — un E.164 brut ou un 0 initial fait échouer le
// checkout avec "400 Invalid phone number".
export function versNumeroNational(local: string, paysIso2: string): string {
  let digits = local.replace(/\D/g, '')
  const indicatif = INDICATIFS[paysIso2]
  if (indicatif && digits.startsWith(indicatif)) {
    digits = digits.slice(indicatif.length)
  }
  if (digits.startsWith('0')) {
    digits = digits.slice(1)
  }
  return digits
}

// Moneroo/Bictorys attendent plutôt un numéro complet ; on reconstruit un E.164
// du mieux possible à partir de l'indicatif du pays (numéro déjà international
// pour « Autre pays »).
export function versE164(local: string, paysIso2: string): string {
  const indicatif = INDICATIFS[paysIso2]
  if (!indicatif) return `+${local.replace(/\D/g, '').replace(/^00/, '')}`
  return `+${indicatif}${versNumeroNational(local, paysIso2)}`
}
