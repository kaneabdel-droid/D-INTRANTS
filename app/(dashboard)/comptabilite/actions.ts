'use server'

import { createClient } from '@/utils/supabase/server'
import { getCurrentUserContext } from '@/lib/auth/getCurrentUserContext'
import { revalidatePath } from 'next/cache'
import { DEMO_EXERCICE, DEMO_PLAN_COMPTABLE, DEMO_ECRITURES_INTRANTS } from '@/lib/comptabilite/demoData'

export type LigneEcritureInput = {
  compte: string
  libelle?: string
  debit: number
  credit: number
}

export async function getExercices() {
  const context = await getCurrentUserContext()
  const supabase = await createClient()

  let { data: exercices } = await supabase
    .from('exercices_comptables')
    .select('id, libelle, date_debut, date_fin, cloture')
    .eq('entreprise_id', context.entrepriseId)
    .order('date_debut', { ascending: false })

  // Si aucun exercice n'existe encore, on crée automatiquement l'exercice de l'année courante
  if (!exercices || exercices.length === 0) {
    const anneeCourante = new Date().getFullYear()
    const { data: nouvelExercice } = await supabase
      .from('exercices_comptables')
      .insert({
        entreprise_id: context.entrepriseId,
        libelle: `Exercice ${anneeCourante}`,
        date_debut: `${anneeCourante}-01-01`,
        date_fin: `${anneeCourante}-12-31`,
        cloture: false,
      })
      .select('id, libelle, date_debut, date_fin, cloture')
      .single()

    if (nouvelExercice) {
      exercices = [nouvelExercice]
    } else {
      exercices = [DEMO_EXERCICE]
    }
  }

  return { exercices: exercices || [DEMO_EXERCICE] }
}

export async function getEcritures(journal?: string, exerciceId?: string) {
  const context = await getCurrentUserContext()
  const supabase = await createClient()

  let query = supabase
    .from('ecritures_comptables')
    .select(`
      id,
      exercice_id,
      journal,
      date_ecriture,
      numero_piece,
      libelle,
      source_module,
      validee,
      created_at,
      lignes_ecritures_comptables (
        id,
        compte,
        libelle,
        debit,
        credit
      )
    `)
    .eq('entreprise_id', context.entrepriseId)
    .order('date_ecriture', { ascending: false })
    .order('created_at', { ascending: false })

  if (journal && journal !== 'tous') {
    query = query.eq('journal', journal)
  }

  if (exerciceId) {
    query = query.eq('exercice_id', exerciceId)
  }

  const { data, error } = await query

  if (!data || data.length === 0) {
    // Mode démo / données réelles préconfigurées
    let result = DEMO_ECRITURES_INTRANTS
    if (journal && journal !== 'tous') {
      result = result.filter((e) => e.journal === journal)
    }
    if (exerciceId) {
      result = result.filter((e) => e.exercice_id === exerciceId)
    }
    return { ecritures: result, error: null }
  }

  return { ecritures: data, error: (error as any)?.message || null }
}

export async function getPlanComptable() {
  const context = await getCurrentUserContext()
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('plan_comptable')
    .select('*')
    .or(`entreprise_id.is.null,entreprise_id.eq.${context.entrepriseId}`)
    .eq('actif', true)
    .order('compte', { ascending: true })

  if (!data || data.length === 0) {
    return { plan: DEMO_PLAN_COMPTABLE, error: null }
  }

  return { plan: data, error: (error as any)?.message || null }
}

