'use client'

import { useState } from 'react'
import { useFormStatus } from 'react-dom'
import { Eye, EyeOff, Building2, User, Phone, MapPin, Mail, Lock, Store, ArrowRight, Loader2 } from 'lucide-react'
import { signup } from './actions'
import { AUTRE_PAYS, PAYS, PAYS_PAR_DEFAUT } from '@/lib/pays'

function paysTries(locale: string) {
  let noms: Intl.DisplayNames | null = null
  try {
    noms = new Intl.DisplayNames([locale], { type: 'region' })
  } catch {}
  return PAYS.map((p) => ({ code: p.code, nom: noms?.of(p.code) ?? p.nom })).sort((a, b) => a.nom.localeCompare(b.nom, locale))
}

function SubmitButton({ dict }: { dict: any }) {
  const { pending } = useFormStatus()
  const t = (dict?.auth as any)?.signup || {}

  return (
    <button
      type="submit"
      disabled={pending}
      className="flex w-full justify-center items-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-primary-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary transition-all disabled:opacity-60 disabled:cursor-not-allowed"
    >
      {pending ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>{t.creating || 'Création en cours...'}</span>
        </>
      ) : (
        <>
          <span>{t.btn || 'Créer mon compte entreprise'}</span>
          <ArrowRight className="h-4 w-4" />
        </>
      )}
    </button>
  )
}

export default function ClientSignupForm({ dict, locale }: { dict: any; locale: string }) {
  const [showPassword, setShowPassword] = useState(false)
  const [pays, setPays] = useState(PAYS_PAR_DEFAUT)
  const t = (dict?.auth as any)?.signup || {}

  const inputClass = "block w-full rounded-xl border border-surface-border bg-background px-3.5 py-2.5 text-foreground shadow-sm placeholder:text-foreground-muted/60 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary sm:text-sm"

  return (
    <form className="space-y-4" action={signup}>
      {/* Nom de l'entreprise */}
      <div>
        <label htmlFor="entreprise_nom" className="block text-sm font-medium leading-6 text-foreground flex items-center gap-1.5 mb-1">
          <Building2 className="w-4 h-4 text-primary" />
          {t.company_name || "Nom de l'entreprise"} <span className="text-danger">*</span>
        </label>
        <input
          id="entreprise_nom"
          name="entreprise_nom"
          type="text"
          placeholder="Ex: Comptoir Agricole & Semences"
          required
          className={inputClass}
        />
      </div>

      {/* Responsable : Prénom et Nom */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label htmlFor="prenom" className="block text-sm font-medium leading-6 text-foreground flex items-center gap-1.5 mb-1">
            <User className="w-4 h-4 text-primary" />
            {t.first_name || 'Prénom'} <span className="text-danger">*</span>
          </label>
          <input
            id="prenom"
            name="prenom"
            type="text"
            placeholder="Mamadou"
            required
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="nom" className="block text-sm font-medium leading-6 text-foreground mb-1">
            {t.last_name || 'Nom'} <span className="text-danger">*</span>
          </label>
          <input
            id="nom"
            name="nom"
            type="text"
            placeholder="Sow"
            required
            className={inputClass}
          />
        </div>
      </div>

      {/* Téléphone & Pays */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label htmlFor="telephone" className="block text-sm font-medium leading-6 text-foreground flex items-center gap-1.5 mb-1">
            <Phone className="w-4 h-4 text-primary" />
            {t.phone || 'Téléphone'} <span className="text-danger">*</span>
          </label>
          <input
            id="telephone"
            name="telephone"
            type="tel"
            placeholder="Ex: 77 987 65 43"
            required
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="pays" className="block text-sm font-medium leading-6 text-foreground flex items-center gap-1.5 mb-1">
            <MapPin className="w-4 h-4 text-primary" />
            {t.country || 'Pays'}
          </label>
          <select
            id="pays"
            name="pays"
            value={pays}
            onChange={(e) => setPays(e.target.value)}
            className={inputClass}
          >
            {paysTries(locale).map((p) => (
              <option key={p.code} value={p.code}>
                {p.nom}
              </option>
            ))}
            <option value={AUTRE_PAYS}>{t.other_country || 'Autre pays'}</option>
          </select>
        </div>
      </div>

      {pays === AUTRE_PAYS && (
        <div>
          <label htmlFor="pays_nom" className="block text-sm font-medium leading-6 text-foreground mb-1">
            {t.other_country_name || 'Nom de votre pays'} <span className="text-danger">*</span>
          </label>
          <input
            id="pays_nom"
            name="pays_nom"
            type="text"
            placeholder="Ex: Guinée"
            required
            className={inputClass}
          />
          <p className="mt-1 text-xs text-foreground-muted">{t.usd_note}</p>
        </div>
      )}

      {/* Point de vente initial (optionnel) */}
      <div>
        <label htmlFor="magasin_nom" className="block text-sm font-medium leading-6 text-foreground flex items-center gap-1.5 mb-1">
          <Store className="w-4 h-4 text-primary" />
          {t.store_name || 'Premier point de vente (boutique)'}
        </label>
        <input
          id="magasin_nom"
          name="magasin_nom"
          type="text"
          placeholder={t.store_placeholder || 'Boutique Principale'}
          className={inputClass}
        />
        <p className="mt-1 text-xs text-foreground-muted">
          Vous pourrez en créer d'autres ensuite selon votre formule.
        </p>
      </div>

      {/* Email de connexion */}
      <div>
        <label htmlFor="email" className="block text-sm font-medium leading-6 text-foreground flex items-center gap-1.5 mb-1">
          <Mail className="w-4 h-4 text-primary" />
          {t.email || 'Adresse e-mail (connexion)'} <span className="text-danger">*</span>
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="contact@votre-boutique.com"
          required
          className={inputClass}
        />
      </div>

      {/* Mot de passe */}
      <div>
        <label htmlFor="password" className="block text-sm font-medium leading-6 text-foreground flex items-center gap-1.5 mb-1">
          <Lock className="w-4 h-4 text-primary" />
          {t.password || 'Mot de passe'} <span className="text-danger">*</span>
        </label>
        <div className="relative">
          <input
            id="password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            placeholder="••••••••"
            required
            minLength={6}
            className={`${inputClass} pr-10`}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute inset-y-0 right-0 flex items-center pr-3 text-foreground-muted hover:text-foreground"
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <div className="pt-2">
        <SubmitButton dict={dict} />
      </div>
    </form>
  )
}
