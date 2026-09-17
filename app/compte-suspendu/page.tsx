import { redirect } from 'next/navigation'
import { getCurrentUserContext } from '@/lib/auth/getCurrentUserContext'
import PlanSelector from '@/app/(dashboard)/abonnement/PlanSelector'

// Vit hors du layout (dashboard) : c'est justement ce layout qui redirige ici
// quand entrepriseStatut === 'suspendu' (cf. app/(dashboard)/layout.tsx) — un
// admin_entreprise doit pouvoir atteindre cette page et payer pour en sortir.
export default async function CompteSuspenduPage() {
  const context = await getCurrentUserContext()

  // Réactivé entre-temps (paiement déjà traité par le webhook/cron) : retour direct.
  if (context.entrepriseStatut === 'actif') redirect('/dashboard')

  return (
    <div className="min-h-screen bg-background flex flex-col items-center px-4 py-12">
      <div className="w-full max-w-2xl space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold font-heading text-danger mb-2">Compte suspendu</h1>
          <p className="text-foreground-muted">
            L&apos;abonnement de <strong>{context.entrepriseNom}</strong> a expiré.
          </p>
        </div>

        {context.role === 'admin_entreprise' ? (
          <div className="bg-surface rounded-xl border border-surface-border p-6">
            <PlanSelector />
          </div>
        ) : (
          <div className="bg-surface rounded-xl border border-surface-border p-6 text-center">
            <p className="text-foreground-muted">Contactez l&apos;administrateur de votre entreprise pour réactiver l&apos;accès.</p>
          </div>
        )}

        <div className="text-center">
          <a href="/logout" className="text-sm text-foreground-muted hover:text-danger">Déconnexion</a>
        </div>
      </div>
    </div>
  )
}
