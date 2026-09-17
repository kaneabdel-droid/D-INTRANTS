import { ShieldCheck } from 'lucide-react'
import LanguageSelector from '@/components/LanguageSelector'
import { getDictionary, getLocale } from '@/dictionaries'
import { loginAdmin } from './actions'

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string }>
}) {
  const { message } = await searchParams
  const locale = await getLocale()
  const dict = await getDictionary(locale)
  const t = dict.auth.adminLogin

  return (
    <div className="relative flex min-h-screen flex-col justify-center px-6 py-12 lg:px-8 bg-surface">
      <div className="absolute top-4 right-4">
        <LanguageSelector currentLang={locale} />
      </div>
      <div className="sm:mx-auto sm:w-full sm:max-w-sm text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 mb-4">
          <ShieldCheck className="h-6 w-6 text-primary" />
        </div>
        <h2 className="text-2xl font-bold leading-9 tracking-tight text-foreground">
          {t.title}
        </h2>
        <p className="mt-2 text-sm text-foreground-muted">
          {t.desc}
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-sm">
        {message && (
          <div className="mb-6 p-4 rounded-md text-sm font-medium text-center bg-danger/10 text-danger border border-danger/20">
            {message}
          </div>
        )}

        <form className="space-y-6 bg-background p-6 rounded-2xl border border-surface-border shadow-sm" action={loginAdmin}>
          <div>
            <label htmlFor="email" className="block text-sm font-medium leading-6 text-foreground">
              {t.email}
            </label>
            <div className="mt-2">
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="block w-full rounded-md border-0 py-1.5 px-3 bg-surface text-foreground shadow-sm ring-1 ring-inset ring-foreground-muted focus:ring-2 focus:ring-inset focus:ring-primary sm:text-sm sm:leading-6"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label htmlFor="password" className="block text-sm font-medium leading-6 text-foreground">
                {t.password}
              </label>
              <a href="/forgot-password?admin=1" className="text-sm font-semibold text-primary hover:text-primary-hover">
                {t.forgotPassword}
              </a>
            </div>
            <div className="mt-2">
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="block w-full rounded-md border-0 py-1.5 px-3 bg-surface text-foreground shadow-sm ring-1 ring-inset ring-foreground-muted focus:ring-2 focus:ring-inset focus:ring-primary sm:text-sm sm:leading-6"
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              className="flex w-full justify-center rounded-md bg-primary px-3 py-1.5 text-sm font-semibold leading-6 text-white shadow-sm hover:bg-primary-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              {t.submit}
            </button>
          </div>
        </form>

        <p className="mt-6 text-center text-xs text-foreground-muted">
          {t.notCompanySpace}{' '}
          <a href="/login" className="font-semibold text-primary hover:text-primary-hover">
            {t.clientLogin}
          </a>
        </p>
      </div>
    </div>
  )
}
