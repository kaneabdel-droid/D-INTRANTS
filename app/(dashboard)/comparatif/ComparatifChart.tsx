'use client'

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LabelList } from 'recharts'

type Ligne = { magasin_nom: string; ca: number; marge_brute: number; excedent_brut: number }

// Palette validée (node scripts/validate_palette.js) : CA en vert clair
// (--primary-hover), marge brute en ocre (--secondary) — la paire passe les
// contrôles de contraste/luminosité/chroma avec un WARN sur la séparation
// daltonisme (ΔE 7.8, dans la fourchette 6-8 légale uniquement avec un
// encodage secondaire) ; les valeurs sont donc aussi affichées en clair sur
// chaque barre (LabelList) pour ne jamais reposer sur la seule couleur.
const COULEUR_CA = '#2F855A'
const COULEUR_MARGE = '#D97706'
// Excédent brut d'exploitation : bleu, distinct du vert et de l'ocre ; comme pour les autres séries,
// la valeur est écrite sur chaque barre (LabelList).
const COULEUR_EXCEDENT = '#2B6CB0'

function formatMontant(value: unknown) {
  return Number(value ?? 0).toLocaleString('fr-FR')
}

export default function ComparatifChart({ data, labelCa, labelMarge, labelExcedent }: { data: Ligne[]; labelCa?: string; labelMarge?: string; labelExcedent?: string }) {
  return (
    <div style={{ width: '100%', height: 360 }}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 20, right: 16, left: 0, bottom: 0 }} barGap={2}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--surface-border)" vertical={false} />
          <XAxis dataKey="magasin_nom" tick={{ fill: 'var(--foreground-muted)', fontSize: 12 }} axisLine={{ stroke: 'var(--surface-border)' }} tickLine={false} />
          <YAxis tick={{ fill: 'var(--foreground-muted)', fontSize: 12 }} axisLine={false} tickLine={false} width={70} tickFormatter={formatMontant} />
          <Tooltip
            formatter={(value) => formatMontant(value)}
            contentStyle={{ background: 'var(--surface)', border: '1px solid var(--surface-border)', borderRadius: 8, fontSize: 13 }}
            labelStyle={{ color: 'var(--foreground)', fontWeight: 600 }}
          />
          <Legend wrapperStyle={{ fontSize: 13, color: 'var(--foreground-muted)' }} />
          <Bar dataKey="ca" name={labelCa ?? "Chiffre d'affaires"} fill={COULEUR_CA} radius={[4, 4, 0, 0]} maxBarSize={48}>
            <LabelList dataKey="ca" position="top" formatter={formatMontant} style={{ fill: 'var(--foreground-muted)', fontSize: 11 }} />
          </Bar>
          <Bar dataKey="marge_brute" name={labelMarge ?? 'Marge brute'} fill={COULEUR_MARGE} radius={[4, 4, 0, 0]} maxBarSize={48}>
            <LabelList dataKey="marge_brute" position="top" formatter={formatMontant} style={{ fill: 'var(--foreground-muted)', fontSize: 11 }} />
          </Bar>
          <Bar dataKey="excedent_brut" name={labelExcedent ?? "Excédent brut d'exploitation"} fill={COULEUR_EXCEDENT} radius={[4, 4, 0, 0]} maxBarSize={48}>
            <LabelList dataKey="excedent_brut" position="top" formatter={formatMontant} style={{ fill: 'var(--foreground-muted)', fontSize: 11 }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
