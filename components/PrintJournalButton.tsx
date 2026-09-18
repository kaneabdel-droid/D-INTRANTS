'use client'

import { useState } from 'react'
import { Printer } from 'lucide-react'
import PrintJournalModal from './PrintJournalModal'

export type JournalType = 'achats' | 'ventes' | 'charges' | 'creances' | 'dettes' | 'tresorerie'

export type EntrepriseInfo = {
  nom: string
  adresse: string | null
  telephone: string | null
  identification: string | null
  logo_url: string | null
  devise: string
}

export default function PrintJournalButton({
  journalType,
  magasinId,
  entreprise,
  compteId,
}: {
  journalType: JournalType
  magasinId: string
  entreprise: EntrepriseInfo
  compteId?: string
}) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-2 rounded-md bg-surface px-3 py-2 text-sm font-semibold text-foreground shadow-sm ring-1 ring-inset ring-surface-border hover:bg-background transition-colors"
        title="Imprimer le journal"
      >
        <Printer className="h-4 w-4" />
        Imprimer
      </button>

      <PrintJournalModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        journalType={journalType}
        magasinId={magasinId}
        entreprise={entreprise}
        compteId={compteId}
      />
    </>
  )
}
