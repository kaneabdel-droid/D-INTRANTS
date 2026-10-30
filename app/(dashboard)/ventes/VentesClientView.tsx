'use client'

import { useState, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  Receipt,
  Package,
  Eye,
  Filter,
  RotateCcw,
} from 'lucide-react'
import type { Dictionary } from '@/dictionaries'
import ReceiptPdfButton from './ReceiptPdfButton'
import PosReceiptButton from './PosReceiptButton'
import AnnulerVenteButton from './AnnulerVenteButton'
import PrintJournalButton from '@/components/PrintJournalButton'
import VenteDetailModal, { type VenteDetail } from './VenteDetailModal'

export type VenteItem = VenteDetail

export type ArticleItem = {
  id: string
  designation: string
  unite: string
  prix_vente: number
  categorie_id?: string | null
}

export type CategorieItem = {
  id: string
  nom: string
}

export type ClientItem = {
  id: string
  nom: string
}

type LigneAplatir = {
  id: string
  vente_id: string
  date_vente: string | null
  numero: string | null
  client_nom: string
  mode_paiement: string | null
  statut: string
  article_id: string
  designation: string
  unite: string
  reference?: string | null
  categorie_id?: string | null
  categorie_nom: string
  quantite: number
  prix_unitaire: number
  montant_total: number
  raw_vente: VenteItem
}

