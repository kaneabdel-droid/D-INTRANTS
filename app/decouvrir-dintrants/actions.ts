'use server'

import { createAdminClient } from '@/utils/supabase/admin'
import { createClient } from '@/utils/supabase/server'
import { withRetry } from '@/utils/supabase/retry'
import { redirect } from 'next/navigation'

// Comptes de démonstration publics (entreprise SUNUIntrants, cf.
// scripts/seed-sunuintrants.mjs) — un par rôle pour montrer les 3 points de vue
// (vue consolidée + un gérant par magasin). Même mécanisme que SIGGIE
// (app/decouvrir-siggie/actions.ts côté siggie/) : generateLink() + verifyOtp()
// exécutés côté serveur avec la clé service-role, aucun mot de passe n'est
// jamais transmis au visiteur, et chaque clic ouvre sa propre session cookie
// sans affecter les autres visiteurs pointant vers les mêmes comptes.
const DEMO_ACCOUNTS = {
  admin: 'admin@sunuintrants.sn',
  gerant1: 'gerant1@sunuintrants.sn',
  gerant2: 'gerant2@sunuintrants.sn',
} as const

export async function loginDemo(formData: FormData) {
  const role = formData.get('role') as keyof typeof DEMO_ACCOUNTS
  const email = DEMO_ACCOUNTS[role]
  if (!email) redirect('/decouvrir-dintrants?demo_error=1')

  const admin = createAdminClient()
  const { data, error } = await withRetry(() =>
    admin.auth.admin.generateLink({ type: 'magiclink', email })
  ).catch((e) => ({ data: null, error: e }))

  if (error || !data?.properties?.hashed_token) {
    console.error('Erreur génération lien démo:', error)
    redirect('/decouvrir-dintrants?demo_error=1')
  }

  const supabase = await createClient()
  const { error: verifyError } = await withRetry(() =>
    supabase.auth.verifyOtp({
      token_hash: data.properties.hashed_token,
      type: 'magiclink',
    })
  ).catch((e) => ({ error: e }))

  if (verifyError) {
    console.error('Erreur connexion démo:', verifyError)
    redirect('/decouvrir-dintrants?demo_error=1')
  }

  redirect('/dashboard')
}
