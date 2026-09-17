import Link from 'next/link'
import { createAdminClient } from '@/utils/supabase/admin'
import { PALIERS, type PalierCode } from '@/lib/abonnements/paliers'
import RattacherDemandeForm from './RattacherDemandeForm'

type Metadata = { nomEntreprise?: string; contactNom?: string; contactEmail?: string; contactTelephone?: string }

export default async function AdminDemandesPage() {
  const supabase = createAdminClient()

  const { data: demandesEnAttente } = await supabase
    .from('abonnements')
    .select('id, palier, duree_mois, montant_fcfa, provider, metadata, paye_at, created_at')
    .is('entreprise_id', null)
    .eq('statut', 'paye')
    .order('paye_at', { ascending: false })

  const { data: demandesTraitees } = await supabase
    .from('abonnements')
    .select('id, palier, duree_mois, montant_fcfa, metadata, paye_at, entreprise_id, entreprises(nom)')
    .not('entreprise_id', 'is', null)
    .eq('statut', 'paye')
    .contains('metadata', { demandePublique: true })
    .order('paye_at', { ascending: false })
    .limit(50)

  const { data: entreprises } = await supabase.from('entreprises').select('id, nom').order('created_at', { ascending: false })

  return (
    <div>
      <h1 className="text-2xl font-bold font-heading mb-2">Demandes d&apos;inscription</h1>
      <p className="text-sm text-foreground-muted mb-6">
        Paiements effectués depuis la page publique <code className="font-mono text-xs">/tarifs</code>, avant création du compte entreprise.
        Créez l&apos;entreprise (et son admin) via <Link href="/admin/entreprises" className="text-primary hover:text-primary-hover">Entreprises</Link>, puis rattachez-la ici.
      </p>

      <h2 className="font-semibold mb-3">En attente ({demandesEnAttente?.length ?? 0})</h2>
      <div className="bg-background rounded-xl border border-surface-border overflow-hidden overflow-x-auto mb-8">
        <table className="w-full text-sm">
          <thead className="bg-surface text-foreground-muted text-left">
            <tr>
              <th className="px-4 py-3 font-medium">Payé le</th>
              <th className="px-4 py-3 font-medium">Entreprise demandée</th>
              <th className="px-4 py-3 font-medium">Contact</th>
              <th className="px-4 py-3 font-medium">Palier</th>
              <th className="px-4 py-3 font-medium">Montant</th>
              <th className="px-4 py-3 font-medium">Rattacher</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-border">
            {(demandesEnAttente ?? []).map((d) => {
              const meta = (d.metadata ?? {}) as Metadata
              return (
                <tr key={d.id}>
                  <td className="px-4 py-3 text-foreground-muted">{d.paye_at ? new Date(d.paye_at).toLocaleString('fr-FR') : '-'}</td>
                  <td className="px-4 py-3 font-medium">{meta.nomEntreprise ?? '-'}</td>
                  <td className="px-4 py-3 text-foreground-muted">
                    <div>{meta.contactNom}</div>
                    <div className="text-xs">{meta.contactEmail} · {meta.contactTelephone}</div>
                  </td>
                  <td className="px-4 py-3">
                    {PALIERS[d.palier as PalierCode]?.nom ?? d.palier} · {d.duree_mois} mois
                  </td>
                  <td className="px-4 py-3">{Number(d.montant_fcfa).toLocaleString('fr-FR')} FCFA</td>
                  <td className="px-4 py-3">
                    <RattacherDemandeForm abonnementId={d.id} entreprises={entreprises ?? []} />
                  </td>
                </tr>
              )
            })}
            {(demandesEnAttente ?? []).length === 0 && (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-foreground-muted">Aucune demande en attente</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <h2 className="font-semibold mb-3">Traitées récemment</h2>
      <div className="bg-background rounded-xl border border-surface-border overflow-hidden overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-surface text-foreground-muted text-left">
            <tr>
              <th className="px-4 py-3 font-medium">Payé le</th>
              <th className="px-4 py-3 font-medium">Entreprise</th>
              <th className="px-4 py-3 font-medium">Palier</th>
              <th className="px-4 py-3 font-medium">Montant</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-border">
            {(demandesTraitees ?? []).map((d) => {
              const entreprise = Array.isArray(d.entreprises) ? d.entreprises[0] : d.entreprises
              return (
                <tr key={d.id}>
                  <td className="px-4 py-3 text-foreground-muted">{d.paye_at ? new Date(d.paye_at).toLocaleString('fr-FR') : '-'}</td>
                  <td className="px-4 py-3">
                    <Link href={`/admin/entreprises/${d.entreprise_id}`} className="text-primary hover:text-primary-hover">
                      {entreprise?.nom ?? d.entreprise_id}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{PALIERS[d.palier as PalierCode]?.nom ?? d.palier} · {d.duree_mois} mois</td>
                  <td className="px-4 py-3">{Number(d.montant_fcfa).toLocaleString('fr-FR')} FCFA</td>
                </tr>
              )
            })}
            {(demandesTraitees ?? []).length === 0 && (
              <tr><td colSpan={4} className="px-4 py-6 text-center text-foreground-muted">Aucune demande traitée</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
