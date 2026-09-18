import { createClient } from '@/utils/supabase/server'
import { requireGerant } from '@/lib/auth/getCurrentUserContext'
import { getDictionary, getLocale } from '@/dictionaries'
import CreateAchatButton from './CreateAchatButton'
import AnnulerAchatButton from './AnnulerAchatButton'
import PrintJournalButton from '@/components/PrintJournalButton'

export default async function AchatsPage() {
  const context = await requireGerant()
  const supabase = await createClient()
  const dict = await getDictionary(await getLocale())
  const t = dict.achats
  const c = dict.common

  const { data: entreprise } = await supabase
    .from('entreprises')
    .select('nom, adresse, telephone, identification, logo_url, devise')
    .eq('id', context.entrepriseId)
    .single()

  const { data: articles } = await supabase
    .from('articles')
    .select('id, designation, unite')
    .eq('actif', true)
    .order('designation')

  const { data: fournisseurs } = await supabase.from('fournisseurs').select('id, nom').order('nom')

  const { data: achats } = await supabase
    .from('achats')
    .select('id, date_achat, mode_paiement, montant_total, montant_paye, statut, fournisseurs(nom)')
    .eq('magasin_id', context.magasinId)
    .order('date_achat', { ascending: false })
    .limit(50)

  const badgeStatut: Record<string, string> = {
    validee: 'bg-success/10 text-success',
    brouillon: 'bg-warning/10 text-warning',
    annulee: 'bg-danger/10 text-danger',
  }

  type AchatRow = {
    id: string
    date_achat: string | null
    mode_paiement: string | null
    montant_total: number
    montant_paye: number
    statut: string
    fournisseurs: { nom: string } | { nom: string }[] | null
  }
  const nomFournisseur = (f: AchatRow['fournisseurs']) => (Array.isArray(f) ? f[0]?.nom : f?.nom)

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
              journalType="achats"
              magasinId={context.magasinId}
              entreprise={entreprise}
            />
          )}
          <CreateAchatButton articles={articles ?? []} fournisseurs={fournisseurs ?? []} dict={dict} />
        </div>
      </div>

      <div className="mt-8 overflow-hidden overflow-x-auto shadow ring-1 ring-surface-border rounded-lg bg-surface">
        <table className="min-w-full divide-y divide-surface-border">
          <thead className="bg-background/50">
            <tr>
              <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-foreground sm:pl-6">{t.colDate}</th>
              <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-foreground">{t.colFournisseur}</th>
              <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-foreground">{t.colPaiement}</th>
              <th scope="col" className="px-3 py-3.5 text-right text-sm font-semibold text-foreground">{t.colTotal}</th>
              <th scope="col" className="px-3 py-3.5 text-right text-sm font-semibold text-foreground">{t.colPaye}</th>
              <th scope="col" className="px-3 py-3.5 text-center text-sm font-semibold text-foreground">{t.colStatut}</th>
              <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6">
                <span className="sr-only">{c.actions}</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-border bg-surface">
            {((achats ?? []) as AchatRow[]).map((achat) => (
              <tr key={achat.id} className="hover:bg-background/50 transition-colors">
                <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm text-foreground-muted sm:pl-6">
                  {achat.date_achat ? new Date(achat.date_achat).toLocaleString('fr-FR') : '-'}
                </td>
                <td className="px-3 py-4 text-sm text-foreground">{nomFournisseur(achat.fournisseurs) || t.unspecified}</td>
                <td className="px-3 py-4 text-sm text-foreground-muted capitalize">{achat.mode_paiement}</td>
                <td className="px-3 py-4 text-sm text-right text-foreground">{Number(achat.montant_total).toLocaleString('fr-FR')}</td>
                <td className="px-3 py-4 text-sm text-right text-foreground-muted">{Number(achat.montant_paye).toLocaleString('fr-FR')}</td>
                <td className="px-3 py-4 text-sm text-center">
                  <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${badgeStatut[achat.statut] ?? ''}`}>
                    {achat.statut}
                  </span>
                </td>
                <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                  {achat.statut === 'validee' && <AnnulerAchatButton achatId={achat.id} dict={dict} />}
                </td>
              </tr>
            ))}
            {(achats ?? []).length === 0 && (
              <tr>
                <td colSpan={7} className="py-8 text-center text-sm text-foreground-muted">{t.empty}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
