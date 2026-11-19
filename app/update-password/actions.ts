'use server'

import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'

export async function updatePassword(formData: FormData) {
  const password = formData.get('password') as string
  const passwordConfirm = formData.get('password_confirm') as string
  const isAdmin = formData.get('admin') === '1'
  const isFirst = formData.get('first') === '1'
  const adminQuery = isAdmin ? '&admin=1' : ''
  const firstQuery = isFirst ? '&first=1' : ''

  if (password !== passwordConfirm) {
    return redirect(`/update-password?message=${encodeURIComponent('Les mots de passe ne correspondent pas.')}${adminQuery}${firstQuery}`)
  }

  if (!password || password.length < 6) {
    return redirect(`/update-password?message=${encodeURIComponent('Le mot de passe doit comporter au moins 6 caractères.')}${adminQuery}${firstQuery}`)
  }

  const supabase = await createClient()

  const { data: updateData, error } = await supabase.auth.updateUser({
    password: password,
    data: {
      doit_changer_mot_de_passe: false,
    },
  })

  if (error) {
    return redirect(`/update-password?message=${encodeURIComponent(error.message)}${adminQuery}${firstQuery}`)
  }

  if (updateData?.user?.id) {
    await supabase
      .from('utilisateurs')
      .update({ doit_changer_mot_de_passe: false })
      .eq('id', updateData.user.id)
  }

  if (isAdmin) {
    return redirect(`/admin/login?message=${encodeURIComponent('Mot de passe mis à jour avec succès.')}`)
  }

  return redirect(`/dashboard?message=${encodeURIComponent('Votre mot de passe a été défini avec succès. Bienvenue !')}`)
}
