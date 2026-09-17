'use client'

import { useState } from 'react'
import { Download, Loader2 } from 'lucide-react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { createClient } from '@/utils/supabase/client'

const formatMontant = (n: number | undefined | null) =>
  Math.round(n ?? 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')

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

type JsPDFAvecAutoTable = InstanceType<typeof jsPDF> & { lastAutoTable?: { finalY: number } }

export default function ReceiptPdfButton({ vente, entreprise, magasinNom, clientNom, title }: {
  vente: Vente
  entreprise: { nom: string; adresse: string | null; telephone: string | null; identifiant_fiscal: string | null; logo_url: string | null; devise: string }
  magasinNom: string
  clientNom: string | null
  title?: string
}) {
  const [loading, setLoading] = useState(false)

  const generatePdf = async () => {
    setLoading(true)
    try {
      const supabase = createClient()
      const { data: lignes } = await supabase
        .from('lignes_vente')
        .select('quantite, prix_unitaire, montant_ligne, articles(designation, unite)')
        .eq('vente_id', vente.id)

      const doc = new jsPDF()
      const pageWidth = doc.internal.pageSize.getWidth()

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(20)
      doc.setTextColor(30, 86, 49)
      doc.text(entreprise.nom, 14, 20)

      doc.setFontSize(11)
      doc.setTextColor(120, 120, 120)
      let yInfo = 27
      if (entreprise.adresse) {
        doc.text(entreprise.adresse, 14, yInfo)
        yInfo += 5
      }
      if (entreprise.telephone) {
        doc.text(`Tél: ${entreprise.telephone}`, 14, yInfo)
        yInfo += 5
      }
      doc.text(magasinNom, 14, yInfo)

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(16)
      doc.setTextColor(200, 200, 200)
      doc.text('FACTURE', pageWidth - 14, 20, { align: 'right' })

      doc.setDrawColor(30, 86, 49)
      doc.line(14, 32, pageWidth - 14, 32)

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      doc.setTextColor(80, 80, 80)
      doc.text(`N° : ${vente.id.substring(0, 8).toUpperCase()}`, 14, 40)
      doc.text(`Date : ${vente.date_vente ? new Date(vente.date_vente).toLocaleString('fr-FR') : '-'}`, 14, 45)
      doc.text(`Client : ${clientNom || 'Client de passage'}`, 14, 50)
      doc.text(`Mode de paiement : ${vente.mode_paiement || '-'}`, 14, 55)

      const body = ((lignes ?? []) as LigneVente[]).map((l) => {
        const article = Array.isArray(l.articles) ? l.articles[0] : l.articles
        return [
          `${article?.designation ?? '-'} (${article?.unite ?? ''})`,
          String(l.quantite),
          formatMontant(l.prix_unitaire),
          formatMontant(l.montant_ligne),
        ]
      })

      autoTable(doc, {
        startY: 62,
        head: [['Article', 'Qté', 'Prix unit.', 'Montant']],
        body,
        theme: 'striped',
        headStyles: { fillColor: [30, 86, 49], textColor: [255, 255, 255], fontStyle: 'bold' },
        styles: { font: 'helvetica', fontSize: 10, cellPadding: 3 },
        columnStyles: {
          1: { halign: 'center', cellWidth: 20 },
          2: { halign: 'right', cellWidth: 35 },
          3: { halign: 'right', cellWidth: 35, fontStyle: 'bold' },
        },
      })

      const finalY = (doc as JsPDFAvecAutoTable).lastAutoTable?.finalY ?? 100
      const resteAPayer = Number(vente.montant_total) - Number(vente.montant_paye)

      let ty = finalY + 10
      doc.setFontSize(10)
      doc.setFont('helvetica', 'bold')
      doc.text('Total:', pageWidth - 60, ty)
      doc.text(`${formatMontant(vente.montant_total)}`, pageWidth - 14, ty, { align: 'right' })
      ty += 8
      doc.setFont('helvetica', 'normal')
      doc.text(`Payé (${vente.mode_paiement}):`, pageWidth - 60, ty)
      doc.text(`${formatMontant(vente.montant_paye)}`, pageWidth - 14, ty, { align: 'right' })

      if (resteAPayer > 0) {
        ty += 8
        doc.setFont('helvetica', 'bold')
        doc.text('Reste à payer:', pageWidth - 60, ty)
        doc.text(`${formatMontant(resteAPayer)}`, pageWidth - 14, ty, { align: 'right' })
      }

      doc.save(`Recu_${vente.id.substring(0, 8)}.pdf`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <button onClick={generatePdf} disabled={loading} className="text-foreground-muted hover:text-primary p-1 disabled:opacity-50" title={title ?? 'Télécharger le reçu'}>
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
    </button>
  )
}
