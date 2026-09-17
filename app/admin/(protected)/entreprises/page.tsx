import Link from 'next/link'
import { createAdminClient } from '@/utils/supabase/admin'
import CreerEntrepriseButton from './CreerEntrepriseButton'
import { PALIERS, type PalierCode } from '@/lib/abonnements/paliers'

export default async function AdminEntreprisesPage() {
  const supabase = createAdminClient()

  const { data: entreprises } = await supabase
    .from('entreprises')
    .select('id, nom, devise, statut, palier, abonnement_expire_le, created_at')
    .order('created_at', { ascending: false })

  const { data: magasins } = await supabase.from('magasins').select('id, entreprise_id')
  const { data: utilisateurs } = await supabase.from('utilisateurs').select('id, entreprise_id')

  const magasinsParEntreprise = new Map<string, number>()
  for (const m of magasins ?? []) {
    magasinsParEntreprise.set(m.entreprise_id, (magasinsParEntreprise.get(m.entreprise_id) ?? 0) + 1)
  }
  const utilisateursParEntreprise = new Map<string, number>()
  for (const u of utilisateurs ?? []) {
    utilisateursParEntreprise.set(u.entreprise_id, (utilisateursParEntreprise.get(u.entreprise_id) ?? 0) + 1)
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-6">
        <h1 className="text-2xl font-bold font-heading">Entreprises ({entreprises?.length ?? 0})</h1>
        <CreerEntrepriseButton />
      </div>

      <div className="bg-background rounded-xl border border-surface-border overflow-hidden overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-surface text-foreground-muted text-left">
            <tr>
              <th className="px-4 py-3 font-medium">Nom</th>
              <th className="px-4 py-3 font-medium">Magasins</th>
              <th className="px-4 py-3 font-medium">Utilisateurs</th>
              <th className="px-4 py-3 font-medium">Palier</th>
              <th className="px-4 py-3 font-medium">Devise</th>
              <th className="px-4 py-3 font-medium">Statut</th>
              <th className="px-4 py-3 font-medium">Créée le</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-border">
            {(entreprises ?? []).map((entreprise) => (
              <tr key={entreprise.id} className="hover:bg-surface transition-colors">
                <td className="px-4 py-3">
                  <Link href={`/admin/entreprises/${entreprise.id}`} className="font-medium text-primary hover:text-primary-hover">
                    {entreprise.nom}
                  </Link>
                </td>
                <td className="px-4 py-3 text-foreground-muted">{magasinsParEntreprise.get(entreprise.id) ?? 0}</td>
                <td className="px-4 py-3 text-foreground-muted">{utilisateursParEntreprise.get(entreprise.id) ?? 0}</td>
                <td className="px-4 py-3">
                  <div>{PALIERS[entreprise.palier as PalierCode]?.nom ?? entreprise.palier}</div>
                  <div className="text-xs text-foreground-muted">
                    {entreprise.abonnement_expire_le ? `jusqu'au ${new Date(entreprise.abonnement_expire_le).toLocaleDateString('fr-FR')}` : 'non payé'}
                  </div>
                </td>
                <td className="px-4 py-3">{entreprise.devise}</td>
                <td className="px-4 py-3">
                  {entreprise.statut === 'suspendu' ? (
                    <span className="text-danger font-medium">Suspendue</span>
                  ) : (
                    <span className="text-success font-medium">Active</span>
                  )}
                </td>
                <td className="px-4 py-3 text-foreground-muted">
                  {entreprise.created_at ? new Date(entreprise.created_at).toLocaleDateString('fr-FR') : '-'}
                </td>
              </tr>
            ))}
            {(entreprises ?? []).length === 0 && (
              <tr><td colSpan={7} className="px-4 py-6 text-center text-foreground-muted">Aucune entreprise</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
