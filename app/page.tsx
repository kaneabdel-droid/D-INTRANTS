import Link from 'next/link'
import { ArrowLeft, ArrowRight, Boxes, Receipt, Store, Sprout, FlaskConical, Bug, Wrench } from 'lucide-react'
import LanguageSelector from '@/components/LanguageSelector'
import RevealGroup from '@/components/RevealGroup'
import { getDictionary, getLocale } from '@/dictionaries'

const cardHover =
  'transition duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md'

export default async function HomePage() {
  const locale = await getLocale()
  const dict = await getDictionary(locale)
  const h = dict.home
  const features = [
    { icon: Boxes, key: 'stock' as const },
    { icon: Receipt, key: 'ventes' as const },
    { icon: Store, key: 'magasins' as const },
  ]
  const catIcons = [Sprout, FlaskConical, Bug, Wrench]

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Navbar */}
      <header className="sticky top-0 z-10 border-b border-surface-border bg-surface">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-6">
            <span className="font-heading text-xl font-bold text-primary">{h.title}</span>
            <a
              href="https://www.dembasolution.com"
              className="hidden items-center gap-1.5 text-sm text-foreground-muted hover:text-primary sm:flex"
            >
              <ArrowLeft className="h-4 w-4 rtl:rotate-180" /> {h.backToDemba}
            </a>
          </div>
          <div className="flex items-center gap-4">
            <LanguageSelector currentLang={locale} />
            <Link
              href="/tarifs"
              className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-hover"
            >
              {h.subscribe}
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="border-b border-surface-border bg-sidebar">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-6 py-16 md:grid-cols-2 md:py-24">
          <div>
            <p className="inline-block rounded bg-secondary px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-secondary-foreground">
              {h.eyebrow}
            </p>
            <h1 className="mt-5 font-heading text-4xl font-bold leading-tight md:text-5xl">
              {h.heroA} <span className="text-primary">{h.heroB}</span>
            </h1>
            <p className="mt-5 max-w-md text-foreground-muted">{h.tagline}</p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href="/tarifs"
                className="rounded-md bg-primary px-5 py-3 text-sm font-semibold text-white transition hover:bg-primary-hover"
              >
                {h.subscribe}
              </Link>
              <Link
                href="/decouvrir-dintrants"
                className="rounded-md border border-primary/40 px-5 py-3 text-sm font-semibold text-primary transition hover:bg-primary hover:text-white"
              >
                {h.discover}
              </Link>
            </div>
          </div>

          {/* Aperçu de catalogue façon marketplace */}
          <div className="rounded-xl border border-surface-border bg-surface p-4 shadow-sm">
            <p className="px-2 pb-3 text-xs font-semibold uppercase tracking-wide text-foreground-muted">
              {h.catEyebrow}
            </p>
            <ul className="divide-y divide-surface-border">
              {h.cats.map(([name, desc]: string[], i: number) => {
                const Icon = catIcons[i]
                return (
                  <li
                    key={name}
                    className="drop-in flex items-center gap-4 px-2 py-3.5"
                    style={{ '--drop-delay': `${0.3 + i * 0.5}s` } as React.CSSProperties}
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-sidebar text-primary">
                      <Icon className="h-5 w-5" />
                    </span>
                    <span>
                      <span className="block text-sm font-semibold">{name}</span>
                      <span className="block text-xs text-foreground-muted">{desc}</span>
                    </span>
                  </li>
                )
              })}
            </ul>
          </div>
        </div>
      </section>

      {/* Bandeau de chiffres */}
      <section className="bg-primary text-white">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-6 px-6 py-7 md:grid-cols-4">
          {h.stats.map(([title, sub]: string[], i: number) => (
            <div key={i}>
              <p className="font-heading text-xl font-bold">{title}</p>
              <p className="text-sm text-white/75">{sub}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Solutions */}
      <section id="fonctionnalites" className="mx-auto max-w-6xl px-6 py-20">
        <p className="text-xs font-bold uppercase tracking-widest text-primary">{h.solutionsEyebrow}</p>
        <h2 className="mt-3 max-w-xl font-heading text-3xl font-bold">{h.solutionsTitle}</h2>
        <RevealGroup className="mt-10 grid gap-5 md:grid-cols-3">
          {features.map(({ icon: Icon, key }, i) => (
            <div key={key} className="reveal" style={{ '--reveal-index': i } as React.CSSProperties}>
            <div className={`h-full rounded-xl border border-surface-border bg-surface p-6 ${cardHover}`}>
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-sidebar text-primary">
                <Icon className="h-5 w-5" />
              </span>
              <h3 className="mt-5 font-heading text-lg font-semibold">{h.features[key].title}</h3>
              <p className="mt-2 text-sm text-foreground-muted">{h.features[key].desc}</p>
              <Link
                href="/decouvrir-dintrants"
                className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-primary hover:text-primary-hover"
              >
                {h.learn} <ArrowRight className="h-4 w-4 rtl:rotate-180" />
              </Link>
            </div>
            </div>
          ))}
        </RevealGroup>
      </section>

      {/* Comment ça marche */}
      <section className="bg-[#14301A] text-[#E9EFE7]">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <p className="text-xs font-bold uppercase tracking-widest text-secondary">{h.howEyebrow}</p>
          <h2 className="mt-3 max-w-xl font-heading text-3xl font-bold">{h.howTitle}</h2>
          <ol className="mt-10 grid gap-8 md:grid-cols-3">
            {h.steps.map(([title, desc]: string[], i: number) => (
              <li key={i} className="border-t border-white/15 pt-5">
                <span className="font-heading text-3xl font-bold text-secondary">0{i + 1}</span>
                <h3 className="mt-3 font-semibold">{title}</h3>
                <p className="mt-1 text-sm text-[#A9BCAD]">{desc}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Appel à l'action */}
      <section className="mx-auto max-w-3xl px-6 py-24 text-center">
        <p className="text-xs font-bold uppercase tracking-widest text-primary">{h.ctaEyebrow}</p>
        <h2 className="mt-3 font-heading text-4xl font-bold">{h.ctaTitle}</h2>
        <p className="mt-4 text-foreground-muted">{h.ctaSub}</p>
        <Link
          href="/tarifs"
          className="mt-8 inline-block rounded-md bg-primary px-6 py-3 text-sm font-semibold text-white transition hover:bg-primary-hover"
        >
          {h.subscribe}
        </Link>
      </section>

      <footer className="border-t border-surface-border bg-sidebar py-6 text-center text-sm text-foreground-muted">
        © {new Date().getFullYear()} {h.title}
      </footer>
    </div>
  )
}
