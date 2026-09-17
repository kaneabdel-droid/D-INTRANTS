'use server'

import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'

export async function updatePassword(formData: FormData) {
  const password = formData.get('password') as string
  const passwordConfirm = formData.get('password_confirm') as string
  const isAdmin = formData.get('admin') === '1'
  const adminQuery = isAdmin ? '&admin=1' : ''

  if (password !== passwordConfirm) {
    return redirect(`/update-password?message=${encodeURIComponent('Les mots de passe ne correspondent pas.')}${adminQuery}`)
  }

  const supabase = await createClient()

  const { error } = await supabase.auth.updateUser({
    password: password,
  })

  if (error) {
    return redirect(`/update-password?message=${encodeURIComponent(error.message)}${adminQuery}`)
  }

  return redirect(
    `${isAdmin ? '/admin/login' : '/login'}?message=${encodeURIComponent('Mot de passe mis à jour avec succès.')}`
  )
}
