import { requireAdminEntreprise } from '@/lib/auth/getCurrentUserContext'
import { createClient } from '@/utils/supabase/server'
import { PALIERS, type PalierCode } from '@/lib/abonnements/paliers'
import PlanSelector from './PlanSelector'

export default async function AbonnementPage() {
  const context = await requireAdminEntreprise()
  const supabase = await createClient()

  const { data: entreprise } = await supabase
    .from('entreprises')
    .select('palier, abonnement_expire_le, telephone')
    .eq('id', context.entrepriseId)
    .single()

  const { count: nombreMagasins } = await supabase
    .from('magasins')
    .select('id', { count: 'exact', head: true })
    .eq('entreprise_id', context.entrepriseId)
    .eq('statut', 'actif')

  const { data: historique } = await supabase
    .from('abonnements')
    .select('id, palier, duree_mois, montant_fcfa, provider, statut, created_at')
    .eq('entreprise_id', context.entrepriseId)
    .order('created_at', { ascending: false })
    .limit(10)

  const palier = (entreprise?.palier ?? 'standard') as PalierCode
  const info = PALIERS[palier]
  const expiration = entreprise?.abonnement_expire_le ? new Date(entreprise.abonnement_expire_le) : null
  const actif = expiration ? expiration > new Date() : false

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold font-heading mb-1">Abonnement</h1>
        <p className="text-foreground-muted text-sm">Gérez le palier et le paiement de l&apos;abonnement d-intrants.</p>
      </div>

      <div className="grid sm:grid-cols-3 gap-4">
        <div className="bg-background rounded-xl border border-surface-border p-5">
          <p className="text-sm text-foreground-muted">Palier actuel</p>
          <p className="text-xl font-bold font-heading">{info.nom}</p>
        </div>
        <div className="bg-background rounded-xl border border-surface-border p-5">
          <p className="text-sm text-foreground-muted">Magasins</p>
          <p className="text-xl font-bold font-heading">{nombreMagasins ?? 0} / {info.magasinsMax}</p>
        </div>
        <div className="bg-background rounded-xl border border-surface-border p-5">
          <p className="text-sm text-foreground-muted">{actif ? 'Expire le' : 'Statut'}</p>
          <p className={`text-xl font-bold font-heading ${actif ? '' : 'text-danger'}`}>
            {expiration ? expiration.toLocaleDateString('fr-FR') : 'Aucun abonnement payé'}
          </p>
        </div>
      </div>

      <div className="bg-background rounded-xl border border-surface-border p-6">
        <h2 className="font-semibold mb-4">{actif ? 'Changer de palier / renouveler' : "S'abonner"}</h2>
        <PlanSelector palierActuel={palier} telephoneParDefaut={entreprise?.telephone ?? undefined} />
      </div>

      <div className="bg-background rounded-xl border border-surface-border overflow-hidden">
        <h2 className="font-semibold px-6 pt-6 pb-4">Historique des paiements</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface text-foreground-muted text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Palier</th>
                <th className="px-4 py-3 font-medium">Durée</th>
                <th className="px-4 py-3 font-medium">Montant</th>
                <th className="px-4 py-3 font-medium">Moyen</th>
                <th className="px-4 py-3 font-medium">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border">
              {(historique ?? []).map((h) => (
                <tr key={h.id}>
                  <td className="px-4 py-3 text-foreground-muted">{new Date(h.created_at).toLocaleDateString('fr-FR')}</td>
                  <td className="px-4 py-3">{PALIERS[h.palier as PalierCode]?.nom ?? h.palier}</td>
                  <td className="px-4 py-3">{h.duree_mois} mois</td>
                  <td className="px-4 py-3">{h.montant_fcfa.toLocaleString('fr-FR')} FCFA</td>
                  <td className="px-4 py-3 capitalize">{h.provider}</td>
                  <td className="px-4 py-3">
                    {h.statut === 'paye' && <span className="text-success font-medium">Payé</span>}
                    {h.statut === 'en_attente' && <span className="text-warning font-medium">En attente</span>}
                    {h.statut === 'echoue' && <span className="text-danger font-medium">Échoué</span>}
                  </td>
                </tr>
              ))}
              {(historique ?? []).length === 0 && (
                <tr><td colSpan={6} className="px-4 py-6 text-center text-foreground-muted">Aucun paiement</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