export async function creerEcriture(formData: FormData) {
  const context = await getCurrentUserContext()
  const supabase = await createClient()

  const journal = (formData.get('journal') as string) || 'od'
  const date_ecriture = (formData.get('date_ecriture') as string) || new Date().toISOString().split('T')[0]
  const numero_piece = (formData.get('numero_piece') as string)?.trim() || null
  const libelle = (formData.get('libelle') as string)?.trim()
  const exercice_id = (formData.get('exercice_id') as string) || null
  const lignesRaw = formData.get('lignes') as string

  if (!libelle) return { error: 'Le libellé de l’opération est requis.' }
  if (!lignesRaw) return { error: 'Les lignes d’écriture sont requises.' }

  let lignes: LigneEcritureInput[] = []
  try {
    lignes = JSON.parse(lignesRaw)
  } catch {
    return { error: 'Format des lignes d’écriture invalide.' }
  }

  if (lignes.length < 2) {
    return { error: 'Une écriture comptable en partie double doit comporter au moins 2 lignes.' }
  }

  // Vérification de l'équilibre Débit = Crédit
  const totalDebit = lignes.reduce((s, l) => s + (Number(l.debit) || 0), 0)
  const totalCredit = lignes.reduce((s, l) => s + (Number(l.credit) || 0), 0)

  if (Math.abs(totalDebit - totalCredit) > 0.01) {
    return {
      error: `Déséquilibre : Total Débit (${totalDebit.toLocaleString('fr-FR')} FCFA) ≠ Total Crédit (${totalCredit.toLocaleString('fr-FR')} FCFA).`,
    }
  }

  // Insertion en-tête
  const { data: ecriture, error: ecritureError } = await supabase
    .from('ecritures_comptables')
    .insert({
      entreprise_id: context.entrepriseId,
      exercice_id: exercice_id || null,
      journal,
      date_ecriture,
      numero_piece,
      libelle,
      source_module: 'manuel',
      validee: true,
    })
    .select('id')
    .single()

  if (ecritureError || !ecriture) {
    return { error: ecritureError?.message || 'Erreur lors de la création de la pièce comptable.' }
  }

  // Insertion lignes
  const lignesToInsert = lignes.map((l) => ({
    ecriture_id: ecriture.id,
    entreprise_id: context.entrepriseId,
    compte: l.compte.trim(),
    libelle: (l.libelle || libelle).trim(),
    debit: Number(l.debit) || 0,
    credit: Number(l.credit) || 0,
  }))

  const { error: lignesError } = await supabase
    .from('lignes_ecritures_comptables')
    .insert(lignesToInsert)

  if (lignesError) {
    return { error: lignesError.message }
  }

  revalidatePath('/comptabilite')
  revalidatePath('/comptabilite/balance')
  revalidatePath('/comptabilite/grand-livre')
  revalidatePath('/comptabilite/etats-financiers')
  return { success: true, id: ecriture.id }
}

export async function ajouterComptePlan(formData: FormData) {
  const context = await getCurrentUserContext()
  const supabase = await createClient()

  const compte = (formData.get('compte') as string)?.trim()
  const libelle = (formData.get('libelle') as string)?.trim()
  const classe = parseInt((formData.get('classe') as string) || (compte ? compte.charAt(0) : '6'), 10)
  const type = (formData.get('type') as string) || 'charge'

  if (!compte || !libelle) {
    return { error: 'Numéro de compte et libellé obligatoires.' }
  }

  const { error } = await supabase.from('plan_comptable').insert({
    entreprise_id: context.entrepriseId,
    compte,
    libelle,
    classe: isNaN(classe) ? 6 : classe,
    type,
    actif: true,
  })

  if (error) return { error: error.message }

  revalidatePath('/comptabilite/plan-comptable')
  return { success: true }
}

