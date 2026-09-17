import { createClient } from '@/utils/supabase/server'
import { requireAdminEntreprise } from '@/lib/auth/getCurrentUserContext'
import { getDictionary, getLocale } from '@/dictionaries'
import ComparatifChart from './ComparatifChart'

export default async function ComparatifPage() {
  const context = await requireAdminEntreprise()
  const supabase = await createClient()
  const dict = await getDictionary(await getLocale())
  const t = dict.comparatif

  const dateFin = new Date()
  const dateDebut = new Date()
  dateDebut.setDate(dateDebut.getDate() - 30)

  const { data: comparatif, error } = await supabase.rpc('comparatif_magasins', {
    p_entreprise_id: context.entrepriseId,
    p_date_debut: dateDebut.toISOString().slice(0, 10),
    p_date_fin: dateFin.toISOString().slice(0, 10),
  })

  const lignes = (comparatif ?? []) as { magasin_id: string; magasin_nom: string; ca: number; marge_brute: number }[]

  return (
    <div>
      <h1 className="text-2xl font-bold font-heading text-foreground mb-2">{t.title}</h1>
      <p className="text-sm text-foreground-muted mb-6">
        {context.entrepriseNom} — {t.period}
      </p>

      {error && <p className="text-sm text-danger mb-4">{t.error} {error.message}</p>}

      {lignes.length > 0 ? (
        <div className="bg-surface rounded-xl border border-surface-border p-4 sm:p-6">
          <ComparatifChart data={lignes} labelCa={t.colCa} labelMarge={t.colMarge} />
        </div>
      ) : (
        <p className="text-sm text-foreground-muted">{t.noData}</p>
      )}

      <div className="mt-8 overflow-hidden overflow-x-auto shadow ring-1 ring-surface-border rounded-lg bg-surface">
        <table className="min-w-full divide-y divide-surface-border">
          <thead className="bg-background/50">
            <tr>
              <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-foreground sm:pl-6">{t.colMagasin}</th>
              <th scope="col" className="px-3 py-3.5 text-right text-sm font-semibold text-foreground">{t.colCa}</th>
              <th scope="col" className="px-3 py-3.5 text-right text-sm font-semibold text-foreground">{t.colMarge}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-border bg-surface">
            {lignes.map((l) => (
              <tr key={l.magasin_id}>
                <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-foreground sm:pl-6">{l.magasin_nom}</td>
                <td className="px-3 py-4 text-sm text-right text-foreground">{Number(l.ca).toLocaleString('fr-FR')}</td>
                <td className="px-3 py-4 text-sm text-right text-foreground">{Number(l.marge_brute).toLocaleString('fr-FR')}</td>
              </tr>
            ))}
            {lignes.length === 0 && (
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
