'use server'

import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { redirect } from 'next/navigation'
import { AUTRE_PAYS, PAYS_PAR_DEFAUT, trouverPays } from '@/lib/pays'

export async function signup(formData: FormData) {
  const entrepriseNom = (formData.get('entreprise_nom') as string || '').trim()
  const nom = (formData.get('nom') as string || '').trim()
  const prenom = (formData.get('prenom') as string || '').trim()
  const email = (formData.get('email') as string || '').trim().toLowerCase()
  const telephone = (formData.get('telephone') as string || '').trim()
  const password = (formData.get('password') as string || '')
  const codePays = (formData.get('pays') as string || PAYS_PAR_DEFAUT).trim()
  const paysNom = (formData.get('pays_nom') as string || '').trim()
  const magasinNom = (formData.get('magasin_nom') as string || '').trim() || 'Boutique Principale'

  if (!entrepriseNom) {
    return redirect('/signup?message=' + encodeURIComponent("Le nom de l'entreprise est requis"))
  }
  if (!email || !email.includes('@')) {
    return redirect('/signup?message=' + encodeURIComponent("Une adresse e-mail valide est requise"))
  }
  if (!password || password.length < 6) {
    return redirect('/signup?message=' + encodeURIComponent("Le mot de passe doit comporter au moins 6 caractères"))
  }
  if (!nom || !prenom) {
    return redirect('/signup?message=' + encodeURIComponent("Le nom et prénom du responsable sont requis"))
  }

  const pays = trouverPays(codePays)
  if (!pays && codePays !== AUTRE_PAYS) {
    return redirect('/signup?message=' + encodeURIComponent("Pays sélectionné invalide"))
  }
  if (codePays === AUTRE_PAYS && !paysNom) {
    return redirect('/signup?message=' + encodeURIComponent("Veuillez préciser le nom de votre pays"))
  }

  const devise = pays ? (pays.devise === 'AUCUNE' ? 'USD' : pays.devise) : 'USD'

  const adminSupabase = createAdminClient()

  // 1. Création du compte Auth Supabase
  const { data: createdAuth, error: authErr } = await adminSupabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      nom,
      prenom,
      role: 'admin_entreprise',
      entreprise_nom: entrepriseNom,
    },
  })

  if (authErr || !createdAuth?.user) {
    const msg = authErr?.message?.includes('already') || authErr?.message?.includes('registered')
      ? 'Un compte existe déjà avec cette adresse e-mail.'
      : (authErr?.message || 'Erreur lors de la création du compte.')
    return redirect('/signup?message=' + encodeURIComponent(msg))
  }

  const authUserId = createdAuth.user.id

  // 2. Création de l'entreprise
  const { data: ent, error: entErr } = await adminSupabase
    .from('entreprises')
    .insert({
      nom: entrepriseNom,
      telephone: telephone || null,
      devise,
      statut: 'actif',
      palier: 'standard',
    })
    .select('id')
    .single()

  if (entErr || !ent) {
    try { await adminSupabase.auth.admin.deleteUser(authUserId) } catch {}
    return redirect('/signup?message=' + encodeURIComponent("Erreur lors de la création de l'entreprise : " + (entErr?.message || '')))
  }

  // 3. Création du point de vente / boutique principale initiale
  const { data: mag, error: magErr } = await adminSupabase
    .from('magasins')
    .insert({
      entreprise_id: ent.id,
      nom: magasinNom,
      statut: 'actif',
      telephone: telephone || null,
    })
    .select('id')
    .single()

  if (magErr) {
    try { await adminSupabase.from('entreprises').delete().eq('id', ent.id) } catch {}
    try { await adminSupabase.auth.admin.deleteUser(authUserId) } catch {}
    return redirect('/signup?message=' + encodeURIComponent("Erreur lors de la création du point de vente : " + (magErr?.message || '')))
  }

  // 4. Création de l'utilisateur admin_entreprise (magasin_id null obligatoire)
  const nomComplet = `${prenom} ${nom}`.trim() || null
  const identifiant = telephone ? telephone.replace(/[^0-9]/g, '') : null

  const { error: userErr } = await adminSupabase
    .from('utilisateurs')
    .insert({
      id: authUserId,
      entreprise_id: ent.id,
      magasin_id: null,
      role: 'admin_entreprise',
      nom,
      prenom,
      nom_complet: nomComplet,
      telephone: telephone || null,
      identifiant,
    })

  if (userErr) {
    try { await adminSupabase.from('magasins').delete().eq('id', mag.id) } catch {}
    try { await adminSupabase.from('entreprises').delete().eq('id', ent.id) } catch {}
    try { await adminSupabase.auth.admin.deleteUser(authUserId) } catch {}
    return redirect('/signup?message=' + encodeURIComponent("Erreur lors de l'enregistrement de l'administrateur : " + (userErr?.message || '')))
  }

  // 5. Connexion directe de l'utilisateur avec session Supabase
  const supabase = await createClient()
  const { error: loginErr } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (loginErr) {
    return redirect('/login?message=' + encodeURIComponent("Compte créé avec succès ! Connectez-vous avec vos identifiants."))
  }

  return redirect('/dashboard')
}
