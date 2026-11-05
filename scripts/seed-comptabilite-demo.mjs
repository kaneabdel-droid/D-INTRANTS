import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { DEMO_PLAN_COMPTABLE, DEMO_ECRITURES_INTRANTS } from '../lib/comptabilite/demoData.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const envContent = readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8')
const env = {}
for (const line of envContent.split('\n')) {
  const idx = line.indexOf('=')
  if (idx > 0) {
    env[line.slice(0, idx).trim()] = line.slice(idx + 1).trim().replace(/^"|"$/g, '')
  }
}

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
})

async function main() {
  console.log('⚡ Initialisation Comptabilité Démo D-INTRANTS...')

  // 1. Mise à jour de l’entreprise démo vers Premium Plus
  const { data: ent, error: entErr } = await supabase
    .from('entreprises')
    .update({ palier: 'premium_plus' })
    .eq('nom', 'SUNUIntrants')
    .select('id, nom, palier')

  console.log('1. Entreprise mise à jour :', ent, entErr ? entErr.message : 'OK (palier: premium_plus)')

  if (!ent || ent.length === 0) {
    console.log('⚠️ Aucune entreprise SUNUIntrants trouvée.')
    process.exit(0)
  }

  const entrepriseId = ent[0].id

  // 2. Exercice 2026
  const { data: exo, error: exoErr } = await supabase
    .from('exercices_comptables')
    .upsert(
      {
        entreprise_id: entrepriseId,
        libelle: 'Exercice 2026',
        date_debut: '2026-01-01',
        date_fin: '2026-12-31',
        cloture: false,
      },
      { onConflict: 'entreprise_id,libelle' }
    )
    .select('id')
    .single()

  if (exoErr) {
    console.log('Table exercices_comptables non accessible ou attente migration :', exoErr.message)
    process.exit(0)
  }

  const exerciceId = exo.id
  console.log('2. Exercice 2026 configuré :', exerciceId)

  // 3. Plan comptable
  const planRows = DEMO_PLAN_COMPTABLE.map((p) => ({
    ...p,
    entreprise_id: entrepriseId,
  }))
  await supabase.from('plan_comptable').upsert(planRows, { onConflict: 'compte,entreprise_id' })
  console.log('3. Plan comptable SYSCOHADA préchargé.')

  // 4. Écritures comptables
  for (const ec of DEMO_ECRITURES_INTRANTS) {
    const { data: insEc } = await supabase
      .from('ecritures_comptables')
      .insert({
        entreprise_id: entrepriseId,
        exercice_id: exerciceId,
        journal: ec.journal,
        date_ecriture: ec.date_ecriture,
        numero_piece: ec.numero_piece,
        libelle: ec.libelle,
        source_module: ec.source_module,
        validee: true,
      })
      .select('id')
      .single()

    if (insEc) {
      const lignes = ec.lignes_ecritures_comptables.map((l) => ({
        ecriture_id: insEc.id,
        entreprise_id: entrepriseId,
        compte: l.compte,
        libelle: l.libelle,
        debit: l.debit,
        credit: l.credit,
      }))
      await supabase.from('lignes_ecritures_comptables').insert(lignes)
    }
  }

  console.log(`4. ${DEMO_ECRITURES_INTRANTS.length} écritures comptables insérées avec succès.`)
  console.log('✅ Démo comptabilité D-INTRANTS prête !')
  process.exit(0)
}

main().catch((err) => {
  console.error('Erreur:', err)
  process.exit(1)
})
