import LanguageSelector from '@/components/LanguageSelector'
import { getDictionary, getLocale } from '@/dictionaries'
import Link from 'next/link'
import ClientLoginForm from './ClientLoginForm'
import { Sparkles, ArrowRight } from 'lucide-react'

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

        <div className="mt-8 rounded-2xl border-2 border-dashed border-primary/30 bg-primary/5 p-5 text-center transition-all hover:border-primary/50 hover:bg-primary/[0.08]">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold uppercase tracking-wider mb-2">
            <Sparkles className="w-3.5 h-3.5" /> Nouveau distributeur d&apos;intrants ?
          </div>
          <h3 className="font-heading font-bold text-foreground text-base">
            Créez votre entreprise en 2 minutes
          </h3>
          <p className="text-xs text-foreground-muted mt-1">
            Stocks semences & engrais • Caisse • Facturation • 7 jours d&apos;essai gratuit
          </p>
          <Link
            href="/signup"
            className="mt-3.5 inline-flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl bg-primary text-white text-sm font-bold shadow-sm hover:bg-primary-hover hover:shadow transition-all group"
          >
            <span>Créer un compte entreprise</span>
            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
      </div>
    </div>
  )
}