export async function getBalance(exerciceId?: string) {
  const context = await getCurrentUserContext()
  const supabase = await createClient()

  let query = supabase
    .from('lignes_ecritures_comptables')
    .select(`
      compte,
      libelle,
      debit,
      credit,
      ecriture:ecritures_comptables!inner(exercice_id, validee)
    `)
    .eq('entreprise_id', context.entrepriseId)

  if (exerciceId) {
    query = query.eq('ecritures_comptables.exercice_id', exerciceId)
  }

  const [{ data: lignes, error }, { plan }] = await Promise.all([
    query,
    getPlanComptable(),
  ])

  let lignesEffectives: any[] = (lignes || []) as any[]
  if (lignesEffectives.length === 0) {
    let ecritures = DEMO_ECRITURES_INTRANTS
    if (exerciceId) {
      ecritures = ecritures.filter((e) => e.exercice_id === exerciceId)
    }
    lignesEffectives = ecritures.flatMap((e) =>
      e.lignes_ecritures_comptables.map((l) => ({
        compte: l.compte,
        libelle: l.libelle,
        debit: l.debit,
        credit: l.credit,
      }))
    )
  }

  const mapPlan = new Map((plan || []).map((p: any) => [p.compte, p.libelle]))

  // Agréger par compte
  const statsParCompte: Record<
    string,
    { compte: string; libelle: string; classe: number; debit: number; credit: number }
  > = {}

  for (const l of lignesEffectives as any[]) {
    const c = l.compte
    if (!statsParCompte[c]) {
      statsParCompte[c] = {
        compte: c,
        libelle: mapPlan.get(c) || l.libelle || `Compte ${c}`,
        classe: Number(c.charAt(0)) || 1,
        debit: 0,
        credit: 0,
      }
    }
    statsParCompte[c].debit += Number(l.debit) || 0
    statsParCompte[c].credit += Number(l.credit) || 0
  }

  const balance = Object.values(statsParCompte)
    .sort((a, b) => a.compte.localeCompare(b.compte))
    .map((item) => {
      const solde = item.debit - item.credit
      return {
        ...item,
        soldeDebiteur: solde > 0 ? solde : 0,
        soldeCrediteur: solde < 0 ? Math.abs(solde) : 0,
      }
    })

  const totaux = balance.reduce(
    (acc, b) => {
      acc.debit += b.debit
      acc.credit += b.credit
      acc.soldeDebiteur += b.soldeDebiteur
      acc.soldeCrediteur += b.soldeCrediteur
      return acc
    },
    { debit: 0, credit: 0, soldeDebiteur: 0, soldeCrediteur: 0 }
  )

  return { balance, totaux, error: null }
}

export async function getGrandLivre(compteSelectionne?: string, exerciceId?: string) {
  const context = await getCurrentUserContext()
  const supabase = await createClient()

  let query = supabase
    .from('lignes_ecritures_comptables')
    .select(`
      id,
      compte,
      libelle,
      debit,
      credit,
      created_at,
      ecriture:ecritures_comptables!inner(
        id,
        journal,
        date_ecriture,
        numero_piece,
        libelle,
        exercice_id
      )
    `)
    .eq('entreprise_id', context.entrepriseId)
    .order('created_at', { ascending: true })

  if (compteSelectionne && compteSelectionne !== 'tous') {
    query = query.eq('compte', compteSelectionne)
  }

  if (exerciceId) {
    query = query.eq('ecritures_comptables.exercice_id', exerciceId)
  }

  const { data: lignes, error } = await query

  let lignesEffectives = (lignes || []) as any[]
  if (lignesEffectives.length === 0) {
    let ecritures = DEMO_ECRITURES_INTRANTS
    if (exerciceId) {
      ecritures = ecritures.filter((e) => e.exercice_id === exerciceId)
    }
    const flattened: any[] = []
    for (const ec of ecritures) {
      for (const lg of ec.lignes_ecritures_comptables) {
        if (!compteSelectionne || compteSelectionne === 'tous' || lg.compte === compteSelectionne) {
          flattened.push({
            id: lg.id,
            compte: lg.compte,
            libelle: lg.libelle,
            debit: lg.debit,
            credit: lg.credit,
            created_at: ec.created_at,
            ecriture: {
              id: ec.id,
              journal: ec.journal,
              date_ecriture: ec.date_ecriture,
              numero_piece: ec.numero_piece,
              libelle: ec.libelle,
              exercice_id: ec.exercice_id,
            },
          })
        }
      }
    }
    lignesEffectives = flattened
  }

  return { lignes: lignesEffectives, error: null }
}

/**
 * Synchronisation automatique des écritures comptables :
 * Parcourt les ventes validées, achats et mouvements de trésorerie de l'entreprise
 * et génère automatiquement les écritures SYSCOHADA en partie double.
 */
