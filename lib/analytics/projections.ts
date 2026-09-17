// Projections de ventes — pas de ML, trois techniques composables (plan §6) :
// moyenne mobile comme base, régression linéaire simple sur la tendance
// récente (faite en TS plutôt qu'avec regr_slope/regr_intercept de Postgres
// pour pouvoir plafonner les projections négatives et les combiner avec la
// saisonnalité), et un indice de saisonnalité hebdomadaire pour le court
// terme. Ces méthodes simples restent fiables même avec peu d'historique
// (un magasin tout juste onboardé), contrairement à des modèles type
// ARIMA/Prophet qui surapprennent sur peu de données.

export type PointJournalier = { date: Date; valeur: number }
export type PointMensuel = { mois: Date; valeur: number }

/** Moyenne mobile sur une fenêtre glissante de `fenetre` points. */
export function moyenneMobile(serie: number[], fenetre: number): number[] {
  if (fenetre <= 0) return [...serie]
  return serie.map((_, i) => {
    const debut = Math.max(0, i - fenetre + 1)
    const fenetreValeurs = serie.slice(debut, i + 1)
    return fenetreValeurs.reduce((s, v) => s + v, 0) / fenetreValeurs.length
  })
}

/** Régression linéaire simple (moindres carrés) : y = pente*x + ordonnee. */
export function regressionLineaire(points: { x: number; y: number }[]): { pente: number; ordonnee: number } {
  const n = points.length
  if (n === 0) return { pente: 0, ordonnee: 0 }
  if (n === 1) return { pente: 0, ordonnee: points[0].y }

  const sommeX = points.reduce((s, p) => s + p.x, 0)
  const sommeY = points.reduce((s, p) => s + p.y, 0)
  const moyenneX = sommeX / n
  const moyenneY = sommeY / n

  let numerateur = 0
  let denominateur = 0
  for (const p of points) {
    numerateur += (p.x - moyenneX) * (p.y - moyenneY)
    denominateur += (p.x - moyenneX) ** 2
  }

  const pente = denominateur === 0 ? 0 : numerateur / denominateur
  const ordonnee = moyenneY - pente * moyenneX
  return { pente, ordonnee }
}

/**
 * Indice de saisonnalité hebdomadaire : CA moyen par jour de semaine (0 =
 * dimanche ... 6 = samedi) sur l'historique fourni (idéalement 8-12 semaines
 * glissantes), exprimé en ratio à la moyenne journalière globale. Un jour
 * "dans la moyenne" a un indice de 1 ; un samedi plus fort aura un indice > 1.
 */
export function indiceSaisonnalite(historique: PointJournalier[]): Record<number, number> {
  if (historique.length === 0) {
    return { 0: 1, 1: 1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1 }
  }

  const moyenneGlobale = historique.reduce((s, p) => s + p.valeur, 0) / historique.length

  const sommesParJour: Record<number, number> = {}
  const comptesParJour: Record<number, number> = {}
  for (const p of historique) {
    const jour = p.date.getDay()
    sommesParJour[jour] = (sommesParJour[jour] ?? 0) + p.valeur
    comptesParJour[jour] = (comptesParJour[jour] ?? 0) + 1
  }

  const indices: Record<number, number> = {}
  for (let jour = 0; jour <= 6; jour++) {
    const moyenneJour = comptesParJour[jour] ? sommesParJour[jour] / comptesParJour[jour] : moyenneGlobale
    indices[jour] = moyenneGlobale > 0 ? moyenneJour / moyenneGlobale : 1
  }
  return indices
}

/**
 * Projection court/moyen terme (7-14 jours) : tendance linéaire sur
 * l'historique fourni, ajustée par l'indice de saisonnalité hebdomadaire,
 * plafonnée à 0 (une projection négative n'a pas de sens pour du CA).
 */
export function projeterCourtTerme(historique: PointJournalier[], nbJours: number): PointJournalier[] {
  if (historique.length === 0) return []

  const points = historique.map((p, i) => ({ x: i, y: p.valeur }))
  const { pente, ordonnee } = regressionLineaire(points)
  const indices = indiceSaisonnalite(historique)

  const derniereDate = historique[historique.length - 1].date
  const decalage = historique.length

  const projections: PointJournalier[] = []
  for (let i = 1; i <= nbJours; i++) {
    const date = new Date(derniereDate)
    date.setDate(date.getDate() + i)

    const tendance = pente * (decalage + i - 1) + ordonnee
    const valeur = Math.max(0, tendance * (indices[date.getDay()] ?? 1))
    projections.push({ date, valeur })
  }
  return projections
}

/**
 * Projection moyen terme (1-3 mois) : tendance linéaire sur des buckets
 * mensuels, sans ajustement de saisonnalité (l'historique est en général trop
 * court pour dégager un motif mensuel fiable).
 */
export function projeterMoyenTerme(historiqueMensuel: PointMensuel[], nbMois: number): PointMensuel[] {
  if (historiqueMensuel.length === 0) return []

  const points = historiqueMensuel.map((p, i) => ({ x: i, y: p.valeur }))
  const { pente, ordonnee } = regressionLineaire(points)

  const dernierMois = historiqueMensuel[historiqueMensuel.length - 1].mois
  const decalage = historiqueMensuel.length

  const projections: PointMensuel[] = []
  for (let i = 1; i <= nbMois; i++) {
    const mois = new Date(dernierMois)
    mois.setMonth(mois.getMonth() + i)
    const valeur = Math.max(0, pente * (decalage + i - 1) + ordonnee)
    projections.push({ mois, valeur })
  }
  return projections
}

/** Regroupe un historique journalier en buckets mensuels (somme par mois). */
export function regrouperParMois(historique: PointJournalier[]): PointMensuel[] {
  const sommesParMois = new Map<string, { mois: Date; valeur: number }>()
  for (const p of historique) {
    const cle = `${p.date.getFullYear()}-${p.date.getMonth()}`
    const bucket = sommesParMois.get(cle)
    if (bucket) {
      bucket.valeur += p.valeur
    } else {
      sommesParMois.set(cle, { mois: new Date(p.date.getFullYear(), p.date.getMonth(), 1), valeur: p.valeur })
    }
  }
  return Array.from(sommesParMois.values()).sort((a, b) => a.mois.getTime() - b.mois.getTime())
}
