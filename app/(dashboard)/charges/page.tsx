import { createClient } from '@/utils/supabase/server'
import { requireGerant } from '@/lib/auth/getCurrentUserContext'
import { getDictionary, getLocale } from '@/dictionaries'
import CreateChargeButton from './CreateChargeButton'
import ChargeRowActions from './ChargeRowActions'
import PrintJournalButton from '@/components/PrintJournalButton'

export default async function ChargesPage() {
  const context = await requireGerant('/charges', 'lire')
  const supabase = await createClient()
  const dict = await getDictionary(await getLocale())
  const t = dict.charges
  const c = dict.common

  const { data: entreprise } = await supabase
    .from('entreprises')
    .select('nom, adresse, telephone, identification, logo_url, devise')
    .eq('id', context.entrepriseId)
    .single()

  const { data: comptes } = await supabase
    .from('comptes_tresorerie')
    .select('id, nom')
    .eq('magasin_id', context.magasinId)

  const { data: charges } = await supabase
    .from('charges')
    .select('id, categorie, libelle, montant, date_charge, recurrente, compte_tresorerie_id')
    .eq('magasin_id', context.magasinId)
    .order('date_charge', { ascending: false })
    .limit(50)

  const totalMois = (charges ?? [])
    .filter((c) => c.date_charge && new Date(c.date_charge).getMonth() === new Date().getMonth())
    .reduce((sum, c) => sum + Number(c.montant), 0)

  return (
    <div>
      <div className="sm:flex sm:items-center">
        <div className="sm:flex-auto min-w-0">
          <h2 className="text-2xl font-bold font-heading text-foreground">{t.title}</h2>
          <p className="mt-2 text-sm text-foreground-muted">
            {t.thisMonth} <strong className="text-foreground">{totalMois.toLocaleString('fr-FR')}</strong>
          </p>
        </div>
        <div className="mt-4 sm:ml-16 sm:mt-0 sm:flex-none flex items-center gap-3">
          {entreprise && (
            <PrintJournalButton
              journalType="charges"
              magasinId={context.magasinId}
              entreprise={entreprise}
            />
          )}
          <CreateChargeButton comptes={comptes ?? []} dict={dict} />
        </div>
      </div>

      <div className="mt-8 overflow-hidden overflow-x-auto shadow ring-1 ring-surface-border rounded-lg bg-surface">
        <table className="min-w-full divide-y divide-surface-border">
          <thead className="bg-background/50">
            <tr>
              <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-foreground sm:pl-6">{t.colDate}</th>
              <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-foreground">{t.colCategorie}</th>
              <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-foreground">{t.colLibelle}</th>
              <th scope="col" className="px-3 py-3.5 text-right text-sm font-semibold text-foreground">{t.colMontant}</th>
              <th scope="col" className="px-3 py-3.5 text-center text-sm font-semibold text-foreground">{t.colRecurrente}</th>
              <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6">
                <span className="sr-only">{c.actions}</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-border bg-surface">
            {(charges ?? []).map((charge) => (
              <tr key={charge.id} className="hover:bg-background/50 transition-colors">
                <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm text-foreground-muted sm:pl-6">
                  {charge.date_charge ? new Date(charge.date_charge).toLocaleDateString('fr-FR') : '-'}
                </td>
                <td className="px-3 py-4 text-sm text-foreground capitalize">{charge.categorie}</td>
                <td className="px-3 py-4 text-sm text-foreground-muted">{charge.libelle || '-'}</td>
                <td className="px-3 py-4 text-sm text-right text-foreground">{Number(charge.montant).toLocaleString('fr-FR')}</td>
                <td className="px-3 py-4 text-sm text-center">{charge.recurrente ? c.yes : c.no}</td>
                <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                  <ChargeRowActions charge={charge} comptes={comptes ?? []} dict={dict} />
                </td>
              </tr>
            ))}
            {(charges ?? []).length === 0 && (
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