export async function synchroniserOperationsComptables() {
  const context = await getCurrentUserContext()
  const supabase = await createClient()

  // 1. Récupérer ou créer l'exercice
  const { exercices } = await getExercices()
  const exerciceId = exercices[0]?.id || null

  // 2. Ventes validées non encore comptabilisées
  const { data: ventes } = await supabase
    .from('ventes')
    .select('id, numero, date_vente, montant_total, montant_paye, mode_paiement')
    .eq('statut', 'validee')
    .limit(100)

  // Vérifier les ventes déjà comptabilisées
  const { data: ecrituresVentes } = await supabase
    .from('ecritures_comptables')
    .select('source_id')
    .eq('entreprise_id', context.entrepriseId)
    .eq('source_module', 'ventes')

  const ventesComptabiliseesIds = new Set((ecrituresVentes || []).map((e) => e.source_id))
  let totalSynchronisees = 0

  for (const v of ventes || []) {
    if (ventesComptabiliseesIds.has(v.id)) continue
    const montant = Number(v.montant_total) || 0
    if (montant <= 0) continue

    const dateStr = v.date_vente ? new Date(v.date_vente).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
    const compteTresorerie = v.mode_paiement === 'credit' ? '411' : '531'

    const { data: ecriture } = await supabase
      .from('ecritures_comptables')
      .insert({
        entreprise_id: context.entrepriseId,
        exercice_id: exerciceId,
        journal: 'ventes',
        date_ecriture: dateStr,
        numero_piece: v.numero || `VTE-${v.id.substring(0, 8)}`,
        libelle: `Vente ${v.numero || ''} (${v.mode_paiement || 'comptant'})`,
        source_module: 'ventes',
        source_id: v.id,
        validee: true,
      })
      .select('id')
      .single()

    if (ecriture) {
      await supabase.from('lignes_ecritures_comptables').insert([
        {
          ecriture_id: ecriture.id,
          entreprise_id: context.entrepriseId,
          compte: compteTresorerie,
          libelle: `Vente ${v.numero || ''} - Encaissement / Client`,
          debit: montant,
          credit: 0,
        },
        {
          ecriture_id: ecriture.id,
          entreprise_id: context.entrepriseId,
          compte: '701',
          libelle: `Vente ${v.numero || ''} - Chiffre d'affaires produits`,
          debit: 0,
          credit: montant,
        },
      ])
      totalSynchronisees++
    }
  }

  // 3. Achats validés non encore comptabilisés
  const { data: achats } = await supabase
    .from('achats')
    .select('id, numero, date_achat, montant_total, statut')
    .limit(100)

  const { data: ecrituresAchats } = await supabase
    .from('ecritures_comptables')
    .select('source_id')
    .eq('entreprise_id', context.entrepriseId)
    .eq('source_module', 'achats')

  const achatsComptabilisesIds = new Set((ecrituresAchats || []).map((e) => e.source_id))

  for (const a of achats || []) {
    if (achatsComptabilisesIds.has(a.id)) continue
    const montant = Number(a.montant_total) || 0
    if (montant <= 0) continue

    const dateStr = a.date_achat ? new Date(a.date_achat).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]

    const { data: ecriture } = await supabase
      .from('ecritures_comptables')
      .insert({
        entreprise_id: context.entrepriseId,
        exercice_id: exerciceId,
        journal: 'achats',
        date_ecriture: dateStr,
        numero_piece: a.numero || `ACH-${a.id.substring(0, 8)}`,
        libelle: `Achat marchandises ${a.numero || ''}`,
        source_module: 'achats',
        source_id: a.id,
        validee: true,
      })
      .select('id')
      .single()

    if (ecriture) {
      await supabase.from('lignes_ecritures_comptables').insert([
        {
          ecriture_id: ecriture.id,
          entreprise_id: context.entrepriseId,
          compte: '601',
          libelle: `Achat marchandises ${a.numero || ''}`,
          debit: montant,
          credit: 0,
        },
        {
          ecriture_id: ecriture.id,
          entreprise_id: context.entrepriseId,
          compte: '401',
          libelle: `Fournisseur d'exploitation ${a.numero || ''}`,
          debit: 0,
          credit: montant,
        },
      ])
      totalSynchronisees++
    }
  }

  // 4. Charges enregistrées non encore comptabilisées
  const { data: charges } = await supabase
    .from('charges')
    .select('id, libelle, montant, date_charge, categorie')
    .limit(100)

  const { data: ecrituresCharges } = await supabase
    .from('ecritures_comptables')
    .select('source_id')
    .eq('entreprise_id', context.entrepriseId)
    .eq('source_module', 'charges')

  const chargesComptabiliseesIds = new Set((ecrituresCharges || []).map((e) => e.source_id))

  for (const ch of charges || []) {
    if (chargesComptabiliseesIds.has(ch.id)) continue
    const montant = Number(ch.montant) || 0
    if (montant <= 0) continue

    const dateStr = ch.date_charge || new Date().toISOString().split('T')[0]

    const { data: ecriture } = await supabase
      .from('ecritures_comptables')
      .insert({
        entreprise_id: context.entrepriseId,
        exercice_id: exerciceId,
        journal: 'caisse',
        date_ecriture: dateStr,
        numero_piece: `CHG-${ch.id.substring(0, 8)}`,
        libelle: ch.libelle || `Charge ${ch.categorie || ''}`,
        source_module: 'charges',
        source_id: ch.id,
        validee: true,
      })
      .select('id')
      .single()

    if (ecriture) {
      await supabase.from('lignes_ecritures_comptables').insert([
        {
          ecriture_id: ecriture.id,
          entreprise_id: context.entrepriseId,
          compte: '624',
          libelle: ch.libelle || `Dépense exploitation`,
          debit: montant,
          credit: 0,
        },
        {
          ecriture_id: ecriture.id,
          entreprise_id: context.entrepriseId,
          compte: '531',
          libelle: `Règlement caisse`,
          debit: 0,
          credit: montant,
        },
      ])
      totalSynchronisees++
    }
  }

  revalidatePath('/comptabilite')
  revalidatePath('/comptabilite/balance')
  revalidatePath('/comptabilite/grand-livre')
  revalidatePath('/comptabilite/etats-financiers')

  return { success: true, count: totalSynchronisees }
}

