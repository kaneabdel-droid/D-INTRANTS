import { createClient } from '@/utils/supabase/server'
import { requireAdminEntreprise } from '@/lib/auth/getCurrentUserContext'
import { DollarSign, TrendingDown, TrendingUp, Wallet } from 'lucide-react'
import { getDictionary, getLocale } from '@/dictionaries'
import ImpressionEtatsModal from '@/components/ImpressionEtatsModal'

type RentabiliteRow = { ca: number; cout: number; marge_brute: number; autres_produits: number; charges: number; resultat_net: number }
type ArticleRow = { article_id: string; designation: string; quantite: number; ca: number; cout: number; marge: number }

export default async function RentabilitePage({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const context = await requireAdminEntreprise()
  const supabase = await createClient()
  const dict = await getDictionary(await getLocale())
  const t = dict.rentabilite

  const resolvedSearchParams = await searchParams
  
  let dateDebut = new Date()
  dateDebut.setDate(dateDebut.getDate() - 30)
  if (typeof resolvedSearchParams.from === 'string') {
    dateDebut = new Date(resolvedSearchParams.from)
  }
  
  let dateFin = new Date()
  if (typeof resolvedSearchParams.to === 'string') {
    dateFin = new Date(resolvedSearchParams.to)
  }

  const p_date_debut = dateDebut.toISOString().slice(0, 10)
  const p_date_fin = dateFin.toISOString().slice(0, 10)

  const { data: magasins } = await supabase
    .from('magasins')
    .select('id, nom')
    .eq('entreprise_id', context.entrepriseId)
    .order('nom')

  const totaux: RentabiliteRow = { ca: 0, cout: 0, marge_brute: 0, autres_produits: 0, charges: 0, resultat_net: 0 }
  const parMagasin: (RentabiliteRow & { nom: string })[] = []
  const articlesMap = new Map<string, ArticleRow>()

  // Les deux RPC par magasin sont indépendantes entre elles et d'un magasin à
  // l'autre — Promise.all remplace N/2N allers-retours séquentiels par un seul
  // aller-retour parallèle, sans changer le résultat (constaté en audit).
  const resultats = await Promise.all(
    (magasins ?? []).map(async (magasin) => {
      const [{ data: rentabilite }, { data: articles }] = await Promise.all([
        supabase.rpc('rentabilite_periode', { p_magasin_id: magasin.id, p_date_debut, p_date_fin }).single(),
        supabase.rpc('rentabilite_par_article', { p_magasin_id: magasin.id, p_date_debut, p_date_fin }),
      ])
      return { nom: magasin.nom, rentabilite, articles }
    })
  )

  for (const { nom, rentabilite, articles } of resultats) {
    const r = (rentabilite ?? { ca: 0, cout: 0, marge_brute: 0, autres_produits: 0, charges: 0, resultat_net: 0 }) as RentabiliteRow
    parMagasin.push({ nom, ...r })
    totaux.ca += Number(r.ca)
    totaux.cout += Number(r.cout)
    totaux.marge_brute += Number(r.marge_brute)
    totaux.autres_produits += Number(r.autres_produits)
    totaux.charges += Number(r.charges)
    totaux.resultat_net += Number(r.resultat_net)

    for (const a of (articles ?? []) as ArticleRow[]) {
      const existant = articlesMap.get(a.article_id)
      if (existant) {
        existant.quantite += Number(a.quantite)
        existant.ca += Number(a.ca)
        existant.cout += Number(a.cout)
        existant.marge += Number(a.marge)
      } else {
        articlesMap.set(a.article_id, { ...a, quantite: Number(a.quantite), ca: Number(a.ca), cout: Number(a.cout), marge: Number(a.marge) })
      }
    }
  }

  const topArticles = Array.from(articlesMap.values()).sort((a, b) => b.marge - a.marge).slice(0, 10)

  const cards = [
    { label: t.cardCa, value: totaux.ca, icon: DollarSign, color: 'text-primary' },
    { label: t.cardMarge, value: totaux.marge_brute, icon: TrendingUp, color: 'text-success' },
    { label: t.cardAutresProduits, value: totaux.autres_produits, icon: TrendingUp, color: 'text-success' },
    { label: t.cardCharges, value: totaux.charges, icon: TrendingDown, color: 'text-danger' },
    { label: t.cardResultatNet, value: totaux.resultat_net, icon: Wallet, color: totaux.resultat_net >= 0 ? 'text-success' : 'text-danger' },
  ]

  return (
    <div className="print:m-0 print:p-0">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 print:hidden">
        <div>
          <h1 className="text-2xl font-bold font-heading text-foreground mb-1">{t.title}</h1>
          <p className="text-sm text-foreground-muted">{context.entrepriseNom} — {p_date_debut} au {p_date_fin}</p>
        </div>
        <div className="mt-4 sm:mt-0">
          <ImpressionEtatsModal title={t.title} />
        </div>
      </div>
      
      <div className="hidden print:block mb-6">
        <h1 className="text-2xl font-bold text-black">{t.title}</h1>
        <p className="text-sm text-gray-600">{context.entrepriseNom} — Du {new Date(p_date_debut).toLocaleDateString('fr-FR')} au {new Date(p_date_fin).toLocaleDateString('fr-FR')}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        {cards.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="overflow-hidden rounded-xl bg-surface p-6 shadow-sm border border-surface-border">
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-background p-2.5 shrink-0">
                <Icon className={`h-5 w-5 ${color}`} />
              </div>
              <dt className="text-sm font-medium text-foreground-muted leading-tight pt-1">{label}</dt>
            </div>
            <dd className="mt-4 text-2xl font-bold tracking-tight text-foreground">{value.toLocaleString('fr-FR')}</dd>
          </div>
        ))}
      </div>

      <h2 className="text-lg font-semibold text-foreground mb-4">{t.byStore}</h2>
      <div className="overflow-hidden overflow-x-auto shadow ring-1 ring-surface-border rounded-lg bg-surface mb-10">
        <table className="min-w-full divide-y divide-surface-border">
          <thead className="bg-background/50">
            <tr>
              <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-foreground sm:pl-6">{t.colMagasin}</th>
              <th scope="col" className="px-3 py-3.5 text-right text-sm font-semibold text-foreground">{t.colCa}</th>
              <th scope="col" className="px-3 py-3.5 text-right text-sm font-semibold text-foreground">{t.colMarge}</th>
              <th scope="col" className="px-3 py-3.5 text-right text-sm font-semibold text-foreground">{t.colAutresProduits}</th>
              <th scope="col" className="px-3 py-3.5 text-right text-sm font-semibold text-foreground">{t.colCharges}</th>
              <th scope="col" className="px-3 py-3.5 text-right text-sm font-semibold text-foreground">{t.colResultatNet}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-border bg-surface">
            {parMagasin.map((m) => (
              <tr key={m.nom}>
                <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-foreground sm:pl-6">{m.nom}</td>
                <td className="px-3 py-4 text-sm text-right text-foreground">{Number(m.ca).toLocaleString('fr-FR')}</td>
                <td className="px-3 py-4 text-sm text-right text-foreground">{Number(m.marge_brute).toLocaleString('fr-FR')}</td>
                <td className="px-3 py-4 text-sm text-right text-foreground-muted">{Number(m.autres_produits).toLocaleString('fr-FR')}</td>
                <td className="px-3 py-4 text-sm text-right text-foreground-muted">{Number(m.charges).toLocaleString('fr-FR')}</td>
                <td className={`px-3 py-4 text-sm text-right font-medium ${Number(m.resultat_net) >= 0 ? 'text-success' : 'text-danger'}`}>
                  {Number(m.resultat_net).toLocaleString('fr-FR')}
                </td>
              </tr>
            ))}
            {parMagasin.length === 0 && (
              <tr>
                <td colSpan={6} className="py-8 text-center text-sm text-foreground-muted">{t.emptyMagasins}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <h2 className="text-lg font-semibold text-foreground mb-4">{t.topArticles}</h2>
      <div className="overflow-hidden overflow-x-auto shadow ring-1 ring-surface-border rounded-lg bg-surface">
        <table className="min-w-full divide-y divide-surface-border">
          <thead className="bg-background/50">
            <tr>
              <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-foreground sm:pl-6">{t.colArticle}</th>
              <th scope="col" className="px-3 py-3.5 text-right text-sm font-semibold text-foreground">{t.colQuantiteVendue}</th>
              <th scope="col" className="px-3 py-3.5 text-right text-sm font-semibold text-foreground">{t.colCaShort}</th>
              <th scope="col" className="px-3 py-3.5 text-right text-sm font-semibold text-foreground">{t.colMargeShort}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-border bg-surface">
            {topArticles.map((a) => (
              <tr key={a.article_id}>
                <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-foreground sm:pl-6">{a.designation}</td>
                <td className="px-3 py-4 text-sm text-right text-foreground-muted">{a.quantite.toLocaleString('fr-FR')}</td>
                <td className="px-3 py-4 text-sm text-right text-foreground">{a.ca.toLocaleString('fr-FR')}</td>
                <td className="px-3 py-4 text-sm text-right text-success font-medium">{a.marge.toLocaleString('fr-FR')}</td>
              </tr>
            ))}
            {topArticles.length === 0 && (
              <tr>
                <td colSpan={4} className="py-8 text-center text-sm text-foreground-muted">{t.emptyVentes}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
