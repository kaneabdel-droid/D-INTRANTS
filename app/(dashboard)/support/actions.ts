'use server'

import { createClient } from '@/utils/supabase/server'
import { getDictionary } from '@/dictionaries'
import { getCurrentUserContext } from '@/lib/auth/getCurrentUserContext'
import { transfererAuSupport, SUJET_MAX, MESSAGE_MAX } from '@/lib/support/transferer'

const PRODUIT = 'D-INTRANTS'

export async function envoyerMessageSupport(formData: FormData) {
  const errors = (await getDictionary()).supportPage.errors

  const sujet = String(formData.get('sujet') || '').trim()
  const message = String(formData.get('message') || '').trim()

  if (!sujet || !message) return { error: errors.required }
  if (sujet.length > SUJET_MAX || message.length > MESSAGE_MAX) return { error: errors.tooLong }

  const context = await getCurrentUserContext()
  if (!context.email) return { error: errors.notAuthenticated }

  const emailEnvoye = await transfererAuSupport({
    produit: PRODUIT,
    email: context.email,
    organisation: context.magasinNom ? `${context.entrepriseNom} (${context.magasinNom})` : context.entrepriseNom,
    sujet,
    message,
  })

  const supabase = await createClient()
  const { error: insertError } = await supabase.from('support_messages').insert({
    entreprise_id: context.entrepriseId,
    user_id: context.userId,
    email: context.email,
    sujet,
    message,
    email_envoye: emailEnvoye,
  })
  if (insertError) console.error('Enregistrement message support échoué', insertError)

  // Échec seulement si la demande n'a été ni transmise ni enregistrée.
  if (!emailEnvoye && insertError) return { error: errors.failed }

  return { success: true }
}
