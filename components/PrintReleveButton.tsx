'use client'

import { useState } from 'react'
import { Printer } from 'lucide-react'
import PrintReleveModal from './PrintReleveModal'

export type ReleveType = 'client' | 'fournisseur'

export type EntrepriseInfo = {
  nom: string
  adresse: string | null
  telephone: string | null
  identification: string | null
  logo_url: string | null
  devise: string
}

export default function PrintReleveButton({
  releveType,
  magasinId,
  entreprise,
  referenceId,
  referenceName,
}: {
  releveType: ReleveType
  magasinId: string | null
  entreprise: EntrepriseInfo | any
  referenceId: string
  referenceName: string
}) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-2 rounded-md bg-surface px-3 py-2 text-sm font-semibold text-foreground shadow-sm ring-1 ring-inset ring-surface-border hover:bg-background transition-colors"
        title="Imprimer le relevé"
      >
        <Printer className="h-4 w-4" />
        Relevé
      </button>

      {isOpen && (
        <PrintReleveModal
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
          releveType={releveType}
          magasinId={magasinId}
          entreprise={entreprise}
          referenceId={referenceId}
          referenceName={referenceName}
        />
      )}
    </>
  )
}
