'use client'

import { useState, useTransition } from 'react'
import { PALIERS, DUREES, calculerMontantFcfa, type PalierCode, type DureeMois } from '@/lib/abonnements/paliers'
import { upsertChariowProduit, supprimerChariowProduit } from './actions'

type Produit = { palier: string; duree_mois: number; product_id: string }

export default function ChariowProduitsEditor({ produits }: { produits: Produit[] }) {
  const [valeurs, setValeurs] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {}
    for (const p of produits) init[`${p.palier}_${p.duree_mois}`] = p.product_id
    return init
  })
  const [isPending, startTransition] = useTransition()
  const [message, setMessage] = useState<string | null>(null)

  const cle = (palier: PalierCode, dureeMois: DureeMois) => `${palier}_${dureeMois}`

  const enregistrer = (palier: PalierCode, dureeMois: DureeMois) => {
    const productId = (valeurs[cle(palier, dureeMois)] ?? '').trim()
    setMessage(null)
    startTransition(async () => {
      const result = productId
        ? await upsertChariowProduit(palier, dureeMois, productId)
        : await supprimerChariowProduit(palier, dureeMois)
      if (result.error) setMessage(`Erreur : ${result.error}`)
    })
  }

  return (
    <div>
      <p className="text-sm text-foreground-muted mb-4">
        Chariow débite le prix d&apos;un produit préconfiguré dans sa boutique — un produit par combinaison palier × durée.
        Laisser un champ vide et enregistrer pour retomber sur la variable d&apos;environnement correspondante.
      </p>

      {message && <p className="text-sm text-danger mb-3">{message}</p>}

      <table className="w-full text-sm">
        <thead className="text-foreground-muted text-left">
          <tr>
            <th className="py-2 font-medium">Palier</th>
            <th className="py-2 font-medium">Durée</th>
            <th className="py-2 font-medium">Prix</th>
            <th className="py-2 font-medium">Product ID Chariow</th>
            <th className="py-2 font-medium"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-surface-border">
          {(Object.keys(PALIERS) as PalierCode[]).map((palier) =>
            DUREES.map((d) => {
              const k = cle(palier, d.mois)
              return (
                <tr key={k}>
                  <td className="py-2">{PALIERS[palier].nom}</td>
                  <td className="py-2">{d.label}</td>
                  <td className="py-2 text-foreground-muted">{calculerMontantFcfa(palier, d.mois).toLocaleString('fr-FR')} FCFA</td>
                  <td className="py-2">
                    <input
                      type="text"
                      value={valeurs[k] ?? ''}
                      onChange={(e) => setValeurs((prev) => ({ ...prev, [k]: e.target.value }))}
                      placeholder="product_id"
                      disabled={isPending}
                      className="w-full rounded-md border border-surface-border bg-surface px-2 py-1.5 text-xs font-mono"
                    />
                  </td>
                  <td className="py-2">
                    <button
                      disabled={isPending}
                      onClick={() => enregistrer(palier, d.mois)}
                      className="rounded-md bg-primary text-white px-3 py-1.5 text-xs font-medium disabled:opacity-50"
                    >
                      Enregistrer
                    </button>
                  </td>
                </tr>
              )
            })
          )}
        </tbody>
      </table>
    </div>
  )
}
