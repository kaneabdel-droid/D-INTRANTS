import { createClient } from '@/utils/supabase/server'
import { getCurrentUserContext } from '@/lib/auth/getCurrentUserContext'
import { PageHeader } from '@/components/ui/card'
import { genererEtatsFinanciersSyscohada, type ExerciceComptable, type LigneBalance } from '@/lib/syscohada'
import { getExercices } from '../actions'
import EtatsFinanciersClient from './EtatsFinanciersClient'

export default async function EtatsFinanciersSyscohadaPage({
  searchParams,
}: {
  searchParams: Promise<{ exercice?: string }>
}) {
  const context = await getCurrentUserContext()
  const { exercice } = await searchParams
  const supabase = await createClient()

  const { exercices: exercicesRaw } = await getExercices()
  const exercices = (exercicesRaw ?? []) as ExerciceComptable[]
  const courant = exercices.find((e) => e.id === exercice) ?? exercices[0]

  if (!courant) {
    return (
      <div className="p-8 text-center text-foreground-muted">
        Aucun exercice comptable enregistré.
      </div>
    )
  }

  // Charger toutes les lignes de la balance générale pour l'exercice
  const { data: balanceData } = await supabase
    .from('v_balance')
    .select('exercice_id, numero, libelle, classe, total_debit, total_credit, solde')
    .eq('entreprise_id', context.entrepriseId)
    .order('numero')

  let toutesLignes: LigneBalance[] = (balanceData ?? []).map((l: any) => ({
    exercice_id: l.exercice_id || courant.id,
    numero: l.numero,
    libelle: l.libelle,
    classe: Number(l.classe) || Number(l.numero?.charAt(0)) || 1,
    total_debit: Number(l.total_debit) || 0,
    total_credit: Number(l.total_credit) || 0,
    solde: Number(l.solde) || 0,
  }))

  if (toutesLignes.length === 0) {
    const { getBalance } = await import('../actions')
    const { balance } = await getBalance(courant.id)
    toutesLignes = (balance ?? []).map((b: any) => ({
      exercice_id: courant.id,
      numero: b.compte,
      libelle: b.libelle,
      classe: b.classe,
      total_debit: b.debit,
      total_credit: b.credit,
      solde: b.debit - b.credit,
    }))
  }

  const etats = genererEtatsFinanciersSyscohada(toutesLignes, courant, exercices)

  return (
    <>
      <PageHeader
        titre="États financiers SYSCOHADA (Système Normal)"
        description={`Bilan Actif/Passif, Compte de Résultat et TFT conformes aux normes OHADA pour l’exercice ${courant.libelle}.`}
      >
        <form className="flex items-center gap-2" method="get">
          <select
            name="exercice"
            defaultValue={courant.id}
            aria-label="Exercice"
            className="rounded-xl bg-background border border-surface-border px-3 py-1.5 text-xs text-foreground font-medium"
          >
            {exercices.map((e) => (
              <option key={e.id} value={e.id}>
                {e.libelle}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="rounded-xl bg-primary text-white text-xs px-3.5 py-1.5 font-semibold hover:bg-primary/90"
          >
            Afficher
          </button>
        </form>
      </PageHeader>

      <EtatsFinanciersClient
        etats={etats}
        devise={context.entrepriseDevise || 'FCFA'}
        lang="fr"
        organisationNom={context.entrepriseNom}
      />
    </>
  )
}
