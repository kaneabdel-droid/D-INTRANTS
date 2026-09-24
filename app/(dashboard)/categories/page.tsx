import { createClient } from '@/utils/supabase/server'
import { requireGerant } from '@/lib/auth/getCurrentUserContext'
import { getDictionary, getLocale } from '@/dictionaries'
import CreateCategorieButton from './CreateCategorieButton'
import CategorieRowActions from './CategorieRowActions'

export default async function CategoriesPage() {
  await requireGerant('/categories', 'lire')
  const supabase = await createClient()
  const dict = await getDictionary(await getLocale())
  const t = dict.categories
  const c = dict.common

  const { data: categories } = await supabase
    .from('categories')
    .select('id, nom, description')
    .order('nom')

  return (
    <div>
      <div className="sm:flex sm:items-center">
        <div className="sm:flex-auto min-w-0">
          <h2 className="text-2xl font-bold font-heading text-foreground">{t.title}</h2>
          <p className="mt-2 text-sm text-foreground-muted">{t.subtitle}</p>
        </div>
        <div className="mt-4 sm:ml-16 sm:mt-0 sm:flex-none">
          <CreateCategorieButton dict={dict} />
        </div>
      </div>

      <div className="mt-8 overflow-hidden overflow-x-auto shadow ring-1 ring-surface-border rounded-lg bg-surface">
        <table className="min-w-full divide-y divide-surface-border">
          <thead className="bg-background/50">
            <tr>
              <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-foreground sm:pl-6">{c.name}</th>
              <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-foreground">{c.description}</th>
              <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6">
                <span className="sr-only">{c.actions}</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-border bg-surface">
            {(categories ?? []).map((categorie) => (
              <tr key={categorie.id} className="hover:bg-background/50 transition-colors">
                <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-foreground sm:pl-6">{categorie.nom}</td>
                <td className="px-3 py-4 text-sm text-foreground-muted">{categorie.description || '-'}</td>
                <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                  <CategorieRowActions categorie={categorie} dict={dict} />
                </td>
              </tr>
            ))}
            {(categories ?? []).length === 0 && (
              <tr>
                <td colSpan={3} className="py-8 text-center text-sm text-foreground-muted">{t.empty}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
