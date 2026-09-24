'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { MODULES, type ActionPermission, type Matrice } from '@/lib/permissions'
import type { Dictionary } from '@/dictionaries'
import { enregistrerPermissions } from './actions'

const ACTIONS: { cle: ActionPermission; libelle: string }[] = [
  { cle: 'lire', libelle: 'Lecture' },
  { cle: 'ecrire', libelle: 'Écriture' },
  { cle: 'modifier', libelle: 'Modification' },
]

/** true = coché (autorisé), y compris quand rien n'est encore enregistré (comportement par défaut). */
function estAutorise(matrice: Matrice, href: string, action: ActionPermission): boolean {
  return matrice[href]?.[action] !== false
}

export default function PermissionsForm({ matriceInitiale, dict }: { matriceInitiale: Matrice; dict: Dictionary }) {
  const t = dict.permissions
  const nav = dict.nav
  const [matrice, setMatrice] = useState<Matrice>(matriceInitiale)
  const [pending, startTransition] = useTransition()

  function basculer(href: string, action: ActionPermission) {
    setMatrice((m) => ({ ...m, [href]: { ...m[href], [action]: !estAutorise(m, href, action) } }))
  }

  function toutAutoriser() {
    const suivant: Matrice = {}
    for (const mod of MODULES) suivant[mod.href] = { lire: true, ecrire: true, modifier: true }
    setMatrice(suivant)
  }

  function enregistrer() {
    startTransition(async () => {
      const res = await enregistrerPermissions(matrice)
      if (res?.error) toast.error(res.error)
      else toast.success(t.saved)
    })
  }

  return (
    <div className="rounded-xl border border-surface-border bg-surface p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold text-foreground">{t.title}</h2>
          <p className="mt-1 text-sm text-foreground-muted">{t.subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={toutAutoriser} className="text-xs font-medium text-primary underline">
            {t.allowAll}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={enregistrer}
            className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-50"
          >
            {pending ? t.saving : t.save}
          </button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-surface-border">
              <th className="py-2 pr-3 text-left font-semibold text-foreground">{t.module}</th>
              {ACTIONS.map((a) => (
                <th key={a.cle} className="px-3 py-2 text-center font-semibold text-foreground">
                  {t[a.cle]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {MODULES.map((mod) => (
              <tr key={mod.href} className="border-b border-surface-border last:border-0">
                <td className="py-2 pr-3 text-foreground">{nav[mod.cle as keyof typeof nav]}</td>
                {ACTIONS.map((a) => (
                  <td key={a.cle} className="px-3 py-2 text-center">
                    <input
                      type="checkbox"
                      checked={estAutorise(matrice, mod.href, a.cle)}
                      onChange={() => basculer(mod.href, a.cle)}
                      className="h-4 w-4"
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
