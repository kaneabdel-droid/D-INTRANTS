'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * Affiche ses enfants (`.reveal`) l'un après l'autre, à `step` secondes d'intervalle,
 * dès que le groupe entre dans la zone visible au défilement.
 */
export default function RevealGroup({
  children,
  className,
  step = 0.5,
}: {
  children: React.ReactNode
  className?: string
  step?: number
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true)
      return
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true)
          observer.disconnect()
        }
      },
      { threshold: 0.2 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <div
      ref={ref}
      data-visible={visible}
      className={className}
      style={{ '--reveal-step': `${step}s` } as React.CSSProperties}
    >
      {children}
    </div>
  )
}
