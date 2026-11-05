'use client'

import { Printer } from 'lucide-react'

// Dimensions utiles (mm) d'une page A4 une fois les marges retirées, converties
// en px CSS (96dpi) pour être comparées à la largeur réelle du tableau et
// choisir automatiquement l'orientation portrait/paysage.
const MM_TO_PX = 96 / 25.4
const PAGE_MARGIN_MM = 12
const PORTRAIT_CONTENT_PX = (210 - 2 * PAGE_MARGIN_MM) * MM_TO_PX
const LANDSCAPE_CONTENT_PX = (297 - 2 * PAGE_MARGIN_MM) * MM_TO_PX
// En dessous de cette échelle les colonnes deviendraient illisibles : on laisse
// alors le tableau déborder plutôt que de le réduire davantage.
const MIN_SCALE = 0.6

export default function PrintSectionButton({ sectionId, label }: { sectionId: string, label: string }) {
  const handlePrint = () => {
    const target = document.getElementById(sectionId)
    if (!target) return

    // Largeur réelle du tableau (pas celle de son conteneur, qui peut le
    // découper via overflow-x-auto) pour choisir portrait/paysage et, si
    // nécessaire, réduire l'échelle pour que les colonnes tiennent sans être
    // ni coupées ni disproportionnées.
    const table = target.querySelector('table')
    const naturalWidth = table ? table.getBoundingClientRect().width : target.scrollWidth

    let orientation: 'portrait' | 'landscape' = 'portrait'
    let scale = 1
    if (naturalWidth > PORTRAIT_CONTENT_PX) {
      orientation = 'landscape'
      if (naturalWidth > LANDSCAPE_CONTENT_PX) {
        scale = Math.max(MIN_SCALE, LANDSCAPE_CONTENT_PX / naturalWidth)
      }
    }

    const pageStyle = document.createElement('style')
    pageStyle.innerHTML = `@page { size: ${orientation}; margin: ${PAGE_MARGIN_MM}mm; }`
    document.head.appendChild(pageStyle)

    target.classList.add('print-target')
    if (scale !== 1) {
      target.style.setProperty('zoom', String(scale))
    }

    const cleanup = () => {
      target.classList.remove('print-target')
      target.style.removeProperty('zoom')
      pageStyle.remove()
      window.removeEventListener('afterprint', cleanup)
    }
    window.addEventListener('afterprint', cleanup)

    // On laisse le navigateur reflow avec le nouveau `@page` avant d'ouvrir
    // l'impression : appeler print() dans le même cycle que les changements
    // de style peut figer l'aperçu sur une mise en page pas encore à jour et
    // ajouter des pages superflues en fin de document.
    requestAnimationFrame(() => requestAnimationFrame(() => window.print()))
  }

  return (
    <button
      onClick={handlePrint}
      title={label}
      className="inline-flex items-center gap-1.5 rounded-md bg-surface border border-surface-border px-2.5 py-1.5 text-sm font-medium text-foreground hover:bg-background transition-colors"
    >
      <Printer className="h-4 w-4 text-foreground-muted" />
      <span className="hidden sm:inline">{label}</span>
    </button>
  )
}