export type ImportEcriturePayload = {
  journal: string
  date_ecriture: string
  numero_piece?: string
  libelle: string
  lignes: Array<{ compte: string; libelle?: string; debit: number; credit: number }>
}

export async function importerEcrituresBatch(ecritures: ImportEcriturePayload[]): Promise<{ success: boolean; count: number; error: string | null }> {
  const context = await getCurrentUserContext()
  const supabase = await createClient()

  const { exercices } = await getExercices()
  const exerciceId = exercices[0]?.id || null

  let countImportees = 0

  for (const ec of ecritures) {
    const journal = ec.journal || 'od'
    const dateEcriture = ec.date_ecriture || new Date().toISOString().split('T')[0]
    const numeroPiece = (ec.numero_piece || '').trim() || null
    const libelle = (ec.libelle || '').trim() || 'Écriture importée'

    const totalD = (ec.lignes || []).reduce((s, l) => s + (Number(l.debit) || 0), 0)
    const totalC = (ec.lignes || []).reduce((s, l) => s + (Number(l.credit) || 0), 0)

    if (Math.abs(totalD - totalC) > 0.01) continue

    const { data: ecriture, error: errEcriture } = await supabase
      .from('ecritures_comptables')
      .insert({
        entreprise_id: context.entrepriseId,
        exercice_id: exerciceId,
        journal,
        date_ecriture: dateEcriture,
        numero_piece: numeroPiece,
        libelle,
        source_module: 'import',
        validee: true,
      })
      .select('id')
      .single()

    if (errEcriture || !ecriture) continue

    const lignesToInsert = ec.lignes.map((l) => ({
      ecriture_id: ecriture.id,
      entreprise_id: context.entrepriseId,
      compte: l.compte.trim(),
      libelle: (l.libelle || libelle).trim(),
      debit: Number(l.debit) || 0,
      credit: Number(l.credit) || 0,
    }))

    const { error: errLignes } = await supabase
      .from('lignes_ecritures_comptables')
      .insert(lignesToInsert)

    if (!errLignes) {
      countImportees++
    }
  }

  revalidatePath('/comptabilite')
  revalidatePath('/comptabilite/balance')
  revalidatePath('/comptabilite/grand-livre')
  revalidatePath('/comptabilite/etats-financiers')

  return { success: true, count: countImportees, error: null }
}
