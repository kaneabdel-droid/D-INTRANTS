'use client'

import { useState } from 'react'
import { X, Loader2, Calendar, LayoutTemplate, Printer } from 'lucide-react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { createClient } from '@/utils/supabase/client'
import type { JournalType, EntrepriseInfo } from './PrintJournalButton'

const formatMontant = (n: number | undefined | null) =>
  Math.round(n ?? 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')

type JsPDFAvecAutoTable = InstanceType<typeof jsPDF> & { lastAutoTable?: { finalY: number } }

export default function PrintJournalModal({
  isOpen,
  onClose,
  journalType,
  magasinId,
  entreprise,
  compteId,
}: {
  isOpen: boolean
  onClose: () => void
  journalType: JournalType
  magasinId: string | null
  entreprise: EntrepriseInfo | any
  compteId?: string
}) {
  const [dateDebut, setDateDebut] = useState('')
  const [dateFin, setDateFin] = useState('')
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!isOpen) return null

  const handlePrint = async () => {
    setLoading(true)
    setError(null)
    try {
      const supabase = createClient()
      
      let query = supabase.from(getTableName(journalType)).select(getSelectFields(journalType))
      
      // Filtres de base
      if (journalType === 'tresorerie') {
        if (magasinId) query = query.eq('magasin_id', magasinId)
        if (compteId) query = query.eq('compte_tresorerie_id', compteId)
      } else {
        if (magasinId) query = query.eq('magasin_id', magasinId)
      }

      // Filtres de date
      const dateField = getDateField(journalType)
      if (dateDebut) {
        query = query.gte(dateField, `${dateDebut}T00:00:00.000Z`)
      }
      if (dateFin) {
        query = query.lte(dateField, `${dateFin}T23:59:59.999Z`)
      }

      query = query.order(dateField, { ascending: true })

      const { data, error: fetchError } = await query

      if (fetchError) throw fetchError

      // Pour la trésorerie, il faut éventuellement résoudre les tiers
      let rowsData = data ?? []
      if (journalType === 'tresorerie') {
        rowsData = await resolveTresorerieTiers(supabase, rowsData)
      }

      generatePdf(rowsData)
      onClose()
    } catch (err: any) {
      console.error(err)
      setError(err.message || 'Une erreur est survenue')
    } finally {
      setLoading(false)
    }
  }

  const generatePdf = (data: any[]) => {
    const doc = new jsPDF({ orientation })
    const pageWidth = doc.internal.pageSize.getWidth()

    // Entête de l'entreprise
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
    if (entreprise.identification) {
      doc.text(`Id. Fiscal: ${entreprise.identification}`, 14, yInfo)
      yInfo += 5
    }

    // Titre
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(16)
    doc.setTextColor(50, 50, 50)
    const title = getJournalTitle(journalType)
    doc.text(title, pageWidth - 14, 20, { align: 'right' })

    // Période
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    const periodText = (dateDebut || dateFin) 
      ? `Du ${dateDebut ? new Date(dateDebut).toLocaleDateString('fr-FR') : '-'} au ${dateFin ? new Date(dateFin).toLocaleDateString('fr-FR') : '-'}`
      : 'Toutes les dates'
    doc.text(periodText, pageWidth - 14, 26, { align: 'right' })

    doc.setDrawColor(30, 86, 49)
    doc.line(14, Math.max(35, yInfo + 2), pageWidth - 14, Math.max(35, yInfo + 2))

    // Config Table
    const tableConfig = getTableConfig(journalType, data)

    autoTable(doc, {
      startY: Math.max(40, yInfo + 7),
      head: [tableConfig.head],
      body: tableConfig.body,
      theme: 'striped',
      headStyles: { fillColor: [30, 86, 49], textColor: [255, 255, 255], fontStyle: 'bold' },
      styles: { font: 'helvetica', fontSize: 9, cellPadding: 3 },
      columnStyles: tableConfig.columnStyles,
    })

    const finalY = (doc as JsPDFAvecAutoTable).lastAutoTable?.finalY ?? 100
    
    // Totalisation
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(30, 86, 49)
    
    const totals = calculateTotals(journalType, data)
    let ty = finalY + 10
    totals.forEach((t) => {
      doc.text(t.label, pageWidth - 60, ty)
      doc.text(t.value, pageWidth - 14, ty, { align: 'right' })
      ty += 6
    })

    doc.save(`${title.replace(/ /g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm transition-opacity">
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-surface shadow-xl ring-1 ring-surface-border">
        <div className="flex items-center justify-between border-b border-surface-border px-6 py-4">
          <h3 className="text-lg font-semibold text-foreground">Imprimer le journal</h3>
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

function getTableName(type: JournalType) {
  switch (type) {
    case 'achats': return 'achats'
    case 'ventes': return 'ventes'
    case 'charges': return 'charges'
    case 'creances': return 'creances'
    case 'dettes': return 'dettes'
    case 'tresorerie': return 'journal_tresorerie'
  }
}

function getSelectFields(type: JournalType) {
  switch (type) {
    case 'achats': return 'date_achat, montant_total, montant_paye, statut, fournisseurs(nom)'
    case 'ventes': return 'date_vente, montant_total, montant_paye, statut, clients(nom)'
    case 'charges': return 'date_charge, libelle, categorie, montant'
    case 'creances': return 'created_at, montant_initial, montant_restant, date_echeance, statut, clients(nom)'
    case 'dettes': return 'created_at, montant_initial, montant_restant, date_echeance, statut, fournisseurs(nom)'
    case 'tresorerie': return 'date_mouvement, type_mouvement, montant, categorie, motif, reference_type, reference_id, comptes_tresorerie(nom)'
  }
}

function getDateField(type: JournalType) {
  switch (type) {
    case 'achats': return 'date_achat'
    case 'ventes': return 'date_vente'
    case 'charges': return 'date_charge'
    case 'creances': return 'created_at'
    case 'dettes': return 'created_at'
    case 'tresorerie': return 'date_mouvement'
  }
}

function getJournalTitle(type: JournalType) {
  switch (type) {
    case 'achats': return "Journal des Achats"
    case 'ventes': return "Journal des Ventes"
    case 'charges': return "Journal des Charges"
    case 'creances': return "Journal des Créances"
    case 'dettes': return "Journal des Dettes"
    case 'tresorerie': return "Journal de Trésorerie"
  }
}

async function resolveTresorerieTiers(supabase: any, mouvements: any[]) {
  const achatIds = mouvements.filter((m: any) => m.reference_type === 'achat').map((m: any) => m.reference_id).filter(Boolean)
  const venteIds = mouvements.filter((m: any) => m.reference_type === 'vente').map((m: any) => m.reference_id).filter(Boolean)
  const creanceIds = mouvements.filter((m: any) => m.reference_type === 'creance').map((m: any) => m.reference_id).filter(Boolean)
  const detteIds = mouvements.filter((m: any) => m.reference_type === 'dette').map((m: any) => m.reference_id).filter(Boolean)

  const [achatsRes, ventesRes, creancesRes, dettesRes] = await Promise.all([
    achatIds.length > 0 ? supabase.from('achats').select('id, fournisseurs(nom)').in('id', achatIds) : Promise.resolve({ data: [] }),
    venteIds.length > 0 ? supabase.from('ventes').select('id, clients(nom)').in('id', venteIds) : Promise.resolve({ data: [] }),
    creanceIds.length > 0 ? supabase.from('creances').select('id, clients(nom)').in('id', creanceIds) : Promise.resolve({ data: [] }),
    detteIds.length > 0 ? supabase.from('dettes').select('id, fournisseurs(nom)').in('id', detteIds) : Promise.resolve({ data: [] }),
  ])

  const tiersMap = new Map<string, string>()
  achatsRes.data?.forEach((a: any) => tiersMap.set(a.id, a.fournisseurs?.nom))
  ventesRes.data?.forEach((v: any) => tiersMap.set(v.id, v.clients?.nom))
  creancesRes.data?.forEach((c: any) => tiersMap.set(c.id, c.clients?.nom))
  dettesRes.data?.forEach((d: any) => tiersMap.set(d.id, d.fournisseurs?.nom))

  return mouvements.map((m: any) => ({
    ...m,
    tiers: m.reference_id ? (tiersMap.get(m.reference_id) ?? '-') : '-'
  }))
}

function getTableConfig(type: JournalType, data: any[]) {
  const parseDate = (d: string) => d ? new Date(d).toLocaleDateString('fr-FR') : '-'
  
  switch (type) {
    case 'achats':
      return {
        head: ['Date', 'Fournisseur', 'Total', 'Payé', 'Statut'],
        body: data.map((d: any) => [
          parseDate(d.date_achat), 
          Array.isArray(d.fournisseurs) ? d.fournisseurs[0]?.nom : d.fournisseurs?.nom || '-', 
          formatMontant(d.montant_total), 
          formatMontant(d.montant_paye), 
          d.statut
        ]),
        columnStyles: { 2: { halign: 'right' }, 3: { halign: 'right' } } as any
      }
    case 'ventes':
      return {
        head: ['Date', 'Client', 'Total', 'Payé', 'Statut'],
        body: data.map((d: any) => [
          parseDate(d.date_vente), 
          Array.isArray(d.clients) ? d.clients[0]?.nom : d.clients?.nom || 'Client de passage', 
          formatMontant(d.montant_total), 
          formatMontant(d.montant_paye), 
          d.statut
        ]),
        columnStyles: { 2: { halign: 'right' }, 3: { halign: 'right' } } as any
      }
    case 'charges':
      return {
        head: ['Date', 'Catégorie', 'Libellé', 'Montant'],
        body: data.map((d: any) => [
          parseDate(d.date_charge), 
          (d.categorie || '').replace('_', ' '), 
          d.libelle || '-', 
          formatMontant(d.montant)
        ]),
        columnStyles: { 3: { halign: 'right' } } as any
      }
    case 'creances':
    case 'dettes':
      return {
        head: ['Créé le', type === 'creances' ? 'Client' : 'Fournisseur', 'Total', 'Restant dû', 'Échéance', 'Statut'],
        body: data.map((d: any) => {
          const tiers = type === 'creances' ? d.clients : d.fournisseurs;
          const nomTiers = Array.isArray(tiers) ? tiers[0]?.nom : tiers?.nom;
          return [
            parseDate(d.created_at), 
            nomTiers || '-', 
            formatMontant(d.montant_initial), 
            formatMontant(d.montant_restant), 
            parseDate(d.date_echeance), 
            (d.statut || '').replace('_', ' ')
          ]
        }),
        columnStyles: { 2: { halign: 'right' }, 3: { halign: 'right' } } as any
      }
    case 'tresorerie':
      return {
        head: ['Date', 'Compte', 'Tiers', 'Motif', 'Entrée', 'Sortie'],
        body: data.map((d: any) => [
          parseDate(d.date_mouvement), 
          Array.isArray(d.comptes_tresorerie) ? d.comptes_tresorerie[0]?.nom : d.comptes_tresorerie?.nom || '-',
          d.tiers || '-',
          d.motif || '-',
          d.type_mouvement === 'entree' ? formatMontant(d.montant) : '',
          d.type_mouvement === 'sortie' ? formatMontant(d.montant) : ''
        ]),
        columnStyles: { 4: { halign: 'right', textColor: [30, 86, 49] }, 5: { halign: 'right', textColor: [180, 50, 50] } } as any
      }
  }
}

function calculateTotals(type: JournalType, data: any[]) {
  switch (type) {
    case 'achats':
    case 'ventes': {
      const total = data.reduce((acc, d) => acc + Number(d.montant_total || 0), 0)
      const paye = data.reduce((acc, d) => acc + Number(d.montant_paye || 0), 0)
      return [
        { label: 'Total global:', value: formatMontant(total) },
        { label: 'Total encaissé/payé:', value: formatMontant(paye) }
      ]
    }
    case 'charges': {
      const total = data.reduce((acc, d) => acc + Number(d.montant || 0), 0)
      return [{ label: 'Total charges:', value: formatMontant(total) }]
    }
    case 'creances':
    case 'dettes': {
      const total = data.reduce((acc, d) => acc + Number(d.montant_initial || 0), 0)
      const restant = data.reduce((acc, d) => acc + Number(d.montant_restant || 0), 0)
      return [
        { label: 'Total initial:', value: formatMontant(total) },
        { label: 'Total restant dû:', value: formatMontant(restant) }
      ]
    }
    case 'tresorerie': {
      const entrees = data.filter(d => d.type_mouvement === 'entree').reduce((acc, d) => acc + Number(d.montant || 0), 0)
      const sorties = data.filter(d => d.type_mouvement === 'sortie').reduce((acc, d) => acc + Number(d.montant || 0), 0)
      return [
        { label: 'Total Entrées:', value: formatMontant(entrees) },
        { label: 'Total Sorties:', value: formatMontant(sorties) },
        { label: 'Balance:', value: formatMontant(entrees - sorties) }
      ]
    }
  }
}
