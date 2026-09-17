import { createClient } from '@/utils/supabase/server'
import { requireAdminEntreprise } from '@/lib/auth/getCurrentUserContext'
import { getDictionary, getLocale } from '@/dictionaries'
import ParametresForm from './ParametresForm'

export default async function ParametresPage() {
  const context = await requireAdminEntreprise()
  const supabase = await createClient()
  const dict = await getDictionary(await getLocale())
  const t = dict.parametres

  const { data: entreprise } = await supabase
    .from('entreprises')
    .select('nom, adresse, telephone, email, identification, devise, logo_url')
    .eq('id', context.entrepriseId)
    .single()

  return (
    <div>
      <h1 className="text-2xl font-bold font-heading text-foreground mb-2">{t.title}</h1>
      <p className="text-sm text-foreground-muted mb-8">{t.subtitle}</p>

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
    </div>
  )
}
