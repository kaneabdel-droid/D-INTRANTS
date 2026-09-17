'use client'

import { useRef, useState } from 'react'
import Image from 'next/image'
import { Building2, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { DEVISES, type DeviseCode } from '@/lib/currency'
import type { Dictionary } from '@/dictionaries'
import { updateEntrepriseInfos, uploadLogo } from './actions'

type Entreprise = {
  nom: string
  adresse: string
  telephone: string
  email: string
  identification: string
  devise: string
  logoUrl: string | null
}

export default function ParametresForm({ entreprise, dict }: { entreprise: Entreprise; dict: Dictionary }) {
  const t = dict.parametres
  const c = dict.common
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [logoUrl, setLogoUrl] = useState(entreprise.logoUrl)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function handleSubmit(formData: FormData) {
    setSaving(true)
    setError(null)
    const res = await updateEntrepriseInfos(formData)
    setSaving(false)
    if (res?.error) setError(res.error)
    else toast.success(t.saved)
  }

  async function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    const formData = new FormData()
    formData.set('logo', file)
    const res = await uploadLogo(formData)
    setUploading(false)
    if (res?.error) toast.error(res.error)
    else {
      if (res?.logoUrl) setLogoUrl(res.logoUrl)
      toast.success(t.logoSaved)
    }
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <div className="max-w-2xl space-y-8">
      <div className="rounded-xl border border-surface-border bg-surface p-6">
        <h2 className="font-semibold text-foreground mb-4">{t.logoTitle}</h2>
        <div className="flex items-center gap-4">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-surface-border bg-background">
            {logoUrl ? (
              <Image src={logoUrl} alt={t.logoTitle} width={80} height={80} className="h-full w-full object-contain" unoptimized />
            ) : (
              <Building2 className="h-8 w-8 text-foreground-muted" />
            )}
          </div>
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleLogoChange}
              disabled={uploading}
              className="hidden"
              id="logo-input"
            />
            <label
              htmlFor="logo-input"
              className="inline-flex cursor-pointer items-center gap-2 rounded-md bg-surface border border-surface-border px-3 py-2 text-sm font-medium text-foreground hover:bg-background disabled:opacity-50"
            >
              <Upload className="h-4 w-4" /> {uploading ? t.uploading : logoUrl ? t.changeLogo : t.addLogo}
            </label>
            <p className="mt-1 text-xs text-foreground-muted">{t.logoHint}</p>
          </div>
        </div>
      </div>

      <form action={handleSubmit} className="rounded-xl border border-surface-border bg-surface p-6 space-y-4">
        <h2 className="font-semibold text-foreground mb-2">{t.generalInfo}</h2>
        {error && <p className="text-sm text-danger">{error}</p>}

        <div>
          <label className="block text-sm font-medium text-foreground">{t.companyName}</label>
          <input name="nom" type="text" required defaultValue={entreprise.nom} className="mt-1 block w-full rounded-md bg-background border border-surface-border text-foreground px-3 py-2" />
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground">{c.address}</label>
          <input name="adresse" type="text" defaultValue={entreprise.adresse} className="mt-1 block w-full rounded-md bg-background border border-surface-border text-foreground px-3 py-2" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-foreground">{c.phone}</label>
            <input name="telephone" type="text" defaultValue={entreprise.telephone} className="mt-1 block w-full rounded-md bg-background border border-surface-border text-foreground px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground">{t.email}</label>
            <input name="email" type="email" defaultValue={entreprise.email} className="mt-1 block w-full rounded-md bg-background border border-surface-border text-foreground px-3 py-2" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground">{t.identification}</label>
          <input name="identification" type="text" defaultValue={entreprise.identification} placeholder={t.identificationPlaceholder} className="mt-1 block w-full rounded-md bg-background border border-surface-border text-foreground px-3 py-2" />
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground">{t.currency}</label>
          <select name="devise" defaultValue={entreprise.devise} className="mt-1 block w-full rounded-md bg-background border border-surface-border text-foreground px-3 py-2">
            {(Object.keys(DEVISES) as DeviseCode[]).map((code) => (
              <option key={code} value={code}>{DEVISES[code].label}</option>
            ))}
          </select>
          <p className="mt-1 text-xs text-foreground-muted">{t.currencyHint}</p>
        </div>

        <div className="pt-2">
          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-hover disabled:opacity-50"
          >
            {saving ? c.saving : c.save}
          </button>
        </div>
      </form>
    </div>
  )
}
