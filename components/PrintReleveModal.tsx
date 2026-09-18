'use client'

import { useState } from 'react'
import { X, Loader2, Calendar, LayoutTemplate, Printer } from 'lucide-react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { createClient } from '@/utils/supabase/client'
import type { ReleveType, EntrepriseInfo } from './PrintReleveButton'

type JsPDFAvecAutoTable = jsPDF & {
  lastAutoTable?: {
    finalY: number
  }
}

export default function PrintReleveModal({
  isOpen,
  onClose,
  releveType,
  magasinId,
  entreprise,
  referenceId,
  referenceName,
}: {
  isOpen: boolean
  onClose: () => void
  releveType: ReleveType
  magasinId: string | null
  entreprise: EntrepriseInfo | any
  referenceId: string
  referenceName: string
}) {
  const [dateDebut, setDateDebut] = useState('')
  const [dateFin, setDateFin] = useState('')
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handlePrint = async () => {
    setLoading(true)
    setError(null)
    const supabase = createClient()
    
    try {
      const data = await fetchReleveData(supabase, releveType, referenceId, dateDebut, dateFin)
      
      const doc = new jsPDF(orientation, 'mm', 'a4')
      const pageWidth = doc.internal.pageSize.getWidth()
      const title = `Relevé de compte ${releveType === 'client' ? 'Client' : 'Fournisseur'}`

      // En-tête Entreprise
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(14)
      doc.setTextColor(30, 86, 49) // primary color
      doc.text(entreprise?.nom?.toUpperCase() || 'D-INTRANTS', 14, 20)
      
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      doc.setTextColor(100, 100, 100)
      let yInfo = 25
      if (entreprise?.adresse) { doc.text(entreprise.adresse, 14, yInfo); yInfo += 5 }
      if (entreprise?.telephone) { doc.text(`Tél: ${entreprise.telephone}`, 14, yInfo); yInfo += 5 }
      if (entreprise?.identification) { doc.text(`Id Fiscal: ${entreprise.identification}`, 14, yInfo); yInfo += 5 }

      // Destinataire
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(11)
      doc.setTextColor(0, 0, 0)
      doc.text(`À l'attention de: ${referenceName}`, 14, yInfo + 10)

      // Titre
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(16)
      doc.setTextColor(50, 50, 50)
      doc.text(title, pageWidth - 14, 20, { align: 'right' })

      // Période
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(10)
      const periodText = (dateDebut || dateFin) 
        ? `Du ${dateDebut ? new Date(dateDebut).toLocaleDateString('fr-FR') : '-'} au ${dateFin ? new Date(dateFin).toLocaleDateString('fr-FR') : '-'}`
        : 'Toutes les dates'
      doc.text(periodText, pageWidth - 14, 26, { align: 'right' })

      doc.setDrawColor(30, 86, 49)
      doc.line(14, Math.max(35, yInfo + 15), pageWidth - 14, Math.max(35, yInfo + 15))

      // Config Table
      const tableConfig = getTableConfig(releveType, data)

      autoTable(doc, {
        startY: Math.max(40, yInfo + 20),
        head: [tableConfig.head],
        body: tableConfig.body,
        theme: 'striped',
        headStyles: { fillColor: [30, 86, 49], textColor: [255, 255, 255], fontStyle: 'bold' },
        styles: { font: 'helvetica', fontSize: 8, cellPadding: 2 },
        columnStyles: tableConfig.columnStyles,
      })

      const finalY = (doc as JsPDFAvecAutoTable).lastAutoTable?.finalY ?? 100
      
      // Totalisation
      doc.setFontSize(11)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(30, 86, 49)
      
      const totals = calculateTotals(data)
      let ty = finalY + 10
      totals.forEach((t) => {
        doc.text(t.label, pageWidth - 85, ty)
        doc.text(t.value, pageWidth - 14, ty, { align: 'right' })
        ty += 8
      })

      doc.save(`${title.replace(/ /g, '_')}_${referenceName.replace(/ /g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`)
    } catch (err: any) {
      console.error(err)
      setError(err.message || 'Une erreur est survenue')
    } finally {
      setLoading(false)
      onClose()
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm transition-opacity">
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-surface shadow-xl ring-1 ring-surface-border">
        <div className="flex items-center justify-between border-b border-surface-border px-6 py-4">
          <h3 className="text-lg font-semibold text-foreground">Imprimer le relevé</h3>
          <button onClick={onClose} className="rounded-md p-1 text-foreground-muted hover:bg-background hover:text-foreground transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {error && (
            <div className="rounded-md bg-danger/10 p-3 text-sm text-danger ring-1 ring-inset ring-danger/20">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Calendar className="h-4 w-4 text-foreground-muted" /> Date de début
              </label>
              <input
                type="date"
                value={dateDebut}
                onChange={(e) => setDateDebut(e.target.value)}
                className="block w-full rounded-md border-0 py-1.5 px-3 bg-background text-foreground shadow-sm ring-1 ring-inset ring-surface-border focus:ring-2 focus:ring-inset focus:ring-primary sm:text-sm sm:leading-6"
              />
            </div>
            <div className="space-y-1.5">
              <label className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Calendar className="h-4 w-4 text-foreground-muted" /> Date de fin
              </label>
              <input
                type="date"
                value={dateFin}
                onChange={(e) => setDateFin(e.target.value)}
                className="block w-full rounded-md border-0 py-1.5 px-3 bg-background text-foreground shadow-sm ring-1 ring-inset ring-surface-border focus:ring-2 focus:ring-inset focus:ring-primary sm:text-sm sm:leading-6"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="flex items-center gap-2 text-sm font-medium text-foreground">
              <LayoutTemplate className="h-4 w-4 text-foreground-muted" /> Format
            </label>
            <select
              value={orientation}
              onChange={(e) => setOrientation(e.target.value as 'portrait' | 'landscape')}
              className="block w-full rounded-md border-0 py-1.5 px-3 bg-background text-foreground shadow-sm ring-1 ring-inset ring-surface-border focus:ring-2 focus:ring-inset focus:ring-primary sm:text-sm sm:leading-6"
            >
              <option value="portrait">Portrait</option>
              <option value="landscape">Paysage</option>
            </select>
          </div>
        </div>

        <div className="bg-background px-6 py-4 flex items-center justify-end gap-3 border-t border-surface-border">
          <button
            onClick={onClose}
            className="rounded-md px-3 py-2 text-sm font-semibold text-foreground hover:bg-surface transition-colors"
          >
            Annuler
          </button>
          <button
            onClick={handlePrint}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-50 transition-colors"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
            {loading ? 'Génération...' : 'Imprimer'}
          </button>
        </div>
      </div>
    </div>
  )
}

// Helpers

const formatMontant = (m: number | string | null | undefined) => {
  return Number(m || 0).toLocaleString('fr-FR')
}

type ReleveOperation = {
  date: string
  libelle: string
  reference?: string
  debit: number
  credit: number
}

async function fetchReleveData(supabase: any, type: ReleveType, referenceId: string, dateDebut: string, dateFin: string) {
  const operations: ReleveOperation[] = []

  if (type === 'client') {
    // 1. Ventes
    let vq = supabase.from('ventes').select('id, date_vente, montant_total, montant_paye').eq('client_id', referenceId)
    if (dateDebut) vq = vq.gte('date_vente', dateDebut)
    if (dateFin) vq = vq.lte('date_vente', dateFin + 'T23:59:59.999Z')
    const { data: ventes } = await vq
    
    // 2. Créances
    let cq = supabase.from('creances').select('id, created_at, montant_initial').eq('client_id', referenceId)
    if (dateDebut) cq = cq.gte('created_at', dateDebut)
    if (dateFin) cq = cq.lte('created_at', dateFin + 'T23:59:59.999Z')
    const { data: creances } = await cq

    const venteIds = (ventes || []).map((v: any) => v.id)
    const creanceIds = (creances || []).map((c: any) => c.id)

    // 3. Paiements (Trésorerie)
    const { data: paiementsVentes } = venteIds.length > 0 
      ? await supabase.from('journal_tresorerie').select('date_mouvement, montant, reference_id, reference_type').eq('reference_type', 'vente').in('reference_id', venteIds)
      : { data: [] }
      
    const { data: paiementsCreances } = creanceIds.length > 0 
      ? await supabase.from('journal_tresorerie').select('date_mouvement, montant, reference_id, reference_type').eq('reference_type', 'creance').in('reference_id', creanceIds)
      : { data: [] }

    // Remplir operations
    ventes?.forEach((v: any) => {
      operations.push({ date: v.date_vente, libelle: 'Vente', debit: Number(v.montant_total), credit: 0 })
      if (Number(v.montant_paye) > 0) {
        operations.push({ date: v.date_vente, libelle: 'Paiement comptant (Vente)', debit: 0, credit: Number(v.montant_paye) })
      }
    })
    creances?.forEach((c: any) => {
      operations.push({ date: c.created_at, libelle: 'Créance (Solde initial)', debit: Number(c.montant_initial), credit: 0 })
    })
    paiementsVentes?.forEach((p: any) => {
      // Filtrer par date
      if (dateDebut && new Date(p.date_mouvement) < new Date(dateDebut)) return
      if (dateFin && new Date(p.date_mouvement) > new Date(dateFin + 'T23:59:59.999Z')) return
      operations.push({ date: p.date_mouvement, libelle: 'Règlement Vente', debit: 0, credit: Number(p.montant) })
    })
    paiementsCreances?.forEach((p: any) => {
      if (dateDebut && new Date(p.date_mouvement) < new Date(dateDebut)) return
      if (dateFin && new Date(p.date_mouvement) > new Date(dateFin + 'T23:59:59.999Z')) return
      operations.push({ date: p.date_mouvement, libelle: 'Règlement Créance', debit: 0, credit: Number(p.montant) })
    })

  } else {
    // 1. Achats
    let aq = supabase.from('achats').select('id, date_achat, montant_total, montant_paye').eq('fournisseur_id', referenceId)
    if (dateDebut) aq = aq.gte('date_achat', dateDebut)
    if (dateFin) aq = aq.lte('date_achat', dateFin + 'T23:59:59.999Z')
    const { data: achats } = await aq
    
    // 2. Dettes
    let dq = supabase.from('dettes').select('id, created_at, montant_initial').eq('fournisseur_id', referenceId)
    if (dateDebut) dq = dq.gte('created_at', dateDebut)
    if (dateFin) dq = dq.lte('created_at', dateFin + 'T23:59:59.999Z')
    const { data: dettes } = await dq

    const achatIds = (achats || []).map((a: any) => a.id)
    const detteIds = (dettes || []).map((d: any) => d.id)

    // 3. Paiements (Trésorerie)
    const { data: paiementsAchats } = achatIds.length > 0 
      ? await supabase.from('journal_tresorerie').select('date_mouvement, montant, reference_id, reference_type').eq('reference_type', 'achat').in('reference_id', achatIds)
      : { data: [] }
      
    const { data: paiementsDettes } = detteIds.length > 0 
      ? await supabase.from('journal_tresorerie').select('date_mouvement, montant, reference_id, reference_type').eq('reference_type', 'dette').in('reference_id', detteIds)
      : { data: [] }

    // Remplir operations (Pour un fournisseur : Achat = Crédit (on lui doit), Paiement = Débit (on le paie))
    achats?.forEach((a: any) => {
      operations.push({ date: a.date_achat, libelle: 'Achat', debit: 0, credit: Number(a.montant_total) })
      if (Number(a.montant_paye) > 0) {
        operations.push({ date: a.date_achat, libelle: 'Paiement comptant (Achat)', debit: Number(a.montant_paye), credit: 0 })
      }
    })
    dettes?.forEach((d: any) => {
      operations.push({ date: d.created_at, libelle: 'Dette (Solde initial)', debit: 0, credit: Number(d.montant_initial) })
    })
    paiementsAchats?.forEach((p: any) => {
      if (dateDebut && new Date(p.date_mouvement) < new Date(dateDebut)) return
      if (dateFin && new Date(p.date_mouvement) > new Date(dateFin + 'T23:59:59.999Z')) return
      operations.push({ date: p.date_mouvement, libelle: 'Règlement Achat', debit: Number(p.montant), credit: 0 })
    })
    paiementsDettes?.forEach((p: any) => {
      if (dateDebut && new Date(p.date_mouvement) < new Date(dateDebut)) return
      if (dateFin && new Date(p.date_mouvement) > new Date(dateFin + 'T23:59:59.999Z')) return
      operations.push({ date: p.date_mouvement, libelle: 'Règlement Dette', debit: Number(p.montant), credit: 0 })
    })
  }

  // Trier par date
  operations.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  
  return operations
}

function getTableConfig(type: ReleveType, data: ReleveOperation[]) {
  const parseDate = (d: string) => d ? new Date(d).toLocaleDateString('fr-FR') : '-'
  
  return {
    head: ['Date', 'Libellé', 'Débit', 'Crédit'],
    body: data.map((d) => [
      parseDate(d.date),
      d.libelle,
      d.debit > 0 ? formatMontant(d.debit) : '',
      d.credit > 0 ? formatMontant(d.credit) : ''
    ]),
    columnStyles: { 2: { halign: 'right', cellWidth: 'wrap' }, 3: { halign: 'right', cellWidth: 'wrap' } } as any
  }
}

function calculateTotals(data: ReleveOperation[]) {
  const totalDebit = data.reduce((acc, d) => acc + d.debit, 0)
  const totalCredit = data.reduce((acc, d) => acc + d.credit, 0)
  const solde = Math.abs(totalDebit - totalCredit)
  
  return [
    { label: 'Total Débit:', value: formatMontant(totalDebit) },
    { label: 'Total Crédit:', value: formatMontant(totalCredit) },
    { label: 'Solde Final:', value: formatMontant(solde) }
  ]
}
