import Link from 'next/link'
import { createAdminClient } from '@/utils/supabase/admin'
import { PALIERS, type PalierCode } from '@/lib/abonnements/paliers'
import SupprimerAbonnementButton from './SupprimerAbonnementButton'

export default async function AdminPaiementsPage({
  searchParams,
}: {
  searchParams: Promise<{ statut?: string }>
}) {
  const { statut } = await searchParams
  const supabase = createAdminClient()

  let query = supabase
    .from('abonnements')
    .select('id, entreprise_id, palier, duree_mois, montant_fcfa, provider, statut, created_at, paye_at, entreprises(nom)')
    .order('created_at', { ascending: false })
    .limit(200)

  if (statut) query = query.eq('statut', statut)

  const { data: paiements } = await query

  const filtres = [
    { label: 'Tous', value: undefined },
    { label: 'En attente', value: 'en_attente' },
    { label: 'Payés', value: 'paye' },
    { label: 'Échoués', value: 'echoue' },
  ]

  return (
    <div>
      <h1 className="text-2xl font-bold font-heading mb-6">Paiements</h1>

      <div className="flex flex-wrap gap-2 mb-6">
        {filtres.map((f) => (
          <Link
            key={f.label}
            href={f.value ? `/admin/paiements?statut=${f.value}` : '/admin/paiements'}
            className={`px-3 py-1.5 rounded-full text-sm font-medium border ${
              statut === f.value ? 'bg-primary text-white border-primary' : 'border-surface-border text-foreground-muted hover:bg-surface'
            }`}
          >
            {f.label}
          </Link>
        ))}
      </div>

      <div className="bg-background rounded-xl border border-surface-border overflow-hidden overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-surface text-foreground-muted text-left">
            <tr>
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">Entreprise</th>
              <th className="px-4 py-3 font-medium">Palier</th>
              <th className="px-4 py-3 font-medium">Durée</th>
              <th className="px-4 py-3 font-medium">Montant</th>
              <th className="px-4 py-3 font-medium">Prestataire</th>
              <th className="px-4 py-3 font-medium">Statut</th>
              <th className="px-4 py-3 font-medium"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-border">
            {(paiements ?? []).map((p) => {
              const entreprise = Array.isArray(p.entreprises) ? p.entreprises[0] : p.entreprises
              return (
                <tr key={p.id}>
                  <td className="px-4 py-3 text-foreground-muted">
                    {(p.paye_at ?? p.created_at) ? new Date(p.paye_at ?? p.created_at).toLocaleString('fr-FR') : '-'}
                  </td>
                  <td className="px-4 py-3">
                    {p.entreprise_id ? (
                      <Link href={`/admin/entreprises/${p.entreprise_id}`} className="text-primary hover:text-primary-hover">
                        {entreprise?.nom || p.entreprise_id}
                      </Link>
                    ) : (
                      <span className="text-warning">Demande non traitée</span>
                    )}
                  </td>
                  <td className="px-4 py-3 capitalize">{PALIERS[p.palier as PalierCode]?.nom ?? p.palier}</td>
                  <td className="px-4 py-3">{p.duree_mois} mois</td>
                  <td className="px-4 py-3">{Number(p.montant_fcfa).toLocaleString('fr-FR')} FCFA</td>
                  <td className="px-4 py-3 capitalize">{p.provider}</td>
                  <td className="px-4 py-3">
                    <span className={p.statut === 'paye' ? 'text-success' : p.statut === 'echoue' ? 'text-danger' : 'text-primary'}>
                      {p.statut}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {(p.statut === 'echoue' || !p.entreprise_id) && (
                      <SupprimerAbonnementButton
                        abonnementId={p.id}
                        confirmation={
                          p.statut === 'paye'
                            ? 'Cette demande a DÉJÀ été payée et n’est rattachée à aucune entreprise. La supprimer efface définitivement la trace de ce paiement. Continuer ?'
                            : 'Supprimer définitivement cette ligne ?'
                        }
                      />
                    )}
                  </td>
                </tr>
              )
            })}
            {(paiements ?? []).length === 0 && (
              <tr><td colSpan={8} className="px-4 py-6 text-center text-foreground-muted">Aucun paiement</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
