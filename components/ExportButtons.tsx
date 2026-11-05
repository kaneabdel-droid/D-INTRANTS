'use client'

import React from 'react'
import { FileDown, Printer } from 'lucide-react'

type Cellule = string | number | null | undefined

export function ExportButtons({
  titre,
  sousTitre,
  colonnes,
  lignes,
  fichier,
}: {
  titre: string
  sousTitre?: string
  colonnes: string[]
  lignes: Cellule[][]
  fichier: string
}) {
  function csv() {
    const echapper = (v: Cellule) => `"${String(v ?? '').replace(/"/g, '""')}"`
    const entete = [[titre], ...(sousTitre ? [[sousTitre]] : []), []]
    const corps = [colonnes, ...lignes.map((l) => l.map((v) => (typeof v === 'number' ? Math.round(v) : v)))]
    const contenu = [...entete, ...corps].map((l) => l.map(echapper).join(';')).join('\r\n')
    const blob = new Blob(['\uFEFF' + contenu], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${fichier}.csv`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 4000)
  }

  function imprimer() {
    window.print()
  }

  return (
    <div className="flex items-center gap-2 print:hidden">
      <button
        type="button"
        onClick={csv}
        className="inline-flex items-center gap-1.5 rounded-lg border border-surface-border bg-surface px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-black/5 transition-colors cursor-pointer"
        title="Exporter au format CSV / Excel"
      >
        <FileDown className="w-3.5 h-3.5 text-primary" />
        <span>Export CSV</span>
      </button>
      <button
        type="button"
        onClick={imprimer}
        className="inline-flex items-center gap-1.5 rounded-lg border border-surface-border bg-surface px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-black/5 transition-colors cursor-pointer"
        title="Imprimer cette section"
      >
        <Printer className="w-3.5 h-3.5" />
        <span>Imprimer</span>
      </button>
    </div>
  )
}

