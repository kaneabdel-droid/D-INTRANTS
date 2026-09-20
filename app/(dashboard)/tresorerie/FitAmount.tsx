'use client'

import { useLayoutEffect, useRef } from 'react'

// Affiche un montant sur une seule ligne en réduisant la taille de police
// jusqu'à ce qu'il tienne dans la largeur disponible (max → min, par pas de 0,5 px).
export default function FitAmount({
  children,
  max = 16,
  min = 9,
  className = '',
}: {
  children: string
  max?: number
  min?: number
  className?: string
}) {
  const ref = useRef<HTMLParagraphElement>(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const fit = () => {
      let size = max
      el.style.fontSize = `${size}px`
      while (el.scrollWidth > el.clientWidth && size > min) {
        size -= 0.5
        el.style.fontSize = `${size}px`
      }
    }
    fit()
    // On observe le conteneur (dont la largeur ne dépend pas de la police) pour éviter toute boucle.
    const ro = new ResizeObserver(fit)
    if (el.parentElement) ro.observe(el.parentElement)
    document.fonts?.ready.then(fit)
    return () => ro.disconnect()
  }, [children, max, min])

  return (
    <p ref={ref} className={`overflow-hidden whitespace-nowrap ${className}`} style={{ fontSize: max }}>
      {children}
    </p>
  )
}
