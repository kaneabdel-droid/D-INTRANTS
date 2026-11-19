import LanguageSelector from '@/components/LanguageSelector'
import { getDictionary, getLocale } from '@/dictionaries'
import { updatePassword } from './actions'
import { KeyRound, ShieldCheck } from 'lucide-react'

export default async function UpdatePasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string; admin?: string; first?: string }>
}) {
  const { message, admin, first } = await searchParams
  const isAdmin = admin === '1'
  const isFirst = first === '1'
  const locale = await getLocale()
  const dict = await getDictionary(locale)
  const t = dict.auth.updatePassword

  return (
    <div className="relative flex min-h-screen flex-col justify-center px-6 py-12 lg:px-8 bg-background">
      <div className="absolute top-4 right-4">
        <LanguageSelector currentLang={locale} />
      </div>
      <div className="sm:mx-auto sm:w-full sm:max-w-sm">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 border border-primary/20 text-primary">
          {isFirst ? <ShieldCheck className="h-6 w-6" /> : <KeyRound className="h-6 w-6" />}
        </div>
        <h2 className="mt-4 text-center text-2xl font-bold font-heading leading-9 tracking-tight text-foreground">
          {isFirst ? 'Première connexion' : t.title}
        </h2>
        <p className="mt-1 text-center text-xs text-foreground-muted">
          {isFirst
            ? 'Pour votre sécurité, veuillez définir votre mot de passe personnel avant d’accéder à votre espace.'
            : t.desc}
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-sm">
        <form className="space-y-5" action={updatePassword}>
          {isAdmin && <input type="hidden" name="admin" value="1" />}
          {isFirst && <input type="hidden" name="first" value="1" />}
          {message && (
            <p className="text-xs text-center bg-danger/10 text-danger p-3 rounded-xl border border-danger/20 font-medium">
              {message}
            </p>
          )}

          <div>
            <label htmlFor="password" className="block text-xs font-semibold uppercase tracking-wider text-foreground">
              {isFirst ? 'Nouveau mot de passe personnel' : t.password}
            </label>
            <div className="mt-1">
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                minLength={6}
                placeholder="6 caractères minimum"
                className="block w-full rounded-xl border border-surface-border bg-surface px-3 py-2 text-xs text-foreground placeholder:text-foreground-muted focus:border-primary focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label htmlFor="password_confirm" className="block text-xs font-semibold uppercase tracking-wider text-foreground">
              {t.confirmPassword}
            </label>
            <div className="mt-1">
              <input
                id="password_confirm"
                name="password_confirm"
                type="password"
                autoComplete="new-password"
                required
                minLength={6}
                placeholder="Confirmez le mot de passe"
                className="block w-full rounded-xl border border-surface-border bg-surface px-3 py-2 text-xs text-foreground placeholder:text-foreground-muted focus:border-primary focus:outline-none"
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              className="flex w-full justify-center rounded-xl bg-primary px-3 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary transition-colors cursor-pointer"
            >
              {isFirst ? 'Valider et accéder à mon espace' : t.submit}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
