'use client'

import { formatMontant } from '@/lib/currency'
import { Printer, X } from 'lucide-react'
import { useEffect } from 'react'

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

export default function ImpressionModal({
  isOpen,
  onClose,
  vente,
  lignes,
  entreprise,
  magasinNom,
  clientNom,
  devise,
}: {
  isOpen: boolean
  onClose: () => void
  vente: Vente
  lignes: LigneVente[]
  entreprise: { nom: string; adresse: string | null; telephone: string | null; identifiant_fiscal: string | null, logo_url: string | null }
  magasinNom: string
  clientNom: string | null
  devise: string
}) {
  // Prevent scrolling when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen])

  if (!isOpen) return null

  const resteAPayer = vente.montant_total - vente.montant_paye
  const formatDate = (d: string | null) => (d ? new Date(d).toLocaleString('fr-FR') : '')

  return (
    <>
      <div className="fixed inset-0 z-50 overflow-y-auto print:static print:z-auto print:overflow-visible">
        <div className="flex min-h-full items-center justify-center p-4 text-center print:p-0">
          <div className="fixed inset-0 bg-black bg-opacity-75 transition-opacity print:hidden" onClick={onClose} />
          
          <div className="relative w-full max-w-sm transform overflow-hidden rounded-lg bg-white p-6 text-left shadow-xl transition-all print:shadow-none print:w-[80mm] print:p-0 print:m-0 print:rounded-none">
            <div className="absolute right-4 top-4 print:hidden flex gap-2">
              <button
                onClick={() => window.print()}
                className="rounded-md bg-primary p-2 text-white hover:bg-primary-hover"
                title="Imprimer"
              >
                <Printer className="h-4 w-4" />
              </button>
              <button onClick={onClose} className="rounded-md bg-surface p-2 text-foreground hover:bg-background">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Ticket Content */}
            <div id="ticket-content" className="text-black font-sans text-xs print:text-[11px] leading-tight mt-10 print:mt-0">
              <div className="text-center mb-4">
                {entreprise.logo_url && (
                  <img src={entreprise.logo_url} alt="Logo" className="h-12 mx-auto mb-2 grayscale" />
                )}
                <h2 className="font-bold text-lg">{entreprise.nom}</h2>
                {magasinNom !== entreprise.nom && <p className="font-semibold">{magasinNom}</p>}
                {entreprise.adresse && <p>{entreprise.adresse}</p>}
                {entreprise.telephone && <p>Tél: {entreprise.telephone}</p>}
                {entreprise.identifiant_fiscal && <p>Id: {entreprise.identifiant_fiscal}</p>}
              </div>

              <div className="border-t border-dashed border-gray-400 py-2 mb-2 space-y-1">
                <p><strong>Ticket:</strong> {vente.numero}</p>
                <p><strong>Date:</strong> {formatDate(vente.date_vente)}</p>
                <p><strong>Client:</strong> {clientNom || 'Passager'}</p>
              </div>

              <table className="w-full mb-4">
                <thead className="border-b border-dashed border-gray-400">
                  <tr>
                    <th className="text-left py-1 font-semibold">Article</th>
                    <th className="text-right py-1 font-semibold">Qté</th>
                    <th className="text-right py-1 font-semibold">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-dashed divide-gray-200">
                  {lignes.map((l, i) => {
                    const article = Array.isArray(l.articles) ? l.articles[0] : l.articles
                    return (
                      <tr key={i}>
                        <td className="py-1 break-words max-w-[40mm]">
                          {article?.designation}
                          <div className="text-[10px] text-gray-600">{formatMontant(l.prix_unitaire, devise)}</div>
                        </td>
                        <td className="text-right py-1 align-top">{l.quantite} {article?.unite}</td>
                        <td className="text-right py-1 align-top">{formatMontant(l.montant_ligne, devise)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>

              <div className="border-t border-dashed border-gray-400 pt-2 space-y-1">
                <div className="flex justify-between font-bold text-sm">
                  <span>TOTAL:</span>
                  <span>{formatMontant(vente.montant_total, devise)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Payé ({vente.mode_paiement}):</span>
                  <span>{formatMontant(vente.montant_paye, devise)}</span>
                </div>
                {resteAPayer > 0 && (
                  <div className="flex justify-between font-bold">
                    <span>Reste à payer:</span>
                    <span>{formatMontant(resteAPayer, devise)}</span>
                  </div>
                )}
              </div>

              <div className="text-center mt-6 text-[10px]">
                <p>Merci de votre visite !</p>
                <p>Propulsé par d-intrants</p>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Add print styles globally when modal is open */}
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          body > *:not(.fixed) {
            display: none !important;
          }
          @page {
            margin: 0;
            size: 80mm 297mm; /* Standard receipt width */
          }
        }
      `}} />
    </>
  )
}
