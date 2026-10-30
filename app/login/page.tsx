import LanguageSelector from '@/components/LanguageSelector'
import { getDictionary, getLocale } from '@/dictionaries'
import Link from 'next/link'
import ClientLoginForm from './ClientLoginForm'

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ message?: string }> }) {
  const { message } = await searchParams
  const locale = await getLocale()
  const dict = await getDictionary(locale)
  const t = dict.auth.login

  return (
    <div className="relative flex min-h-screen flex-col justify-center px-6 py-12 lg:px-8 bg-background">
      <div className="absolute top-4 right-4">
        <LanguageSelector currentLang={locale} />
      </div>
      <div className="sm:mx-auto sm:w-full sm:max-w-sm">
        <h2 className="mt-10 text-center text-2xl font-bold font-heading leading-9 tracking-tight text-primary">
          {t.title}
        </h2>
        <p className="mt-2 text-center text-sm text-foreground-muted">
          {t.desc}
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-sm">
        <ClientLoginForm dict={dict} initialMessage={message} />

        <div className="mt-8 text-center text-sm border-t border-surface-border pt-4">
          <p className="text-foreground-muted text-xs mb-2">
            Pas encore de compte entreprise ?
          </p>
          <Link
            href="/signup"
            className="inline-flex items-center justify-center font-semibold text-sm text-primary hover:text-primary-hover underline"
          >
            Créer un compte entreprise →
          </Link>
        </div>
      </div>
    </div>
  )
}
