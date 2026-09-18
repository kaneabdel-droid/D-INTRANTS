import { createClient } from '@/utils/supabase/server'
import { requireGerant } from '@/lib/auth/getCurrentUserContext'
import { Wallet, Landmark, Smartphone } from 'lucide-react'
import { getDictionary, getLocale } from '@/dictionaries'
import CreateCompteButton from './CreateCompteButton'
import AddEcritureButton from './AddEcritureButton'
import EcritureRowActions from './EcritureRowActions'
import Link from 'next/link'
import PrintJournalButton from '@/components/PrintJournalButton'

const iconParType: Record<string, typeof Wallet> = {
  caisse: Wallet,
  banque: Landmark,
  mobile_money: Smartphone,
}

export default async function TresoreriePage({ searchParams }: { searchParams: Promise<{ compte_id?: string }> }) {
  const { compte_id } = await searchParams
  const context = await requireGerant()
  const supabase = await createClient()
  const dict = await getDictionary(await getLocale())
  const t = dict.tresorerie
  const c = dict.common

  const { data: entreprise } = await supabase
    .from('entreprises')
    .select('nom, adresse, telephone, identification, logo_url, devise')
    .eq('id', context.entrepriseId)
    .single()

  const { data: comptes } = await supabase
    .from('comptes_tresorerie')
    .select('id, nom, type_compte, solde_initial')
    .eq('magasin_id', context.magasinId)
    .order('nom')

  const { data: allMouvements } = await supabase
    .from('journal_tresorerie')
    .select('compte_tresorerie_id, type_mouvement, montant')
    .eq('magasin_id', context.magasinId)
    .limit(1000000)

  let mouvementsQuery = supabase
    .from('journal_tresorerie')
    .select('id, compte_tresorerie_id, type_mouvement, montant, categorie, motif, date_mouvement, reference_type, reference_id')
    .eq('magasin_id', context.magasinId)
    .order('date_mouvement', { ascending: false })
    .limit(50)

  if (compte_id) {
    mouvementsQuery = mouvementsQuery.eq('compte_tresorerie_id', compte_id)
  }

  const { data: mouvements } = await mouvementsQuery

  const soldeParCompte = new Map<string, number>()
  for (const c of comptes ?? []) soldeParCompte.set(c.id, 0)
  for (const m of allMouvements ?? []) {
    const courant = soldeParCompte.get(m.compte_tresorerie_id) ?? 0
    soldeParCompte.set(m.compte_tresorerie_id, courant + (m.type_mouvement === 'entree' ? Number(m.montant) : -Number(m.montant)))
  }
  const compteParId = new Map((comptes ?? []).map((c) => [c.id, c]))

  const achatIds = (mouvements ?? []).filter(m => m.reference_type === 'achat').map(m => m.reference_id).filter(Boolean) as string[]
  const venteIds = (mouvements ?? []).filter(m => m.reference_type === 'vente').map(m => m.reference_id).filter(Boolean) as string[]
  const creanceIds = (mouvements ?? []).filter(m => m.reference_type === 'creance').map(m => m.reference_id).filter(Boolean) as string[]
  const detteIds = (mouvements ?? []).filter(m => m.reference_type === 'dette').map(m => m.reference_id).filter(Boolean) as string[]

  const [achatsRes, ventesRes, creancesRes, dettesRes] = await Promise.all([
    achatIds.length > 0 ? supabase.from('achats').select('id, fournisseurs(nom)').in('id', achatIds) : Promise.resolve({ data: [] }),
    venteIds.length > 0 ? supabase.from('ventes').select('id, clients(nom)').in('id', venteIds) : Promise.resolve({ data: [] }),
    creanceIds.length > 0 ? supabase.from('creances').select('id, clients(nom)').in('id', creanceIds) : Promise.resolve({ data: [] }),
    detteIds.length > 0 ? supabase.from('dettes').select('id, fournisseurs(nom)').in('id', detteIds) : Promise.resolve({ data: [] }),
  ])

  const tiersMap = new Map<string, string>()
  achatsRes.data?.forEach(a => tiersMap.set(a.id, (a.fournisseurs as any)?.nom))
  ventesRes.data?.forEach(v => tiersMap.set(v.id, (v.clients as any)?.nom))
  creancesRes.data?.forEach(c => tiersMap.set(c.id, (c.clients as any)?.nom))
  dettesRes.data?.forEach(d => tiersMap.set(d.id, (d.fournisseurs as any)?.nom))

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
              journalType="tresorerie"
              magasinId={context.magasinId}
              entreprise={entreprise}
              compteId={compte_id}
            />
          )}
          <CreateCompteButton dict={dict} />
          <AddEcritureButton comptes={comptes ?? []} dict={dict} />
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* Carte "Tous les comptes" */}
        <Link
          href="/tresorerie"
          className={`block overflow-hidden rounded-xl bg-surface p-6 shadow-sm border transition-all ${!compte_id ? 'border-primary ring-1 ring-primary shadow-md bg-primary/5' : 'border-surface-border hover:border-primary/50'}`}
        >
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-primary/10 p-2.5 shrink-0">
              <Wallet className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground-muted truncate">Tous les comptes</p>
              <p className="text-xs text-foreground-muted capitalize">Solde global</p>
            </div>
          </div>
          <p className="mt-4 text-2xl font-bold text-foreground">
            {!compte_id ? Math.round(Array.from(soldeParCompte.values()).reduce((acc, val) => acc + val, 0)).toLocaleString('fr-FR') : '***'}
          </p>
        </Link>

        {(comptes ?? []).map((compte) => {
          const Icon = iconParType[compte.type_compte] ?? Wallet
          const isActive = compte_id === compte.id
          const shouldShowBalance = !compte_id || isActive
          return (
            <Link 
              href={isActive ? '/tresorerie' : `/tresorerie?compte_id=${compte.id}`} 
              key={compte.id} 
              className={`block overflow-hidden rounded-xl bg-surface p-6 shadow-sm border transition-all ${isActive ? 'border-primary ring-1 ring-primary shadow-md bg-primary/5' : 'border-surface-border hover:border-primary/50'}`}
            >
              <div className="flex items-start gap-3">
                <div className="rounded-lg bg-primary/10 p-2.5 shrink-0">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground-muted truncate">{compte.nom}</p>
                  <p className="text-xs text-foreground-muted capitalize">{compte.type_compte.replace('_', ' ')}</p>
                </div>
              </div>
              <p className="mt-4 text-2xl font-bold text-foreground">
                {shouldShowBalance ? Math.round(soldeParCompte.get(compte.id) ?? 0).toLocaleString('fr-FR') : '***'}
              </p>
            </Link>
          )
        })}
        {(comptes ?? []).length === 0 && (
          <p className="text-sm text-foreground-muted col-span-full">{t.emptyComptes}</p>
        )}
      </div>

      <h3 className="mt-10 mb-4 text-lg font-semibold text-foreground">{t.journal}</h3>
      <div className="overflow-hidden overflow-x-auto shadow ring-1 ring-surface-border rounded-lg bg-surface">
        <table className="min-w-full divide-y divide-surface-border">
          <thead className="bg-background/50">
            <tr>
              <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-foreground sm:pl-6">{t.colDate}</th>
              <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-foreground">{t.colCompte}</th>
              <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-foreground">Tiers</th>
              <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-foreground">{t.colCategorie}</th>
              <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-foreground">{t.colMotif}</th>
              <th scope="col" className="px-3 py-3.5 text-right text-sm font-semibold text-foreground">{t.colMontant}</th>
              <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6">
                <span className="sr-only">{c.actions}</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-border bg-surface">
            {(mouvements ?? []).map((m) => (
              <tr key={m.id}>
                <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm text-foreground-muted sm:pl-6">
                  {m.date_mouvement ? new Date(m.date_mouvement).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '-'}
                </td>
                <td className="px-3 py-4 text-sm text-foreground">{compteParId.get(m.compte_tresorerie_id)?.nom ?? '-'}</td>
                <td className="px-3 py-4 text-sm text-foreground">{m.reference_id ? (tiersMap.get(m.reference_id) ?? '-') : '-'}</td>
                <td className="px-3 py-4 text-sm text-foreground-muted capitalize">{(m.categorie ?? '-').replace('_', ' ')}</td>
                <td className="px-3 py-4 text-sm text-foreground-muted">{m.motif || '-'}</td>
                <td className={`px-3 py-4 text-sm text-right font-medium ${m.type_mouvement === 'entree' ? 'text-success' : 'text-danger'}`}>
                  {m.type_mouvement === 'entree' ? '+' : '-'}{Number(m.montant).toLocaleString('fr-FR')}
                </td>
                <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                  {m.reference_type ? (
                    <span className="text-xs text-foreground-muted capitalize">{m.reference_type.replace('_', ' ')}</span>
                  ) : (
                    <EcritureRowActions ecriture={m} comptes={comptes ?? []} dict={dict} />
                  )}
                </td>
              </tr>
            ))}
            {(mouvements ?? []).length === 0 && (
              <tr>
                <td colSpan={7} className="py-8 text-center text-sm text-foreground-muted">{t.emptyMouvements}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
