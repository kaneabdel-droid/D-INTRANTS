import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

function insist(res, msg) {
  if (res.error) throw new Error(`${msg}: ${res.error.message}`)
  return res.data
}

function daysAgo(d) {
  const date = new Date()
  date.setDate(date.getDate() - d)
  return date.toISOString()
}

async function reglerCreance(supabase, { creanceId, montant, compteTresorerieId, magasinId, utilisateurId, date }) {
  const creance = insist(await supabase.from('creances').select('montant_restant').eq('id', creanceId).single(), 'select creance')
  const nouveauRestant = Number(creance.montant_restant) - montant
  insist(
    await supabase
      .from('creances')
      .update({ montant_restant: nouveauRestant, statut: nouveauRestant <= 0 ? 'soldee' : 'en_cours' })
      .eq('id', creanceId),
    'update creance'
  )
  insist(
    await supabase.from('journal_tresorerie').insert({
      magasin_id: magasinId,
      compte_tresorerie_id: compteTresorerieId,
      type_mouvement: 'entree',
      montant,
      categorie: 'reglement_creance',
      reference_id: creanceId,
      reference_type: 'creance',
      motif: 'Règlement créance',
      utilisateur_id: utilisateurId,
      date_mouvement: date,
    }),
    'insert journal (reglement_creance)'
  )
}

async function reglerDette(supabase, { detteId, montant, compteTresorerieId, magasinId, utilisateurId, date }) {
  const dette = insist(await supabase.from('dettes').select('montant_restant').eq('id', detteId).single(), 'select dette')
  const nouveauRestant = Number(dette.montant_restant) - montant
  insist(
    await supabase
      .from('dettes')
      .update({ montant_restant: nouveauRestant, statut: nouveauRestant <= 0 ? 'soldee' : 'en_cours' })
      .eq('id', detteId),
    'update dette'
  )
  insist(
    await supabase.from('journal_tresorerie').insert({
      magasin_id: magasinId,
      compte_tresorerie_id: compteTresorerieId,
      type_mouvement: 'sortie',
      montant,
      categorie: 'reglement_dette',
      reference_id: detteId,
      reference_type: 'dette',
      motif: 'Règlement dette',
      utilisateur_id: utilisateurId,
      date_mouvement: date,
    }),
    'insert journal (reglement_dette)'
  )
}

