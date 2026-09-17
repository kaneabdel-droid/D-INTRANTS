import { CheckCircle2, XCircle } from 'lucide-react'
import { createAdminClient } from '@/utils/supabase/admin'
import ChariowProduitsEditor from './ChariowProduitsEditor'

export default async function AdminConfigPage() {
  const supabase = createAdminClient()
  const { data: produits } = await supabase.from('chariow_produits').select('palier, duree_mois, product_id')

  const hasChariowKeys = Boolean(process.env.CHARIOW_API_KEY)

  return (
    <div>
      <h1 className="text-2xl font-bold font-heading mb-6">Configuration</h1>

      <div className="bg-background rounded-xl p-5 border border-surface-border mb-8">
        <h2 className="font-semibold mb-4">Prestataire de paiement</h2>
        <p className="text-sm text-foreground-muted mb-4">
          Les clés API vivent dans les variables d&apos;environnement du serveur (jamais affichées ici).
        </p>
        <div className="flex items-center gap-2 text-sm">
          {hasChariowKeys ? <CheckCircle2 className="w-4 h-4 text-success" /> : <XCircle className="w-4 h-4 text-danger" />}
          Chariow (Mobile Money) — {hasChariowKeys ? 'configuré' : 'non configuré'}
        </div>
      </div>

      <div className="bg-background rounded-xl p-5 border border-surface-border">
        <h2 className="font-semibold mb-4">Produits Chariow</h2>
        <ChariowProduitsEditor produits={produits ?? []} />
      </div>
    </div>
  )
}
