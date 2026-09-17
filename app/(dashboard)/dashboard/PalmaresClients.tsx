import { createClient } from '@/utils/supabase/server'
import { getDictionary, getLocale } from '@/dictionaries'
import { formatMontant } from '@/lib/currency'

export default async function PalmaresClients({
  magasinId,
  dateDebut,
  dateFin,
  devise,
}: {
  magasinId: string
  dateDebut: string
  dateFin: string
  devise: string
}) {
  const supabase = await createClient()
  const dict = await getDictionary(await getLocale())
  const t = dict.dashboard

  const { data: palmares } = await supabase.rpc('palmares_clients', {
    p_magasin_id: magasinId,
    p_date_debut: dateDebut,
    p_date_fin: dateFin,
    p_limite: 10,
  })

  if (!palmares || palmares.length === 0) {
    return null
  }

  return (
    <div className="bg-surface rounded-xl border border-surface-border p-4 sm:p-6 mt-8">
      <div className="mb-4">
        <h2 className="font-semibold text-foreground">{t.palmaresTitle || 'Palmarès des meilleurs clients'}</h2>
        <p className="text-sm text-foreground-muted">{t.palmaresDesc || 'Sur les 30 derniers jours'}</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="text-foreground-muted border-b border-surface-border">
            <tr>
              <th className="pb-3 font-medium">{t.client || 'Client'}</th>
              <th className="pb-3 font-medium text-right">{t.achats || 'Achats'}</th>
              <th className="pb-3 font-medium text-right">{t.ca || "Chiffre d'affaires"}</th>
              <th className="pb-3 font-medium text-right">{t.dernierAchat || 'Dernier achat'}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-border">
            {palmares.map((c: any) => (
              <tr key={c.client_id} className="hover:bg-background/50">
                <td className="py-3 font-medium text-foreground">{c.client_nom}</td>
                <td className="py-3 text-right">{c.nb_ventes}</td>
                <td className="py-3 text-right font-semibold text-primary">
                  {formatMontant(c.montant_total, devise)}
                </td>
                <td className="py-3 text-right text-foreground-muted">
                  {new Date(c.derniere_visite).toLocaleDateString('fr-FR')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
