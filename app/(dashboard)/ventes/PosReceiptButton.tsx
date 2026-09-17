'use client'

import { useState } from 'react'
import { Printer } from 'lucide-react'
import ImpressionModal from '@/components/ImpressionModal'
import { createClient } from '@/utils/supabase/client'

type Vente = {
  id: string
  numero: string | null
  date_vente: string | null
  mode_paiement: string | null
  montant_total: number
  montant_paye: number
}

type LigneVente = {
  quantite: number
  prix_unitaire: number
  montant_ligne: number
  articles: { designation: string; unite: string } | { designation: string; unite: string }[] | null
}

export default function PosReceiptButton({
  vente,
  entreprise,
  magasinNom,
  clientNom,
}: {
  vente: Vente
  entreprise: { nom: string; adresse: string | null; telephone: string | null; identifiant_fiscal: string | null; logo_url: string | null; devise: string }
  magasinNom: string
  clientNom: string | null
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [lignes, setLignes] = useState<LigneVente[]>([])
  const [loading, setLoading] = useState(false)

  const openModal = async () => {
    if (lignes.length === 0) {
      setLoading(true)
      const supabase = createClient()
      const { data } = await supabase
        .from('lignes_vente')
        .select('quantite, prix_unitaire, montant_ligne, articles(designation, unite)')
        .eq('vente_id', vente.id)
      
      if (data) setLignes(data as unknown as LigneVente[])
      setLoading(false)
    }
    setIsOpen(true)
  }

  return (
    <>
      <button
        onClick={openModal}
        disabled={loading}
        className="rounded-md bg-surface p-1.5 text-foreground hover:bg-background border border-surface-border transition-colors disabled:opacity-50"
        title="Ticket de caisse"
      >
        <Printer className="h-4 w-4" />
      </button>

      <ImpressionModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        vente={vente}
        lignes={lignes}
        entreprise={entreprise}
        magasinNom={magasinNom}
        clientNom={clientNom}
        devise={entreprise.devise}
      />
    </>
  )
}
