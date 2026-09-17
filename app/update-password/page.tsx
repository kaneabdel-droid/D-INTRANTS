import LanguageSelector from '@/components/LanguageSelector'
import { getDictionary, getLocale } from '@/dictionaries'
import { updatePassword } from './actions'

export default async function UpdatePasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string; admin?: string }>
}) {
  const { message, admin } = await searchParams
  const isAdmin = admin === '1'
  const locale = await getLocale()
  const dict = await getDictionary(locale)
  const t = dict.auth.updatePassword

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

      <div className="mt-10 sm:mx-auto sm:w-full sm:max-w-sm">
        <form className="space-y-6" action={updatePassword}>
          {isAdmin && <input type="hidden" name="admin" value="1" />}
          {message && (
            <p className="text-sm text-center bg-danger/10 text-danger p-3 rounded-md">
              {message}
            </p>
          )}

          <div>
            <label htmlFor="password" className="block text-sm font-medium leading-6 text-foreground">
              {t.password}
            </label>
            <div className="mt-2">
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                minLength={6}
                className="block w-full rounded-md border-0 py-1.5 px-3 bg-surface text-foreground shadow-sm ring-1 ring-inset ring-foreground-muted focus:ring-2 focus:ring-inset focus:ring-primary sm:text-sm sm:leading-6"
              />
            </div>
          </div>

          <div>
            <label htmlFor="password_confirm" className="block text-sm font-medium leading-6 text-foreground">
              {t.confirmPassword}
            </label>
            <div className="mt-2">
              <input
                id="password_confirm"
                name="password_confirm"
                type="password"
                autoComplete="new-password"
                required
                minLength={6}
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
      </div>
    </div>
  )
}
