import { createClient as createSupabaseClient } from '@supabase/supabase-js'

// Client "service role" utilisé uniquement par les routes/actions serveur de l'espace
// /admin : création de comptes (auth.admin.createUser), suppression d'entreprise,
// écriture sur entreprises/magasins/utilisateurs (tables sans policy insert/update/delete
// exposée à `authenticated` — voir supabase/migrations/09_rls_policies.sql). Ce client
// contourne le RLS : ne jamais l'importer depuis du code exécuté côté client.
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY manquant : requis pour les opérations admin (création de comptes, entreprises)')
  }

  return createSupabaseClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