export default function VentesClientView({
  ventes,
  articles,
  categories,
  entreprise,
  magasinId,
  magasinNom,
  initialFrom,
  initialTo,
  initialTab,
  dict,
}: {
  ventes: VenteItem[]
  articles: ArticleItem[]
  categories: CategorieItem[]
  entreprise: {
    id: string
    nom: string
    adresse: string | null
    telephone: string | null
    identification: string | null
    logo_url: string | null
    devise: string
  }
  magasinId: string | null
  magasinNom: string
  initialFrom?: string
  initialTo?: string
  initialTab?: string
  dict: Dictionary
}) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [activeTab, setActiveTab] = useState<'ventes' | 'articles'>(
    initialTab === 'articles' ? 'articles' : 'ventes'
  )
  const [selectedVente, setSelectedVente] = useState<VenteItem | null>(null)

  // Filtres de l'onglet 2 (Ventes par article)
  const [filterDateFrom, setFilterDateFrom] = useState(initialFrom || '')
  const [filterDateTo, setFilterDateTo] = useState(initialTo || '')
  const [selectedCategorie, setSelectedCategorie] = useState<string>('')
  const [selectedArticle, setSelectedArticle] = useState<string>('')

  const t = dict.ventes
  const c = dict.common
  const devise = entreprise?.devise || 'FCFA'

  const badgeStatut: Record<string, string> = {
    validee: 'bg-success/10 text-success',
    brouillon: 'bg-warning/10 text-warning',
    annulee: 'bg-danger/10 text-danger',
  }

  const nomClient = (cl: VenteItem['clients']) => (Array.isArray(cl) ? cl[0]?.nom : cl?.nom)

  // Filtrer les articles selon la catégorie sélectionnée
  const articlesDisponibles = useMemo(() => {
    if (!selectedCategorie) return articles
    return articles.filter((a) => a.categorie_id === selectedCategorie)
  }, [articles, selectedCategorie])

  // Aplatir toutes les lignes de vente
  const allLignesVente = useMemo(() => {
    const res: LigneAplatir[] = []
    for (const v of ventes) {
      const clientName = nomClient(v.clients) || t.walkInClient
      for (const l of v.lignes_vente ?? []) {
        const art = Array.isArray(l.articles) ? l.articles[0] : l.articles
        const cat = art?.categories
          ? Array.isArray(art.categories)
            ? art.categories[0]
            : art.categories
          : null

        res.push({
          id: l.id,
          vente_id: v.id,
          date_vente: v.date_vente,
          numero: v.numero,
          client_nom: clientName,
          mode_paiement: v.mode_paiement,
          statut: v.statut,
          article_id: l.article_id || art?.id || '',
          designation: art?.designation || 'Article',
          unite: art?.unite || '',
          reference: art?.reference || null,
          categorie_id: art?.categorie_id || cat?.id || null,
          categorie_nom: cat?.nom || 'Sans catégorie',
          quantite: Number(l.quantite) || 0,
          prix_unitaire: Number(l.prix_unitaire) || 0,
          montant_total:
            Number(l.montant_ligne) || (Number(l.quantite) || 0) * (Number(l.prix_unitaire) || 0),
          raw_vente: v,
        })
      }
    }

    // "en ordre de date du plus récent à la date la plus ancienne"
    res.sort((a, b) => {
      const dateA = a.date_vente ? new Date(a.date_vente).getTime() : 0
      const dateB = b.date_vente ? new Date(b.date_vente).getTime() : 0
      return dateB - dateA
    })

    return res
  }, [ventes, t.walkInClient])

  // Appliquer les filtres date / article / catégorie sur l'onglet 2
  const filteredLignes = useMemo(() => {
    return allLignesVente.filter((line) => {
      // Filtre date début
      if (filterDateFrom) {
        if (!line.date_vente || line.date_vente < filterDateFrom) return false
      }
      // Filtre date fin
      if (filterDateTo) {
        const toLimit = `${filterDateTo}T23:59:59`
        if (!line.date_vente || line.date_vente > toLimit) return false
      }
      // Filtre catégorie
      if (selectedCategorie) {
        if (line.categorie_id !== selectedCategorie) return false
      }
      // Filtre article
      if (selectedArticle) {
        if (line.article_id !== selectedArticle) return false
      }
      return true
    })
  }, [allLignesVente, filterDateFrom, filterDateTo, selectedCategorie, selectedArticle])

  // KPIs onglet 2
  const statsArticles = useMemo(() => {
    let totalQte = 0
    let totalMontant = 0
    for (const l of filteredLignes) {
      totalQte += l.quantite
      totalMontant += l.montant_total
    }
    return {
      quantiteTotale: totalQte,
      montantTotal: totalMontant,
      nombreLignes: filteredLignes.length,
    }
  }, [filteredLignes])

  const handleTabChange = (tab: 'ventes' | 'articles') => {
    setActiveTab(tab)
    const params = new URLSearchParams(searchParams.toString())
    params.set('tab', tab)
    router.replace(`?${params.toString()}`, { scroll: false })
  }

  const handleApplyDateServer = (e: React.FormEvent) => {
    e.preventDefault()
    const params = new URLSearchParams(searchParams.toString())
    if (filterDateFrom) params.set('from', filterDateFrom)
    else params.delete('from')

    if (filterDateTo) params.set('to', filterDateTo)
    else params.delete('to')

    params.set('tab', activeTab)
    router.push(`?${params.toString()}`)
  }

  const handleResetFilters = () => {
    setFilterDateFrom('')
    setFilterDateTo('')
    setSelectedCategorie('')
    setSelectedArticle('')
    const params = new URLSearchParams(searchParams.toString())
    params.delete('from')
    params.delete('to')
    params.set('tab', activeTab)
    router.push(`?${params.toString()}`)
  }

  const hasActiveFilters = Boolean(filterDateFrom || filterDateTo || selectedCategorie || selectedArticle)

  return (
    <div>
      {/* Barre d'onglets */}
      <div className="flex items-center space-x-2 border-b border-surface-border mt-6">
        <button
          type="button"
          onClick={() => handleTabChange('ventes')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-all cursor-pointer ${
            activeTab === 'ventes'
              ? 'border-primary text-primary font-semibold'
              : 'border-transparent text-foreground-muted hover:text-foreground hover:border-surface-border'
          }`}
        >
          <Receipt className="w-4 h-4" />
          <span>Par vente</span>
          <span className="ml-1 text-xs px-2 py-0.5 rounded-full bg-background border border-surface-border text-foreground-muted">
            {ventes.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => handleTabChange('articles')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-all cursor-pointer ${
            activeTab === 'articles'
              ? 'border-primary text-primary font-semibold'
              : 'border-transparent text-foreground-muted hover:text-foreground hover:border-surface-border'
          }`}
        >
          <Package className="w-4 h-4" />
          <span>Ventes par article</span>
          <span className="ml-1 text-xs px-2 py-0.5 rounded-full bg-background border border-surface-border text-foreground-muted">
            {allLignesVente.length}
          </span>
        </button>
      </div>

      {/* ======================= ONGLET 1 : PAR VENTE ======================= */}
      {activeTab === 'ventes' && (
        <div className="animate-in fade-in-50 duration-150">
          <div className="mt-4 overflow-hidden overflow-x-auto shadow ring-1 ring-surface-border rounded-lg bg-surface">
            <table className="min-w-full divide-y divide-surface-border">
              <thead className="bg-background/50">
                <tr>
                  <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-foreground sm:pl-6">
                    {t.colDate}
                  </th>
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-foreground">
                    {t.colClient}
                  </th>
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-foreground">
                    {t.colPaiement}
                  </th>
                  <th scope="col" className="px-3 py-3.5 text-right text-sm font-semibold text-foreground">
                    {t.colTotal}
                  </th>
                  <th scope="col" className="px-3 py-3.5 text-right text-sm font-semibold text-foreground">
                    {t.colPaye}
                  </th>
                  <th scope="col" className="px-3 py-3.5 text-center text-sm font-semibold text-foreground">
                    {t.colStatut}
                  </th>
                  <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6">
                    <span className="sr-only">{c.actions}</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border bg-surface">
                {ventes.map((vente) => {
                  const clientAffiche = nomClient(vente.clients) || t.walkInClient
                  return (
                    <tr key={vente.id} className="hover:bg-background/50 transition-colors">
                      <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm text-foreground-muted sm:pl-6">
                        {vente.date_vente ? new Date(vente.date_vente).toLocaleString('fr-FR') : '-'}
                      </td>
                      <td className="px-3 py-4 text-sm">
                        {/* Click sur le client pour afficher le détail de la vente */}
                        <button
                          type="button"
                          onClick={() => setSelectedVente(vente)}
                          className="font-medium text-foreground hover:text-primary hover:underline text-left inline-flex items-center gap-1.5 group cursor-pointer"
                          title="Cliquez pour afficher le détail de cette vente"
                        >
                          <span className="group-hover:underline">{clientAffiche}</span>
                          <Eye className="w-3.5 h-3.5 text-foreground-muted group-hover:text-primary transition-colors opacity-70 group-hover:opacity-100" />
                        </button>
                      </td>
                      <td className="px-3 py-4 text-sm text-foreground-muted capitalize">
                        {vente.mode_paiement}
                      </td>
                      <td className="px-3 py-4 text-sm text-right text-foreground font-medium">
                        {Number(vente.montant_total).toLocaleString('fr-FR')} {devise}
                      </td>
                      <td className="px-3 py-4 text-sm text-right text-foreground-muted">
                        {Number(vente.montant_paye).toLocaleString('fr-FR')} {devise}
                      </td>
                      <td className="px-3 py-4 text-sm text-center">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                            badgeStatut[vente.statut] ?? ''
                          }`}
                        >
                          {vente.statut}
                        </span>
                      </td>
                      <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                        <div className="flex items-center justify-end gap-1">
                          <PosReceiptButton
                            vente={vente as any}
                            entreprise={entreprise as any}
                            magasinNom={magasinNom}
                            clientNom={nomClient(vente.clients) ?? null}
                          />
                          <ReceiptPdfButton
                            vente={vente as any}
                            entreprise={entreprise as any}
                            magasinNom={magasinNom}
                            clientNom={nomClient(vente.clients) ?? null}
                            title={t.downloadReceipt}
                          />
                          {vente.statut === 'validee' && (
                            <AnnulerVenteButton venteId={vente.id} dict={dict} />
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
                {ventes.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-sm text-foreground-muted">
                      {t.empty}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ======================= ONGLET 2 : VENTES PAR ARTICLE ======================= */}
      {activeTab === 'articles' && (
        <div className="animate-in fade-in-50 duration-150">
          {/* Barre de filtres : date, article, catégorie */}
          <div className="mt-6 p-4 rounded-xl bg-surface border border-surface-border shadow-sm space-y-3">
            <form onSubmit={handleApplyDateServer} className="flex flex-wrap items-end gap-3">
              {/* Filtre Date Du */}
              <div>
                <label className="block text-xs font-medium text-foreground-muted mb-1">
                  Du
                </label>
                <input
                  type="date"
                  value={filterDateFrom}
                  onChange={(e) => setFilterDateFrom(e.target.value)}
                  className="rounded-lg bg-background border border-surface-border text-foreground px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              {/* Filtre Date Au */}
              <div>
                <label className="block text-xs font-medium text-foreground-muted mb-1">
                  Au
                </label>
                <input
                  type="date"
                  value={filterDateTo}
                  onChange={(e) => setFilterDateTo(e.target.value)}
                  className="rounded-lg bg-background border border-surface-border text-foreground px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              {/* Filtre Catégorie */}
              <div className="min-w-[180px]">
                <label className="block text-xs font-medium text-foreground-muted mb-1">
                  Catégorie
                </label>
                <select
                  value={selectedCategorie}
                  onChange={(e) => {
                    setSelectedCategorie(e.target.value)
                    setSelectedArticle('') // Réinitialise l'article si la catégorie change
                  }}
                  className="w-full rounded-lg bg-background border border-surface-border text-foreground px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="">Toutes les catégories</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.nom}
                    </option>
                  ))}
                </select>
              </div>

              {/* Filtre Article */}
              <div className="min-w-[200px]">
                <label className="block text-xs font-medium text-foreground-muted mb-1">
                  Article
                </label>
                <select
                  value={selectedArticle}
                  onChange={(e) => setSelectedArticle(e.target.value)}
                  className="w-full rounded-lg bg-background border border-surface-border text-foreground px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="">Tous les articles</option>
                  {articlesDisponibles.map((art) => (
                    <option key={art.id} value={art.id}>
                      {art.designation}
                    </option>
                  ))}
                </select>
              </div>

              {/* Bouton Filtrer */}
              <button
                type="submit"
                className="px-4 py-1.5 text-sm font-medium rounded-lg bg-primary text-white hover:bg-primary/90 transition-colors inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Filter className="w-3.5 h-3.5" />
                <span>Filtrer</span>
              </button>

              {/* Bouton Réinitialiser */}
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="px-3 py-1.5 text-sm font-medium rounded-lg bg-surface border border-surface-border text-foreground-muted hover:text-foreground hover:bg-background transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Réinitialiser</span>
                </button>
              )}
            </form>
          </div>

          {/* Synthèse / KPIs de l'onglet Ventes par article */}
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3.5 rounded-xl bg-surface border border-surface-border">
              <div className="text-xs text-foreground-muted">Total articles vendus (Qté)</div>
              <div className="text-xl font-bold font-heading text-foreground mt-1">
                {statsArticles.quantiteTotale.toLocaleString('fr-FR')}
              </div>
            </div>
            <div className="p-3.5 rounded-xl bg-surface border border-surface-border">
              <div className="text-xs text-foreground-muted">Montant total des ventes</div>
              <div className="text-xl font-bold font-heading text-primary mt-1">
                {statsArticles.montantTotal.toLocaleString('fr-FR')} <span className="text-xs font-normal text-foreground-muted">{devise}</span>
              </div>
            </div>
            <div className="p-3.5 rounded-xl bg-surface border border-surface-border">
              <div className="text-xs text-foreground-muted">Lignes d&apos;articles</div>
              <div className="text-xl font-bold font-heading text-foreground mt-1">
                {statsArticles.nombreLignes}
              </div>
            </div>
          </div>

          {/* Tableau des ventes par article */}
          <div className="mt-4 overflow-hidden overflow-x-auto shadow ring-1 ring-surface-border rounded-lg bg-surface">
            <table className="min-w-full divide-y divide-surface-border">
              <thead className="bg-background/50">
                <tr>
                  <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-foreground sm:pl-6">
                    Date
                  </th>
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-foreground">
                    N° Vente
                  </th>
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-foreground">
                    Client
                  </th>
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-foreground">
                    Catégorie
                  </th>
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-foreground">
                    Article
                  </th>
                  <th scope="col" className="px-3 py-3.5 text-center text-sm font-semibold text-foreground">
                    Quantité
                  </th>
                  <th scope="col" className="px-3 py-3.5 text-right text-sm font-semibold text-foreground">
                    Prix unit.
                  </th>
                  <th scope="col" className="px-3 py-3.5 text-right text-sm font-semibold text-foreground">
                    Total
                  </th>
                  <th scope="col" className="px-3 py-3.5 text-center text-sm font-semibold text-foreground">
                    Statut
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border bg-surface">
                {filteredLignes.map((line) => (
                  <tr key={line.id} className="hover:bg-background/50 transition-colors">
                    <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm text-foreground-muted sm:pl-6">
                      {line.date_vente ? new Date(line.date_vente).toLocaleString('fr-FR') : '-'}
                    </td>
                    <td className="px-3 py-4 text-xs font-mono text-foreground-muted">
                      #{line.numero || line.vente_id.substring(0, 8).toUpperCase()}
                    </td>
                    <td className="px-3 py-4 text-sm">
                      {/* Clic sur le client ici aussi pour afficher le détail de la vente */}
                      <button
                        type="button"
                        onClick={() => setSelectedVente(line.raw_vente)}
                        className="font-medium text-foreground hover:text-primary hover:underline text-left inline-flex items-center gap-1.5 group cursor-pointer"
                        title="Cliquez pour afficher le détail de cette vente"
                      >
                        <span className="group-hover:underline">{line.client_nom}</span>
                        <Eye className="w-3.5 h-3.5 text-foreground-muted group-hover:text-primary transition-colors opacity-70 group-hover:opacity-100" />
                      </button>
                    </td>
                    <td className="px-3 py-4 text-sm text-foreground-muted">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-background border border-surface-border text-xs">
                        {line.categorie_nom}
                      </span>
                    </td>
                    <td className="px-3 py-4 text-sm font-medium text-foreground">
                      {line.designation}
                      {line.unite && (
                        <span className="text-xs text-foreground-muted ml-1 font-normal">
                          ({line.unite})
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-4 text-sm text-center text-foreground font-semibold">
                      {line.quantite} {line.unite || ''}
                    </td>
                    <td className="px-3 py-4 text-sm text-right text-foreground-muted">
                      {Number(line.prix_unitaire).toLocaleString('fr-FR')} {devise}
                    </td>
                    <td className="px-3 py-4 text-sm text-right text-foreground font-bold">
                      {Number(line.montant_total).toLocaleString('fr-FR')} {devise}
                    </td>
                    <td className="px-3 py-4 text-sm text-center">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                          badgeStatut[line.statut] ?? ''
                        }`}
                      >
                        {line.statut}
                      </span>
                    </td>
                  </tr>
                ))}
                {filteredLignes.length === 0 && (
                  <tr>
                    <td colSpan={9} className="py-10 text-center text-sm text-foreground-muted">
                      Aucune vente par article trouvée pour les critères sélectionnés.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal détail de la vente */}
      <VenteDetailModal
        vente={selectedVente}
        entreprise={entreprise}
        magasinNom={magasinNom}
        dict={dict}
        onClose={() => setSelectedVente(null)}
      />
    </div>
  )
}
