'use client'

import { useEffect, useState } from 'react'
import { X, Eye, Receipt, Calendar, User, CreditCard, Tag, Package, CheckCircle, AlertTriangle, XCircle, Loader2 } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import type { Dictionary } from '@/dictionaries'
import ReceiptPdfButton from './ReceiptPdfButton'
import PosReceiptButton from './PosReceiptButton'

export type VenteDetail = {
  id: string
  numero: string | null
  date_vente: string | null
  mode_paiement: string | null
  montant_total: number
  montant_paye: number
  statut: string
  clients: { nom: string } | { nom: string }[] | null
  lignes_vente?: Array<{
    id: string
    quantite: number
    prix_unitaire: number
    montant_ligne: number
    article_id?: string
    articles:
      | {
          id?: string
          designation: string
          unite: string
          reference?: string | null
          categorie_id?: string | null
          categories?: { id?: string; nom: string } | { id?: string; nom: string }[] | null
        }
      | {
          id?: string
          designation: string
          unite: string
          reference?: string | null
          categorie_id?: string | null
          categories?: { id?: string; nom: string } | { id?: string; nom: string }[] | null
        }[]
      | null
  }>
}

type LigneAffichee = {
  id: string
  designation: string
  unite: string
  reference?: string | null
  quantite: number
  prix_unitaire: number
  montant_ligne: number
}

const formatFCFA = (val: number | undefined | null) =>
  Math.round(val ?? 0).toLocaleString('fr-FR')

