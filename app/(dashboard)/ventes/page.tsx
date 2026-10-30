import { createClient } from '@/utils/supabase/server'
import { requireGerant } from '@/lib/auth/getCurrentUserContext'
import { getDictionary, getLocale } from '@/dictionaries'
import CreateVenteButton from './CreateVenteButton'
import PrintJournalButton from '@/components/PrintJournalButton'
import VentesClientView from './VentesClientView'

export default async function VentesPage({
  searchParams,
}: {
  searchParams?: Promise<{ from?: string; to?: string; tab?: string }>
}) {
  const context = await requireGerant('/ventes', 'lire')
  const supabase = await createClient()
  const dict = await getDictionary(await getLocale())
  const t = dict.ventes
  const { from, to, tab } = (await searchParams) ?? {}

  const { data: entreprise } = await supabase
    .from('entreprises')
    .select('id, nom, adresse, telephone, identification, logo_url, devise')
    .eq('id', context.entrepriseId)
    .single()

  const { data: articles } = await supabase
    .from('articles')
    .select('id, designation, unite, prix_vente, categorie_id')
    .eq('actif', true)
    .order('designation')

  const { data: categories } = await supabase
    .from('categories')
    .select('id, nom')
    .eq('entreprise_id', context.entrepriseId)
    .order('nom')

  const { data: clients } = await supabase
    .from('clients')
    .select('id, nom')
    .eq('magasin_id', context.magasinId)
    .order('nom')

  let ventesQuery = supabase
    .from('ventes')
    .select(`
      id,
      numero,
      date_vente,
      mode_paiement,
      montant_total,
      montant_paye,
      statut,
      clients(nom),
      lignes_vente(
        id,
        quantite,
        prix_unitaire,
        montant_ligne,
        article_id,
        articles(
          id,
          designation,
          unite,
          reference,
          categorie_id,
          categories(id, nom)
        )
      )
    `)
    .eq('magasin_id', context.magasinId)

  if (from) ventesQuery = ventesQuery.gte('date_vente', from)
  if (to) ventesQuery = ventesQuery.lte('date_vente', `${to}T23:59:59`)

  const { data: ventes } = await ventesQuery
    .order('date_vente', { ascending: false })
    .limit(from || to ? 500 : 100)

  return (
    <div>
      <div className="sm:flex sm:items-center">
        <div className="sm:flex-auto min-w-0">
          <h2 className="text-2xl font-bold font-heading text-foreground">{t.title}</h2>
          <p className="mt-2 text-sm text-foreground-muted">{context.magasinNom}</p>
        </div>
        <div className="mt-4 sm:ml-16 sm:mt-0 sm:flex-none flex items-center gap-3">
          {entreprise && (
            <PrintJournalButton
              journalType="ventes"
              magasinId={context.magasinId}
              entreprise={entreprise}
            />
          )}
          <CreateVenteButton articles={articles ?? []} clients={clients ?? []} dict={dict} />
        </div>
      </div>

      <VentesClientView
        ventes={(ventes ?? []) as any}
        articles={articles ?? []}
        categories={categories ?? []}
        entreprise={entreprise as any}
        magasinId={context.magasinId}
        magasinNom={context.magasinNom ?? ''}
        initialFrom={from}
        initialTo={to}
        initialTab={tab}
        dict={dict}
      />
    </div>
  )
}