async function main() {
  console.log('Fetching context for step 11 & 12...')

  const magasins = insist(await supabase.from('magasins').select('id, nom').order('nom'), 'magasins')
  const mag1 = magasins.find(m => m.nom === 'SUNUIntrants1')
  const mag2 = magasins.find(m => m.nom === 'SUNUIntrants2')

  const { data: usersData } = await supabase.auth.admin.listUsers()
  const users = usersData.users
  const gerant1 = users.find(u => u.email === 'gerant1@sunuintrants.sn')
  const gerant2 = users.find(u => u.email === 'gerant2@sunuintrants.sn')

  const comptes = insist(await supabase.from('comptes_tresorerie').select('id, nom, magasin_id'), 'comptes')
  const comptes1 = {
    caisse: comptes.find(c => c.magasin_id === mag1.id && c.nom.includes('Caisse')).id,
    mobileMoney: comptes.find(c => c.magasin_id === mag1.id && c.nom.includes('Mobile')).id
  }
  const comptes2 = {
    caisse: comptes.find(c => c.magasin_id === mag2.id && c.nom.includes('Caisse')).id,
    mobileMoney: comptes.find(c => c.magasin_id === mag2.id && c.nom.includes('Mobile')).id
  }

  const clients = insist(await supabase.from('clients').select('id, nom'), 'clients')
  
  // Find creances
  const allCreances = insist(await supabase.from('creances').select('id, client_id, statut, magasin_id').eq('statut', 'en_cours'), 'creances')
  const creances1 = {}
  const creances2 = {}
  
  allCreances.forEach(c => {
    const client = clients.find(cl => cl.id === c.client_id)
    if (c.magasin_id === mag1.id) {
      creances1[client.nom] = creances1[client.nom] || []
      creances1[client.nom].push(c.id)
    } else {
      creances2[client.nom] = creances2[client.nom] || []
      creances2[client.nom].push(c.id)
    }
  })

  // Dettes
  const dettes1 = insist(await supabase.from('dettes').select('id, montant_restant').eq('magasin_id', mag1.id), 'dettes1')
  const dettes2 = insist(await supabase.from('dettes').select('id, montant_restant').eq('magasin_id', mag2.id), 'dettes2')

  console.log('11. Règlements (créances & dettes)...')
  
  if (creances1['Fatou Diop']) {
    await reglerCreance(supabase, { creanceId: creances1['Fatou Diop'][0], montant: 7000, compteTresorerieId: comptes1.mobileMoney, magasinId: mag1.id, utilisateurId: gerant1.id, date: daysAgo(8) })
  }
  if (creances1['Entreprise Sarr & Fils BTP']) {
    await reglerCreance(supabase, { creanceId: creances1['Entreprise Sarr & Fils BTP'][0], montant: 50000, compteTresorerieId: comptes1.caisse, magasinId: mag1.id, utilisateurId: gerant1.id, date: daysAgo(5) })
  }
  if (dettes1 && dettes1[0]) {
    await reglerDette(supabase, { detteId: dettes1[0].id, montant: Math.min(80000, Number(dettes1[0].montant_restant)), compteTresorerieId: comptes1.caisse, magasinId: mag1.id, utilisateurId: gerant1.id, date: daysAgo(6) })
  }

  if (creances2['Ibrahima Kane']) {
    await reglerCreance(supabase, { creanceId: creances2['Ibrahima Kane'][0], montant: 32000, compteTresorerieId: comptes2.mobileMoney, magasinId: mag2.id, utilisateurId: gerant2.id, date: daysAgo(8) })
  }
  if (creances2['Aïssatou Sow BTP']) {
    await reglerCreance(supabase, { creanceId: creances2['Aïssatou Sow BTP'][0], montant: 100000, compteTresorerieId: comptes2.caisse, magasinId: mag2.id, utilisateurId: gerant2.id, date: daysAgo(5) })
  }
  if (dettes2 && dettes2[0]) {
    await reglerDette(supabase, { detteId: dettes2[0].id, montant: Math.min(60000, Number(dettes2[0].montant_restant)), compteTresorerieId: comptes2.caisse, magasinId: mag2.id, utilisateurId: gerant2.id, date: daysAgo(6) })
  }

  console.log('12. Charges...')
  async function creerCharge(magasinId, compteTresorerieId, utilisateurId, categorie, libelle, montant, jour, recurrente) {
    const dateCharge = daysAgo(jour).slice(0, 10)
    // Avoid creating duplicate charges if script is re-run
    const existing = await supabase.from('charges').select('id').eq('magasin_id', magasinId).eq('libelle', libelle).limit(1)
    if (existing.data && existing.data.length > 0) return

    insist(
      await supabase.from('charges').insert({ magasin_id: magasinId, compte_tresorerie_id: compteTresorerieId, categorie, libelle, montant, date_charge: dateCharge, recurrente, utilisateur_id: utilisateurId }),
      `insert charge ${libelle}`
    )
    insist(
      await supabase.from('journal_tresorerie').insert({
        magasin_id: magasinId,
        compte_tresorerie_id: compteTresorerieId,
        type_mouvement: 'sortie',
        montant,
        categorie: 'charge',
        motif: libelle,
        utilisateur_id: utilisateurId,
        date_mouvement: daysAgo(jour),
      }),
      `insert journal (charge ${libelle})`
    )
  }

  await creerCharge(mag1.id, comptes1.caisse, gerant1.id, 'loyer', 'Loyer mensuel boutique', 75000, 28, true)
  await creerCharge(mag1.id, comptes1.caisse, gerant1.id, 'electricite', 'Facture électricité', 15000, 14, true)
  await creerCharge(mag1.id, comptes1.caisse, gerant1.id, 'transport', 'Transport marchandises', 12000, 4, false)

  await creerCharge(mag2.id, comptes2.caisse, gerant2.id, 'loyer', 'Loyer mensuel boutique', 60000, 28, true)
  await creerCharge(mag2.id, comptes2.caisse, gerant2.id, 'electricite', 'Facture électricité', 12000, 14, true)
  await creerCharge(mag2.id, comptes2.caisse, gerant2.id, 'transport', 'Transport marchandises', 9000, 4, false)

  console.log('\n✅ Script step 11 & 12 terminé avec succès.')
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
