import { createAdminClient } from '@/utils/supabase/admin'
import { Building2, Store, Users } from 'lucide-react'

export default async function AdminDashboardPage() {
  const supabase = createAdminClient()

  const { count: nbEntreprises } = await supabase.from('entreprises').select('id', { count: 'exact', head: true })
  const { count: nbMagasins } = await supabase.from('magasins').select('id', { count: 'exact', head: true })
  const { count: nbUtilisateurs } = await supabase.from('utilisateurs').select('id', { count: 'exact', head: true })

  const cards = [
    { label: 'Entreprises', value: nbEntreprises ?? 0, icon: Building2 },
    { label: 'Magasins', value: nbMagasins ?? 0, icon: Store },
    { label: 'Utilisateurs', value: nbUtilisateurs ?? 0, icon: Users },
  ]

  return (
    <div>
      <h1 className="text-2xl font-bold font-heading mb-6">Tableau de bord</h1>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {cards.map(({ label, value, icon: Icon }) => (
          <div key={label} className="bg-background rounded-xl p-5 border border-surface-border">
            <Icon className="w-5 h-5 text-primary mb-3" />
            <p className="text-2xl font-bold">{value}</p>
            <p className="text-sm text-foreground-muted mt-1">{label}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