export default function VenteDetailModal({
  vente,
  entreprise,
  magasinNom,
  dict,
  onClose,
}: {
  vente: VenteDetail | null
  entreprise: {
    nom: string
    adresse: string | null
    telephone: string | null
    identification: string | null
    logo_url: string | null
    devise: string
  }
  magasinNom: string
  dict: Dictionary
  onClose: () => void
}) {
  const [lignes, setLignes] = useState<LigneAffichee[]>([])
  const [loading, setLoading] = useState(false)

  const t = dict.ventes
  const c = dict.common
  const devise = entreprise?.devise || 'FCFA'

  useEffect(() => {
    if (!vente) return

    // Si les lignes sont déjà attachées
    if (vente.lignes_vente && vente.lignes_vente.length > 0) {
      const transformees: LigneAffichee[] = vente.lignes_vente.map((l) => {
        const art = Array.isArray(l.articles) ? l.articles[0] : l.articles
        return {
          id: l.id,
          designation: art?.designation || 'Article',
          unite: art?.unite || '',
          reference: art?.reference || null,
          quantite: Number(l.quantite) || 0,
          prix_unitaire: Number(l.prix_unitaire) || 0,
          montant_ligne: Number(l.montant_ligne) || (Number(l.quantite) * Number(l.prix_unitaire)),
        }
      })
      setLignes(transformees)
      setLoading(false)
      return
    }

    // Sinon, on charge les lignes depuis Supabase
    let isMounted = true
    async function chargerLignes() {
      setLoading(true)
      try {
        const supabase = createClient()
        const { data, error } = await supabase
          .from('lignes_vente')
          .select('id, quantite, prix_unitaire, montant_ligne, articles(designation, unite, reference)')
          .eq('vente_id', vente!.id)

        if (!error && data && isMounted) {
          const transformees: LigneAffichee[] = data.map((l: any) => {
            const art = Array.isArray(l.articles) ? l.articles[0] : l.articles
            return {
              id: l.id,
              designation: art?.designation || 'Article',
              unite: art?.unite || '',
              reference: art?.reference || null,
              quantite: Number(l.quantite) || 0,
              prix_unitaire: Number(l.prix_unitaire) || 0,
              montant_ligne: Number(l.montant_ligne) || (Number(l.quantite) * Number(l.prix_unitaire)),
            }
          })
          setLignes(transformees)
        }
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    chargerLignes()
    return () => {
      isMounted = false
    }
  }, [vente])

  if (!vente) return null

  const nomClient = Array.isArray(vente.clients) ? vente.clients[0]?.nom : vente.clients?.nom
  const resteAPayer = Math.max(0, Number(vente.montant_total) - Number(vente.montant_paye))

  const statutBadges: Record<string, { label: string; className: string; icon: any }> = {
    validee: { label: 'Validée', className: 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20', icon: CheckCircle },
    brouillon: { label: 'Brouillon', className: 'bg-amber-500/10 text-amber-500 border border-amber-500/20', icon: AlertTriangle },
    annulee: { label: 'Annulée', className: 'bg-rose-500/10 text-rose-500 border border-rose-500/20', icon: XCircle },
  }

  const badge = statutBadges[vente.statut] || {
    label: vente.statut,
    className: 'bg-surface-border/50 text-foreground-muted',
    icon: Tag,
  }
  const StatutIcon = badge.icon

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl bg-surface border border-surface-border rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-border bg-background/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold font-heading text-foreground">
                  Détail de la vente
                </h3>
                <span className="text-xs px-2 py-0.5 rounded-md bg-background border border-surface-border font-mono text-foreground-muted">
                  #{vente.numero || vente.id.substring(0, 8).toUpperCase()}
                </span>
              </div>
              <p className="text-xs text-foreground-muted">
                {magasinNom ? `${magasinNom} • ` : ''}
                {vente.date_vente ? new Date(vente.date_vente).toLocaleString('fr-FR') : '-'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-foreground-muted hover:text-foreground hover:bg-background rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Contenu avec défilement */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Grille d'informations */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-xl bg-background border border-surface-border">
              <div className="flex items-center gap-2 text-foreground-muted text-xs mb-1">
                <User className="w-3.5 h-3.5" />
                <span>Client</span>
              </div>
              <div className="font-semibold text-foreground truncate" title={nomClient || t.walkInClient}>
                {nomClient || t.walkInClient}
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-background border border-surface-border">
              <div className="flex items-center gap-2 text-foreground-muted text-xs mb-1">
                <CreditCard className="w-3.5 h-3.5" />
                <span>Paiement</span>
              </div>
              <div className="font-semibold text-foreground capitalize">
                {vente.mode_paiement || '-'}
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-background border border-surface-border">
              <div className="flex items-center gap-2 text-foreground-muted text-xs mb-1">
                <Calendar className="w-3.5 h-3.5" />
                <span>Date & heure</span>
              </div>
              <div className="font-semibold text-foreground text-xs">
                {vente.date_vente ? new Date(vente.date_vente).toLocaleString('fr-FR') : '-'}
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-background border border-surface-border">
              <div className="flex items-center gap-2 text-foreground-muted text-xs mb-1">
                <Tag className="w-3.5 h-3.5" />
                <span>Statut</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${badge.className}`}>
                  <StatutIcon className="w-3 h-3" />
                  {badge.label}
                </span>
              </div>
            </div>
          </div>

          {/* Synthèse financière */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 rounded-xl bg-background/60 border border-surface-border">
            <div>
              <div className="text-xs text-foreground-muted">Montant Total</div>
              <div className="text-xl font-bold font-heading text-foreground mt-0.5">
                {formatFCFA(vente.montant_total)} <span className="text-xs font-normal text-foreground-muted">{devise}</span>
              </div>
            </div>
            <div>
              <div className="text-xs text-foreground-muted">Montant Payé</div>
              <div className="text-xl font-bold font-heading text-emerald-500 mt-0.5">
                {formatFCFA(vente.montant_paye)} <span className="text-xs font-normal text-foreground-muted">{devise}</span>
              </div>
            </div>
            <div>
              <div className="text-xs text-foreground-muted">Reste à payer</div>
              <div className={`text-xl font-bold font-heading mt-0.5 ${resteAPayer > 0 ? 'text-amber-500' : 'text-foreground-muted'}`}>
                {formatFCFA(resteAPayer)} <span className="text-xs font-normal text-foreground-muted">{devise}</span>
              </div>
            </div>
          </div>

          {/* Tableau des articles vendus */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Package className="w-4 h-4 text-primary" />
                Articles vendus ({lignes.length})
              </h4>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-10 text-foreground-muted gap-2 text-sm bg-background/30 rounded-xl border border-surface-border">
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
                Chargement des articles...
              </div>
            ) : lignes.length === 0 ? (
              <div className="py-8 text-center text-sm text-foreground-muted bg-background/30 rounded-xl border border-surface-border">
                Aucun article renseigné pour cette vente.
              </div>
            ) : (
              <div className="overflow-hidden border border-surface-border rounded-xl bg-background">
                <table className="min-w-full divide-y divide-surface-border">
                  <thead className="bg-surface/50 text-xs font-semibold text-foreground-muted uppercase tracking-wider">
                    <tr>
                      <th className="px-4 py-3 text-left">Article</th>
                      <th className="px-4 py-3 text-right">Prix unit.</th>
                      <th className="px-4 py-3 text-center">Quantité</th>
                      <th className="px-4 py-3 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-border text-sm">
                    {lignes.map((l) => (
                      <tr key={l.id} className="hover:bg-surface/30 transition-colors">
                        <td className="px-4 py-3 text-foreground font-medium">
                          {l.designation}
                          {l.unite && (
                            <span className="text-xs text-foreground-muted ml-1.5 font-normal">
                              ({l.unite})
                            </span>
                          )}
                          {l.reference && (
                            <div className="text-[11px] font-mono text-foreground-muted">
                              Réf: {l.reference}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right text-foreground-muted">
                          {formatFCFA(l.prix_unitaire)} {devise}
                        </td>
                        <td className="px-4 py-3 text-center text-foreground font-semibold">
                          {l.quantite} {l.unite || ''}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-foreground">
                          {formatFCFA(l.montant_ligne)} {devise}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-surface/70 border-t border-surface-border">
                    <tr>
                      <td colSpan={3} className="px-4 py-3 text-right font-bold text-foreground text-sm">
                        Total :
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-primary text-base">
                        {formatFCFA(vente.montant_total)} {devise}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Footer avec boutons d'impression et fermeture */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-t border-surface-border bg-background/50">
          <div className="flex items-center gap-2">
            <PosReceiptButton
              vente={vente as any}
              entreprise={entreprise as any}
              magasinNom={magasinNom}
              clientNom={nomClient || null}
            />
            <ReceiptPdfButton
              vente={vente as any}
              entreprise={entreprise as any}
              magasinNom={magasinNom}
              clientNom={nomClient || null}
              title={t.downloadReceipt}
            />
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-surface border border-surface-border text-foreground hover:bg-background transition-colors cursor-pointer"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  )
}
