'use server'

import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'

// Passe par /auth/callback pour échanger le code Supabase contre une session
// avant d'atterrir sur /update-password — sans ça, la page reçoit un visiteur
// déconnecté et ne peut pas mettre à jour le mot de passe.
export async function resetPasswordForEmail(formData: FormData) {
  const supabase = await createClient()
  const email = formData.get('email') as string
  const isAdmin = formData.get('admin') === '1'
  const adminQuery = isAdmin ? '?admin=1' : ''

  // Le flag `admin` est propagé dans `next` (transparent pour /auth/callback, qui
  // ne fait que rediriger vers `next` tel quel) pour que /update-password sache
  // renvoyer vers /admin/login plutôt que /login une fois le mot de passe changé.
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
  const next = encodeURIComponent(`/update-password${adminQuery}`)
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${siteUrl}/auth/callback?next=${next}`,
  })

  if (error) {
    const params = new URLSearchParams({ message: error.message })
    if (isAdmin) params.set('admin', '1')
    return redirect(`/forgot-password?${params.toString()}`)
  }

  return redirect(
    `${isAdmin ? '/admin/login' : '/login'}?message=${encodeURIComponent('Vérifiez votre boîte mail pour le lien de réinitialisation.')}`
  )
}
