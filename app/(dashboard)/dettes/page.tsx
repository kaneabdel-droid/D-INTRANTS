import { createClient } from '@/utils/supabase/server'
import { requireGerant } from '@/lib/auth/getCurrentUserContext'
import { getDictionary, getLocale } from '@/dictionaries'
import ReglerDetteButton from './ReglerDetteButton'

export default async function DettesPage() {
  const context = await requireGerant()
  const supabase = await createClient()
  const dict = await getDictionary(await getLocale())
  const t = dict.dettes
  const c = dict.common

  const { data: dettes } = await supabase
    .from('dettes')
    .select('id, montant_initial, montant_restant, date_echeance, statut, fournisseurs(nom)')
    .eq('magasin_id', context.magasinId)
    .order('date_echeance', { ascending: true, nullsFirst: false })

  const { data: comptes } = await supabase
    .from('comptes_tresorerie')
    .select('id, nom')
    .eq('magasin_id', context.magasinId)

  const totalRestant = (dettes ?? []).reduce((sum, d) => sum + Number(d.montant_restant), 0)

  const badgeStatut: Record<string, string> = {
    en_cours: 'bg-warning/10 text-warning',
    soldee: 'bg-success/10 text-success',
    en_retard: 'bg-danger/10 text-danger',
  }

  type DetteRow = {
    id: string
    montant_initial: number
    montant_restant: number
    date_echeance: string | null
    statut: string
    fournisseurs: { nom: string } | { nom: string }[] | null
  }
  const nomFournisseur = (f: DetteRow['fournisseurs']) => (Array.isArray(f) ? f[0]?.nom : f?.nom)

  return (
    <div>
      <div className="sm:flex sm:items-center">
        <div className="sm:flex-auto min-w-0">
          <h2 className="text-2xl font-bold font-heading text-foreground">{t.title}</h2>
          <p className="mt-2 text-sm text-foreground-muted">
            {t.totalRestant} <strong className="text-foreground">{totalRestant.toLocaleString('fr-FR')}</strong>
          </p>
        </div>
      </div>

      <div className="mt-8 overflow-hidden overflow-x-auto shadow ring-1 ring-surface-border rounded-lg bg-surface">
        <table className="min-w-full divide-y divide-surface-border">
          <thead className="bg-background/50">
            <tr>
              <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-foreground sm:pl-6">{t.colFournisseur}</th>
              <th scope="col" className="px-3 py-3.5 text-right text-sm font-semibold text-foreground">{t.colInitial}</th>
              <th scope="col" className="px-3 py-3.5 text-right text-sm font-semibold text-foreground">{t.colRestant}</th>
              <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-foreground">{t.colEcheance}</th>
              <th scope="col" className="px-3 py-3.5 text-center text-sm font-semibold text-foreground">{t.colStatut}</th>
              <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6">
                <span className="sr-only">{c.actions}</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-border bg-surface">
            {((dettes ?? []) as DetteRow[]).map((d) => (
              <tr key={d.id} className="hover:bg-background/50 transition-colors">
                <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-foreground sm:pl-6">{nomFournisseur(d.fournisseurs) || '-'}</td>
                <td className="px-3 py-4 text-sm text-right text-foreground-muted">{Number(d.montant_initial).toLocaleString('fr-FR')}</td>
                <td className="px-3 py-4 text-sm text-right text-foreground">{Number(d.montant_restant).toLocaleString('fr-FR')}</td>
                <td className="px-3 py-4 text-sm text-foreground-muted">{d.date_echeance ? new Date(d.date_echeance).toLocaleDateString('fr-FR') : '-'}</td>
                <td className="px-3 py-4 text-sm text-center">
                  <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${badgeStatut[d.statut] ?? ''}`}>{d.statut}</span>
                </td>
                <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                  {d.statut !== 'soldee' && (
                    <ReglerDetteButton detteId={d.id} montantRestant={Number(d.montant_restant)} comptes={comptes ?? []} dict={dict} />
                  )}
                </td>
              </tr>
            ))}
            {(dettes ?? []).length === 0 && (
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
