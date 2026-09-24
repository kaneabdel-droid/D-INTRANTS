import Link from 'next/link'
import { createClient } from '@/utils/supabase/server'
import { getCurrentUserContext } from '@/lib/auth/getCurrentUserContext'
import { projeterCourtTerme, type PointJournalier } from '@/lib/analytics/projections'
import { AlertTriangle, DollarSign, HandCoins, ShoppingCart, TrendingUp, Wallet } from 'lucide-react'
import { getDictionary, getLocale } from '@/dictionaries'
import VentesTrendChart from './VentesTrendChart'
import CompteExploitation from './CompteExploitation'
import PalmaresClients from './PalmaresClients'

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ annee?: string }> }) {
  const { annee: anneeParam } = await searchParams
  const anneeCourante = new Date().getFullYear()
  const anneeDemandee = Number(anneeParam)
  const annee = Number.isInteger(anneeDemandee) && anneeDemandee >= anneeCourante - 2 && anneeDemandee <= anneeCourante ? anneeDemandee : anneeCourante
  const context = await getCurrentUserContext()
  const supabase = await createClient()
  const dict = await getDictionary(await getLocale())
  const t = dict.dashboard

  const dateFin = new Date()
  const dateDebut = new Date()
  dateDebut.setDate(dateDebut.getDate() - 30)
  const p_date_debut = dateDebut.toISOString().slice(0, 10)
  const p_date_fin = dateFin.toISOString().slice(0, 10)

  if (context.role === 'gerant' || context.role === 'tresorier') {
    const { data: ventesPeriode } = await supabase.rpc('ventes_par_periode', {
      p_magasin_id: context.magasinId,
      p_date_debut,
      p_date_fin,
      p_granularite: 'jour',
    })

    const historique: PointJournalier[] = (ventesPeriode ?? []).map((p: { periode: string; total: number }) => ({
      date: new Date(p.periode),
      valeur: Number(p.total),
    }))
    const projection = projeterCourtTerme(historique, 7)

    const chartData = [
      ...historique.map((p) => ({ date: p.date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }), historique: p.valeur, projection: null })),
      ...projection.map((p, i) => ({
        date: p.date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }),
        historique: i === 0 ? historique[historique.length - 1]?.valeur ?? null : null,
        projection: p.valeur,
      })),
    ]

    const { data: rentabilite } = await supabase
      .rpc('rentabilite_periode', { p_magasin_id: context.magasinId, p_date_debut: dateFin.toISOString().slice(0, 10), p_date_fin: dateFin.toISOString().slice(0, 10) })
      .single()

    const ventesAujourdhui = Number((rentabilite as { ca: number } | null)?.ca ?? 0)

    const { data: articles } = await supabase.from('articles').select('id, seuil_alerte').eq('actif', true)
    const { data: stocks } = await supabase.from('stocks').select('article_id, quantite').eq('magasin_id', context.magasinId)
    const stockParArticle = new Map((stocks ?? []).map((s) => [s.article_id, s.quantite]))
    const nbStockBas = (articles ?? []).filter((a) => (stockParArticle.get(a.id) ?? 0) <= (a.seuil_alerte ?? 0)).length

    const { data: creances } = await supabase
      .from('creances')
      .select('montant_restant')
      .eq('magasin_id', context.magasinId)
      .neq('statut', 'soldee')
    const totalCreances = (creances ?? []).reduce((sum, c) => sum + Number(c.montant_restant), 0)

    const cards = [
      { label: t.ventesJour, value: ventesAujourdhui.toLocaleString('fr-FR'), icon: ShoppingCart },
      { label: t.creancesEnCours, value: totalCreances.toLocaleString('fr-FR'), icon: HandCoins },
      { label: t.articlesStockBas, value: nbStockBas, icon: AlertTriangle },
    ]

    return (
      <div>
        <h1 className="text-2xl font-bold font-heading mb-2">{t.title}</h1>
        <p className="text-foreground-muted mb-6">{context.magasinNom}</p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          {cards.map(({ label, value, icon: Icon }) => (
            <div key={label} className="overflow-hidden rounded-xl bg-surface p-6 shadow-sm border border-surface-border">
              <Icon className="h-5 w-5 text-primary mb-3" />
              <p className="text-2xl font-bold text-foreground">{value}</p>
              <p className="text-sm text-foreground-muted mt-1">{label}</p>
            </div>
          ))}
        </div>

        <CompteExploitation magasinIds={[context.magasinId!]} annee={annee} devise={context.entrepriseDevise} />

        <div className="bg-surface rounded-xl border border-surface-border p-4 sm:p-6">
          <h2 className="font-semibold text-foreground mb-4">{t.evolutionVentes}</h2>
          {historique.length > 0 ? (
            <VentesTrendChart data={chartData} labelVentes={t.chartVentes} labelProjection={t.chartProjection} />
          ) : (
            <p className="text-sm text-foreground-muted">{t.noVentes}</p>
          )}
        </div>

        <PalmaresClients magasinId={context.magasinId!} dateDebut={p_date_debut} dateFin={p_date_fin} devise={context.entrepriseDevise} />
      </div>
    )
  }

  // admin_entreprise : vue consolidée, lecture seule.
  const { data: magasins } = await supabase.from('magasins').select('id').eq('entreprise_id', context.entrepriseId)
  const { data: comparatif } = await supabase.rpc('comparatif_magasins', {
    p_entreprise_id: context.entrepriseId,
    p_date_debut,
    p_date_fin,
  })
  const lignes = (comparatif ?? []) as { ca: number; marge_brute: number }[]
  const totalCa = lignes.reduce((sum, l) => sum + Number(l.ca), 0)
  const totalMarge = lignes.reduce((sum, l) => sum + Number(l.marge_brute), 0)

  const magasinIds = (magasins ?? []).map((m) => m.id)
  let totalCreancesEntreprise = 0
  let totalDettesEntreprise = 0
  if (magasinIds.length > 0) {
    const { data: creances } = await supabase.from('creances').select('montant_restant').in('magasin_id', magasinIds).neq('statut', 'soldee')
    const { data: dettes } = await supabase.from('dettes').select('montant_restant').in('magasin_id', magasinIds).neq('statut', 'soldee')
    totalCreancesEntreprise = (creances ?? []).reduce((sum, c) => sum + Number(c.montant_restant), 0)
    totalDettesEntreprise = (dettes ?? []).reduce((sum, d) => sum + Number(d.montant_restant), 0)
  }

  const cards = [
    { label: t.ca30j, value: totalCa.toLocaleString('fr-FR'), icon: DollarSign },
    { label: t.marge30j, value: totalMarge.toLocaleString('fr-FR'), icon: TrendingUp },
    { label: t.creancesEnCours, value: totalCreancesEntreprise.toLocaleString('fr-FR'), icon: HandCoins },
    { label: t.dettesEnCours, value: totalDettesEntreprise.toLocaleString('fr-FR'), icon: Wallet },
  ]

  return (
    <div>
      <h1 className="text-2xl font-bold font-heading mb-2">{t.title}</h1>
      <p className="text-foreground-muted mb-6">{t.vueConsolidee} {context.entrepriseNom}</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {cards.map(({ label, value, icon: Icon }) => (
          <div key={label} className="overflow-hidden rounded-xl bg-surface p-6 shadow-sm border border-surface-border">
            <Icon className="h-5 w-5 text-primary mb-3" />
            <p className="text-2xl font-bold text-foreground">{value}</p>
            <p className="text-sm text-foreground-muted mt-1">{label}</p>
          </div>
        ))}
      </div>

      <CompteExploitation magasinIds={magasinIds} annee={annee} devise={context.entrepriseDevise} />

      <div className="flex flex-wrap gap-3">
        <Link href="/comparatif" className="rounded-md bg-surface border border-surface-border px-4 py-2 text-sm font-medium text-foreground hover:bg-background">
          {t.voirComparatif}
        </Link>
        <Link href="/rentabilite" className="rounded-md bg-surface border border-surface-border px-4 py-2 text-sm font-medium text-foreground hover:bg-background">
          {t.voirRentabilite}
        </Link>
      </div>
    </div>
  )
}
