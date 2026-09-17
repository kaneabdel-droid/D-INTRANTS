'use client'

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

type Point = { date: string; historique: number | null; projection: number | null }

// Une seule grandeur (le CA) rendue en deux segments : trait plein pour
// l'historique, pointillé pour la projection — pas une palette catégorielle,
// donc pas de contrôle CVD à faire ici (cf. dataviz skill : la règle ne
// s'applique qu'aux palettes catégorielles/séquentielles/divergentes).
const COULEUR = '#2F855A'

function formatMontant(value: unknown) {
  return Number(value ?? 0).toLocaleString('fr-FR')
}

export default function VentesTrendChart({ data, labelVentes, labelProjection }: { data: Point[]; labelVentes?: string; labelProjection?: string }) {
  return (
    <div style={{ width: '100%', height: 300 }}>
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="ventesGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={COULEUR} stopOpacity={0.25} />
              <stop offset="100%" stopColor={COULEUR} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--surface-border)" vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fill: 'var(--foreground-muted)', fontSize: 11 }}
            axisLine={{ stroke: 'var(--surface-border)' }}
            tickLine={false}
            minTickGap={24}
          />
          <YAxis tick={{ fill: 'var(--foreground-muted)', fontSize: 12 }} axisLine={false} tickLine={false} width={60} tickFormatter={formatMontant} />
          <Tooltip
            formatter={(value) => formatMontant(value)}
            contentStyle={{ background: 'var(--surface)', border: '1px solid var(--surface-border)', borderRadius: 8, fontSize: 13 }}
            labelStyle={{ color: 'var(--foreground)', fontWeight: 600 }}
          />
          <Legend wrapperStyle={{ fontSize: 13, color: 'var(--foreground-muted)' }} />
          <Area type="monotone" dataKey="historique" name={labelVentes ?? 'Ventes'} stroke={COULEUR} strokeWidth={2} fill="url(#ventesGradient)" connectNulls={false} dot={false} />
          <Area type="monotone" dataKey="projection" name={labelProjection ?? 'Projection'} stroke={COULEUR} strokeWidth={2} strokeDasharray="5 4" fill="transparent" connectNulls dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
