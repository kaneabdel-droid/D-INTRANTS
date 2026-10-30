import LanguageSelector from '@/components/LanguageSelector'
import { getDictionary, getLocale } from '@/dictionaries'
import Link from 'next/link'
import ClientSignupForm from './ClientSignupForm'

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ message?: string }> }) {
  const { message } = await searchParams
  const locale = await getLocale()
  const dict = await getDictionary(locale)
  const t = (dict?.auth as any)?.signup || {}

  return (
    <div className="relative flex min-h-screen flex-col justify-center px-6 py-12 lg:px-8 bg-background">
      <div className="absolute top-4 right-4">
        <LanguageSelector currentLang={locale} />
      </div>
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className="mt-6 text-center text-3xl font-bold font-heading tracking-tight text-primary">
          {t.title || 'Créer un compte d-intrants'}
        </h2>
        <p className="mt-2 text-center text-sm text-foreground-muted">
          {t.desc || "Inscrivez votre entreprise pour gérer vos boutiques d'intrants, semences, engrais et stocks."}
        </p>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-surface border border-surface-border rounded-2xl p-6 sm:p-8 shadow-sm">
          {message && (
            <div className="mb-6 p-4 rounded-xl text-sm font-medium text-center bg-danger/10 text-danger border border-danger/20">
              {message}
            </div>
          )}

          <ClientSignupForm dict={dict} locale={locale} />

          <div className="mt-6 text-center text-sm text-foreground-muted border-t border-surface-border pt-4">
            <span>{t.has_account || 'Vous avez déjà un compte ?'} </span>
            <Link href="/login" className="font-semibold text-primary hover:text-primary-hover underline ml-1">
              {t.login || 'Connectez-vous'}
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
