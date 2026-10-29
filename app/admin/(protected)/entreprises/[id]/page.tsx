import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { createAdminClient } from '@/utils/supabase/admin'
import EntrepriseActions from './EntrepriseActions'
import AjouterMagasinButton from './AjouterMagasinButton'
import MagasinRow from './MagasinRow'
import AjouterUtilisateurButton from './AjouterUtilisateurButton'
import UtilisateurRow from './UtilisateurRow'
import SupprimerEntrepriseButton from './SupprimerEntrepriseButton'
import ConfirmerPaiementButton from '../../paiements/ConfirmerPaiementButton'
import { PALIERS, type PalierCode } from '@/lib/abonnements/paliers'
import { libelleMoyenPaiement } from '@/lib/abonnements/types'

export default async function AdminEntrepriseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createAdminClient()

  const { data: entreprise } = await supabase
    .from('entreprises')
    .select('id, nom, adresse, telephone, email, identification, logo_url, devise, statut, palier, abonnement_expire_le, created_at')
    .eq('id', id)
    .maybeSingle()

  if (!entreprise) notFound()

  const palierInfo = PALIERS[entreprise.palier as PalierCode]

  const { data: magasins } = await supabase
    .from('magasins')
    .select('id, nom, adresse, statut')
    .eq('entreprise_id', id)
    .order('nom')

  const { data: utilisateurs } = await supabase
    .from('utilisateurs')
    .select('id, role, nom, prenom, magasin_id')
    .eq('entreprise_id', id)

  const { data: abonnements } = await supabase
    .from('abonnements')
    .select('id, palier, duree_mois, montant_fcfa, provider, metadata, statut, created_at, paye_at, periode_fin')
    .eq('entreprise_id', id)
    .order('created_at', { ascending: false })
    .limit(20)

  // Les emails (et le statut désactivé) vivent dans auth.users, pas dans public.utilisateurs.
  const { data: authUsers } = await supabase.auth.admin.listUsers({ perPage: 1000 })
  const authParId = new Map(authUsers?.users.map((u) => [u.id, u]) ?? [])
  const magasinParId = new Map((magasins ?? []).map((m) => [m.id, m.nom]))

  const magasinsActifs = (magasins ?? []).filter((m) => m.statut === 'actif').map((m) => ({ id: m.id, nom: m.nom }))

  return (
    <div>
      <Link href="/admin/entreprises" className="text-foreground-muted hover:text-primary flex items-center gap-2 w-fit mb-6 text-sm">
        <ArrowLeft className="w-4 h-4" /> Retour aux entreprises
      </Link>

      <h1 className="text-2xl font-bold font-heading mb-6 break-words">{entreprise.nom}</h1>

      <div className="grid md:grid-cols-3 gap-6 mb-8">
        <div className="bg-background rounded-xl p-5 border border-surface-border">
          <h2 className="font-semibold mb-4">Détails</h2>
          <dl className="text-sm space-y-2">
            <div className="flex justify-between"><dt className="text-foreground-muted">Devise</dt><dd className="font-medium">{entreprise.devise}</dd></div>
            <div className="flex justify-between"><dt className="text-foreground-muted">Adresse</dt><dd className="text-right">{entreprise.adresse || '-'}</dd></div>
            <div className="flex justify-between"><dt className="text-foreground-muted">Email</dt><dd className="text-right">{entreprise.email || '-'}</dd></div>
            <div className="flex justify-between"><dt className="text-foreground-muted">Id. Fiscal</dt><dd className="text-right">{entreprise.identification || '-'}</dd></div>
            <div className="flex justify-between"><dt className="text-foreground-muted">Téléphone</dt><dd>{entreprise.telephone || '-'}</dd></div>
            <div className="flex justify-between"><dt className="text-foreground-muted">Palier</dt><dd className="font-medium">{palierInfo?.nom ?? entreprise.palier} ({palierInfo?.magasinsMax} magasin{palierInfo && palierInfo.magasinsMax > 1 ? 's' : ''} max)</dd></div>
            <div className="flex justify-between"><dt className="text-foreground-muted">Abonnement</dt><dd>{entreprise.abonnement_expire_le ? `jusqu'au ${new Date(entreprise.abonnement_expire_le).toLocaleDateString('fr-FR')}` : 'non payé'}</dd></div>
            <div className="flex justify-between"><dt className="text-foreground-muted">Créée le</dt><dd>{entreprise.created_at ? new Date(entreprise.created_at).toLocaleDateString('fr-FR') : '-'}</dd></div>
          </dl>
        </div>

        <div className="bg-background rounded-xl p-5 border border-surface-border">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <h2 className="font-semibold">Magasins ({(magasins ?? []).filter((m) => m.statut === 'actif').length}/{palierInfo?.magasinsMax ?? '-'})</h2>
            <AjouterMagasinButton entrepriseId={entreprise.id} />
          </div>
          <ul className="text-sm divide-y divide-surface-border">
            {(magasins ?? []).map((m) => (
              <MagasinRow key={m.id} entrepriseId={entreprise.id} magasinId={m.id} nom={m.nom} adresse={m.adresse} statut={m.statut} />
            ))}
            {(magasins ?? []).length === 0 && <li className="text-foreground-muted py-2">Aucun magasin</li>}
          </ul>
        </div>

        <div className="bg-background rounded-xl p-5 border border-surface-border">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <h2 className="font-semibold">Utilisateurs</h2>
            <AjouterUtilisateurButton entrepriseId={entreprise.id} magasins={magasinsActifs} />
          </div>
          <ul className="text-sm divide-y divide-surface-border">
            {(utilisateurs ?? []).map((u) => {
              const authUser = authParId.get(u.id)
              return (
                <UtilisateurRow
                  key={u.id}
                  entrepriseId={entreprise.id}
                  utilisateurId={u.id}
                  email={authUser?.email || u.id}
                  nomComplet={[u.prenom, u.nom].filter(Boolean).join(' ')}
                  role={u.role}
                  magasinId={u.magasin_id}
                  magasins={magasinsActifs}
                  magasinNom={u.magasin_id ? magasinParId.get(u.magasin_id) ?? null : null}
                  banni={Boolean(authUser?.banned_until && new Date(authUser.banned_until) > new Date())}
                />
              )
            })}
            {(utilisateurs ?? []).length === 0 && <li className="text-foreground-muted py-2">Aucun utilisateur</li>}
          </ul>
        </div>
      </div>

      <EntrepriseActions entrepriseId={entreprise.id} statut={entreprise.statut} palierActuel={entreprise.palier} />

      <div className="bg-background rounded-xl p-5 border border-surface-border mb-6">
        <h2 className="font-semibold mb-4">Paiements d&apos;abonnement</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface text-foreground-muted text-left">
              <tr>
                <th className="px-3 py-2 font-medium">Date</th>
                <th className="px-3 py-2 font-medium">Palier</th>
                <th className="px-3 py-2 font-medium">Durée</th>
                <th className="px-3 py-2 font-medium">Montant</th>
                <th className="px-3 py-2 font-medium">Moyen</th>
                <th className="px-3 py-2 font-medium">Statut</th>
                <th className="px-3 py-2 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border">
              {(abonnements ?? []).map((a) => (
                <tr key={a.id}>
                  <td className="px-3 py-2 text-foreground-muted">
                    {(a.paye_at ?? a.created_at) ? new Date(a.paye_at ?? a.created_at).toLocaleDateString('fr-FR') : '-'}
                  </td>
                  <td className="px-3 py-2">{PALIERS[a.palier as PalierCode]?.nom ?? a.palier}</td>
                  <td className="px-3 py-2">{a.duree_mois} mois</td>
                  <td className="px-3 py-2">{Number(a.montant_fcfa).toLocaleString('fr-FR')} FCFA</td>
                  <td className="px-3 py-2">{libelleMoyenPaiement(a.provider, a.metadata as Record<string, unknown> | null)}</td>
                  <td className="px-3 py-2">
                    <span className={a.statut === 'paye' ? 'text-success font-medium' : a.statut === 'echoue' ? 'text-danger' : 'text-primary'}>
                      {a.statut}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right">
                    {a.statut !== 'paye' && (
                      <ConfirmerPaiementButton
                        abonnementId={a.id}
                        moyenParDefaut={((a.metadata as Record<string, unknown> | null)?.moyenPaiementReel as string) || a.provider}
                      />
                    )}
                  </td>
                </tr>
              ))}
              {(abonnements ?? []).length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-4 text-center text-foreground-muted">
                    Aucun paiement enregistré
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <SupprimerEntrepriseButton entrepriseId={entreprise.id} nomEntreprise={entreprise.nom} />
    </div>
  )
}
