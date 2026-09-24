import { createClient } from '@/utils/supabase/server'
import { requireGerant } from '@/lib/auth/getCurrentUserContext'
import { getDictionary, getLocale } from '@/dictionaries'
import CreateArticleButton from './CreateArticleButton'
import ArticleRowActions from './ArticleRowActions'

export default async function ArticlesPage() {
  await requireGerant('/articles', 'lire')
  const supabase = await createClient()
  const dict = await getDictionary(await getLocale())
  const t = dict.articles
  const c = dict.common

  const { data: categories } = await supabase.from('categories').select('id, nom').order('nom')
  const { data: articles } = await supabase
    .from('articles')
    .select('id, designation, reference, categorie_id, unite, prix_vente, seuil_alerte, actif, categories(nom)')
    .order('designation')

  const categorieParId = new Map((categories ?? []).map((c) => [c.id, c.nom]))

  return (
    <div>
      <div className="sm:flex sm:items-center">
        <div className="sm:flex-auto min-w-0">
          <h2 className="text-2xl font-bold font-heading text-foreground">{t.title}</h2>
          <p className="mt-2 text-sm text-foreground-muted">{t.subtitle}</p>
        </div>
        <div className="mt-4 sm:ml-16 sm:mt-0 sm:flex-none">
          <CreateArticleButton categories={categories ?? []} dict={dict} />
        </div>
      </div>

      <div className="mt-8 overflow-hidden overflow-x-auto shadow ring-1 ring-surface-border rounded-lg bg-surface">
        <table className="min-w-full divide-y divide-surface-border">
          <thead className="bg-background/50">
            <tr>
              <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-foreground sm:pl-6">{t.colDesignation}</th>
              <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-foreground">{t.colReference}</th>
              <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-foreground">{t.colCategorie}</th>
              <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-foreground">{t.colUnite}</th>
              <th scope="col" className="px-3 py-3.5 text-right text-sm font-semibold text-foreground">{t.colPrixVente}</th>
              <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6">
                <span className="sr-only">{c.actions}</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-border bg-surface">
            {(articles ?? []).map((article) => (
              <tr key={article.id} className="hover:bg-background/50 transition-colors">
                <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-foreground sm:pl-6">{article.designation}</td>
                <td className="px-3 py-4 text-sm text-foreground-muted">{article.reference || '-'}</td>
                <td className="px-3 py-4 text-sm text-foreground-muted">{article.categorie_id ? categorieParId.get(article.categorie_id) : '-'}</td>
                <td className="px-3 py-4 text-sm text-foreground-muted">{article.unite}</td>
                <td className="px-3 py-4 text-sm text-right text-foreground">{Number(article.prix_vente).toLocaleString('fr-FR')}</td>
                <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                  <ArticleRowActions article={article} categories={categories ?? []} dict={dict} />
                </td>
              </tr>
            ))}
            {(articles ?? []).length === 0 && (
              <tr>
                <td colSpan={6} className="py-8 text-center text-sm text-foreground-muted">{t.empty}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
