import Link from 'next/link'
import LanguageSelector from '@/components/LanguageSelector'
import { getDictionary, getLocale } from '@/dictionaries'

export default async function HomePage() {
  const locale = await getLocale()
  const dict = await getDictionary(locale)

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-background px-6 text-center">
      <div className="absolute top-4 right-4">
        <LanguageSelector currentLang={locale} />
      </div>
      <h1 className="font-heading text-3xl font-bold text-foreground">{dict.home.title}</h1>
      <p className="mt-2 max-w-md text-foreground-muted">{dict.home.tagline}</p>
      <div className="mt-6 flex items-center gap-4">
        <Link
          href="/tarifs"
          className="rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-hover"
        >
          {dict.home.subscribe}
        </Link>
        <Link href="/decouvrir-dintrants" className="text-sm font-semibold text-foreground-muted hover:text-primary">
          {dict.home.discover} <span aria-hidden="true">&rarr;</span>
        </Link>
      </div>

      <div id="fonctionnalites" className="mt-20 grid w-full max-w-3xl gap-6 text-left sm:grid-cols-3">
        <div className="rounded-xl border border-surface-border bg-surface p-5">
          <h2 className="font-semibold text-foreground">{dict.home.features.stock.title}</h2>
          <p className="mt-1 text-sm text-foreground-muted">{dict.home.features.stock.desc}</p>
        </div>
        <div className="rounded-xl border border-surface-border bg-surface p-5">
          <h2 className="font-semibold text-foreground">{dict.home.features.ventes.title}</h2>
          <p className="mt-1 text-sm text-foreground-muted">{dict.home.features.ventes.desc}</p>
        </div>
        <div className="rounded-xl border border-surface-border bg-surface p-5">
          <h2 className="font-semibold text-foreground">{dict.home.features.magasins.title}</h2>
          <p className="mt-1 text-sm text-foreground-muted">{dict.home.features.magasins.desc}</p>
        </div>
      </div>
    </div>
  );
}
