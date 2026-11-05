export { cn } from "cn"

export function formatMontant(montant: number | string | undefined | null, devise = 'FCFA'): string {
  const n = Number(montant) || 0
  return `${Math.round(n).toLocaleString('fr-FR')} ${devise}`
}
