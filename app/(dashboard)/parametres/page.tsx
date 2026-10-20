import { createClient } from '@/utils/supabase/server'
import { requireAdminEntreprise } from '@/lib/auth/getCurrentUserContext'
import { getDictionary, getLocale } from '@/dictionaries'
import type { Matrice } from '@/lib/permissions'
import ParametresForm from './ParametresForm'
import PermissionsForm from './PermissionsForm'
import CollaborateursSection from './CollaborateursSection'

export default async function ParametresPage() {
  const context = await requireAdminEntreprise()
  const supabase = await createClient()
  const dict = await getDictionary(await getLocale())
  const t = dict.parametres

  const [{ data: entreprise }, { data: perm }, { data: rawCollabs }, { data: rawMagasins }] = await Promise.all([
    supabase
      .from('entreprises')
      .select('nom, adresse, telephone, email, identification, devise, logo_url')
      .eq('id', context.entrepriseId)
      .single(),
    supabase.from('parametres_permissions').select('matrice').maybeSingle(),
    supabase
      .from('utilisateurs')
      .select('id, role, identifiant, telephone, nom, prenom, nom_complet, magasin_id, magasins(id, nom)')
      .eq('entreprise_id', context.entrepriseId),
    supabase
      .from('magasins')
      .select('id, nom')
      .eq('entreprise_id', context.entrepriseId)
      .order('nom', { ascending: true }),
  ])

  const collaborateurs = (rawCollabs || []).map((c: any) => ({
    id: c.id,
    role: c.role,
    identifiant: c.identifiant,
    telephone: c.telephone,
    nom: c.nom,
    prenom: c.prenom,
    nom_complet: c.nom_complet,
    magasin_id: c.magasin_id,
    magasin_nom: c.magasins?.nom || null,
  }))

  const magasins = (rawMagasins || []).map((m: any) => ({
    id: m.id,
    nom: m.nom,
  }))

  return (
    <div>
      <h1 className="text-2xl font-bold font-heading text-foreground mb-2">{t.title}</h1>
      <p className="text-sm text-foreground-muted mb-8">{t.subtitle}</p>

      <div className="max-w-3xl space-y-8">
        <CollaborateursSection
          collaborateurs={collaborateurs}
          magasins={magasins}
          currentUserId={context.userId}
        />
        <ParametresForm
          dict={dict}
          entreprise={{
            nom: entreprise?.nom ?? '',
            adresse: entreprise?.adresse ?? '',
            telephone: entreprise?.telephone ?? '',
            email: entreprise?.email ?? '',
            identification: entreprise?.identification ?? '',
            devise: entreprise?.devise ?? 'XOF',
            logoUrl: entreprise?.logo_url ?? null,
          }}
        />
        <PermissionsForm matriceInitiale={(perm?.matrice as Matrice | undefined) ?? {}} dict={dict} />
      </div>
    </div>
  )
}
