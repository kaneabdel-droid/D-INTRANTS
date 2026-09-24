'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/utils/supabase/server'
import { requireGerantOuTresorier } from '@/lib/auth/getCurrentUserContext'

type ActionResult = { success?: true; error?: string }

export async function addCharge(formData: FormData): Promise<ActionResult> {
  const context = await requireGerantOuTresorier('/charges', 'ecrire')
  const supabase = await createClient()

  const categorie = formData.get('categorie') as string
  const libelle = (formData.get('libelle') as string)?.trim() || null
  const montant = parseFloat(formData.get('montant') as string) || 0
  const dateCharge = formData.get('date_charge') as string
  const recurrente = formData.get('recurrente') === 'on'
  const compteTresorerieId = (formData.get('compte_tresorerie_id') as string) || null

  if (montant <= 0) return { error: 'Le montant doit être positif' }
  if (!dateCharge) return { error: 'La date est requise' }

  const { data: charge, error } = await supabase
    .from('charges')
    .insert({
      magasin_id: context.magasinId,
      compte_tresorerie_id: compteTresorerieId,
      categorie,
      libelle,
      montant,
      date_charge: dateCharge,
      recurrente,
      utilisateur_id: context.userId,
    })
    .select('id')
    .single()
  if (error) return { error: error.message }

  // Une charge payée depuis un compte de trésorerie en sort immédiatement —
  // sans compte sélectionné, elle reste enregistrée pour le calcul de
  // rentabilité mais n'impacte aucun solde de trésorerie. `reference_id`
  // rattache l'écriture à cette charge pour que updateCharge/deleteCharge
  // puissent la retrouver et la corriger plutôt que de laisser une écriture
  // orpheline désynchronisée du montant/compte réel de la charge.
  if (compteTresorerieId) {
    const { error: ecritureError } = await supabase.from('journal_tresorerie').insert({
      magasin_id: context.magasinId,
      compte_tresorerie_id: compteTresorerieId,
      type_mouvement: 'sortie',
      montant,
      categorie: 'charge',
      reference_id: charge.id,
      reference_type: 'charge',
      motif: libelle,
      utilisateur_id: context.userId,
    })
    if (ecritureError) {
      // Compte insuffisant (trigger solde plancher) : annule la charge plutôt
      // que de la laisser enregistrée sans le paiement qu'elle prétend avoir eu.
      await supabase.from('charges').delete().eq('id', charge.id)
      return { error: ecritureError.message }
    }
  }

  revalidatePath('/charges')
  revalidatePath('/tresorerie')
  return { success: true }
}

export async function updateCharge(
  id: string,
  categorie: string,
  libelle: string,
  montant: number,
  dateCharge: string,
  recurrente: boolean,
  compteTresorerieId: string | null
): Promise<ActionResult> {
  const context = await requireGerantOuTresorier('/charges', 'modifier')
  const supabase = await createClient()

  if (montant <= 0) return { error: 'Le montant doit être positif' }
  if (!dateCharge) return { error: 'La date est requise' }

  const { error } = await supabase
    .from('charges')
    .update({ categorie, libelle: libelle || null, montant, date_charge: dateCharge, recurrente, compte_tresorerie_id: compteTresorerieId })
    .eq('id', id)
  if (error) return { error: error.message }

  // Toujours retirer puis (le cas échéant) recréer l'écriture de trésorerie
  // liée plutôt que de tenter un ajustement partiel : plus simple à garder
  // correct, et le nouveau montant/compte repasse par le trigger de solde
  // plancher comme n'importe quelle autre écriture.
  await supabase.from('journal_tresorerie').delete().eq('reference_id', id).eq('reference_type', 'charge')

  if (compteTresorerieId) {
    const { error: ecritureError } = await supabase.from('journal_tresorerie').insert({
      magasin_id: context.magasinId,
      compte_tresorerie_id: compteTresorerieId,
      type_mouvement: 'sortie',
      montant,
      categorie: 'charge',
      reference_id: id,
      reference_type: 'charge',
      motif: libelle || null,
      utilisateur_id: context.userId,
    })
    if (ecritureError) return { error: ecritureError.message }
  }

  revalidatePath('/charges')
  revalidatePath('/tresorerie')
  return { success: true }
}

export async function deleteCharge(id: string): Promise<ActionResult> {
  await requireGerantOuTresorier('/charges', 'modifier')
  const supabase = await createClient()

  // Retirer l'écriture de trésorerie liée avant la charge elle-même, sinon un
  // décaissement resterait dans le journal alors que la charge qui l'a motivé
  // n'existe plus (solde faussé en permanence, cf. demande de l'utilisateur).
  await supabase.from('journal_tresorerie').delete().eq('reference_id', id).eq('reference_type', 'charge')

  const { error } = await supabase.from('charges').delete().eq('id', id)
  if (error) return { error: error.message }

  revalidatePath('/charges')
  revalidatePath('/tresorerie')
  return { success: true }
}
