import { LifeBuoy, Mail, Phone } from 'lucide-react'
import { getDictionary, getLocale } from '@/dictionaries'
import ContactForm from './ContactForm'

export default async function SupportPage() {
  const dict = await getDictionary(await getLocale())
  const t = dict.supportPage

  return (
    <div className="max-w-5xl">
      <h1 className="mb-2 flex items-center gap-2 font-heading text-2xl font-bold text-foreground">
        <LifeBuoy className="h-6 w-6 text-primary" />
        {t.title}
      </h1>
      <p className="mb-8 text-sm text-foreground-muted">{t.subtitle}</p>

      <div className="space-y-6">
        {/* Coordonnées côte à côte au-dessus du formulaire : l'adresse email tient sur une ligne. */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div className="flex items-start gap-4 rounded-lg border border-surface-border bg-surface p-6 shadow-sm">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <Phone className="h-5 w-5 text-primary" aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">{t.phone}</p>
              <p className="mt-1 text-sm text-foreground-muted">{t.hours}</p>
              <p className="mt-2 font-medium text-foreground" dir="ltr">
                <a href="tel:+221708484298" className="transition-colors hover:text-primary">
                  +221 70 848 42 98
                </a>
              </p>
              <a
                href="tel:+221708484298"
                className="mt-4 inline-block rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-hover"
              >
                {t.call}
              </a>
            </div>
          </div>

          <div className="flex items-start gap-4 rounded-lg border border-surface-border bg-surface p-6 shadow-sm">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <Mail className="h-5 w-5 text-primary" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">{t.email}</p>
              <p className="mt-1 text-sm text-foreground-muted">{t.emailDesc}</p>
              <p className="mt-2 font-medium text-foreground" dir="ltr">
                <a href="mailto:support@dembasolution.com" className="transition-colors hover:text-primary">
                  support@dembasolution.com
                </a>
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-surface-border bg-surface p-6 shadow-sm sm:p-8">
          <h2 className="mb-2 text-lg font-semibold text-foreground">{t.formTitle}</h2>
          <p className="mb-6 text-sm text-foreground-muted">{t.formDesc}</p>
          <ContactForm t={t} />
        </div>
      </div>
    </div>
  )
}
