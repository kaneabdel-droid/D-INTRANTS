'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createClient } from '@/utils/supabase/server'

export async function login(formData: FormData) {
  const cookieStore = await cookies()

  const lockoutUntil = cookieStore.get('lockout_until')?.value
  if (lockoutUntil && parseInt(lockoutUntil) > Date.now()) {
    redirect('/login?message=Trop de tentatives échouées. Veuillez patienter 1 minute avant de réessayer.')
  }

  const supabase = await createClient()

  const data = {
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  }

  const { error } = await supabase.auth.signInWithPassword(data)

  if (error) {
    const attemptsCookie = cookieStore.get('login_attempts')?.value
    const attempts = attemptsCookie ? parseInt(attemptsCookie) + 1 : 1

    if (attempts >= 3) {
      cookieStore.set('lockout_until', (Date.now() + 60_000).toString(), { maxAge: 60 })
      cookieStore.delete('login_attempts')
      redirect('/login?message=Trop de tentatives échouées. Veuillez patienter 1 minute avant de réessayer.')
    } else {
      cookieStore.set('login_attempts', attempts.toString(), { maxAge: 300 })
      redirect('/login?message=Identifiant ou mot de passe incorrect')
    }
  }

  cookieStore.delete('login_attempts')
  cookieStore.delete('lockout_until')

  revalidatePath('/', 'layout')
  redirect('/dashboard')
}
