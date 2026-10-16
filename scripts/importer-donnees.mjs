#!/usr/bin/env node
/**
 * Agent CLI d'importation de données existantes pour D-INTRANTS
 * 
 * Usage :
 *   node scripts/importer-donnees.mjs --entreprise="Comptoir Agricole" --type=articles --fichier=./intrants.csv
 *   node scripts/importer-donnees.mjs --modele=articles
 *   node scripts/importer-donnees.mjs --modele=fournisseurs
 *   node scripts/importer-donnees.mjs --modele=clients
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const appRoot = path.resolve(__dirname, '..')

function chargerEnv() {
  const envPath = path.join(appRoot, '.env.local')
  if (fs.existsSync(envPath)) {
    const lignes = fs.readFileSync(envPath, 'utf8').split('\n')
    for (const ligne of lignes) {
      const idx = ligne.indexOf('=')
      if (idx > 0 && !ligne.trim().startsWith('#')) {
        const k = ligne.slice(0, idx).trim()
        const v = ligne.slice(idx + 1).trim()
        if (!process.env[k]) process.env[k] = v
      }
    }
  }
}
chargerEnv()

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceKey) {
  console.error('Erreur : NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont requis dans .env.local')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false }
})

const MODELES = {
  articles: `designation;reference;categorie;unite;prix_vente;quantite;seuil_alerte
Engrais NPK 15-15-15 sac 50kg;NPK-151515-50KG;Engrais minéraux;sac;19500;120;15
Urée 46% sac 50kg;UREE-46-50KG;Engrais azotés;sac;21000;100;10
Semence Maïs Hybride F1 sac 10kg;SEM-MAIS-F1-10KG;Semences certifiées;sac;12500;80;10
Semence Arachide 73-33 sac 50kg;SEM-ARACH-50KG;Semences certifiées;sac;24000;60;5
Insecticide Lambda-Cyhalothrine 1L;INS-LAMBDA-1L;Produits phytosanitaires;litre;7500;90;12
Pulvérisateur à dos 16L;PULV-16L;Matériel & Outillage;unite;18000;30;5`,

  fournisseurs: `nom;telephone;adresse
INDUSTRIES CHIMIQUES DU SÉNÉGAL (ICS);+221 33 849 00 00;Dakar, Sénégal
TROPICASEM SÉNÉGAL;+221 33 832 20 20;Zone Franche, Dakar
SEDAB SÉNÉGAL;+221 33 864 12 12;Route de Rufisque, Dakar`,

  clients: `nom;telephone;adresse
GIE Des Producteurs de Riz de Ross Béthio;+221 77 111 22 33;Ross Béthio, Saint-Louis
Coopérative Maraîchère des Niayes;+221 78 222 33 44;Notto Gouye Diama, Thiès
Amadou Diallo (Grand Exploitant);+221 76 333 44 55;Kolda Commune`
}

function parserCSV(contenu) {
  const texte = contenu.replace(/^\uFEFF/, '').trim()
  if (!texte) return []
  const delim = texte.indexOf(';') !== -1 ? ';' : ','
  const lignes = texte.split(/\r?\n/).filter(l => l.trim().length > 0)
  if (lignes.length < 2) return []

  const enTetes = lignes[0].split(delim).map(h => h.trim().replace(/^["']|["']$/g, '').toLowerCase())
  const resultats = []

  for (let i = 1; i < lignes.length; i++) {
    const rawCols = lignes[i].split(delim)
    const obj = {}
    enTetes.forEach((h, idx) => {
      const val = (rawCols[idx] ?? '').trim().replace(/^["']|["']$/g, '')
      obj[h] = val
    })
    resultats.push(obj)
  }
  return resultats
}

const args = Object.fromEntries(
  process.argv.slice(2).map(arg => {
    const [k, v] = arg.replace(/^--/, '').split('=')
    return [k, v ?? true]
  })
)

if (args.modele) {
  const type = String(args.modele).toLowerCase()
  if (!MODELES[type]) {
    console.error(`Modèle inconnu "${type}". Disponibles : ${Object.keys(MODELES).join(', ')}`)
    process.exit(1)
  }
  const nomFichier = `modele_import_intrants_${type}.csv`
  fs.writeFileSync(nomFichier, MODELES[type], 'utf8')
  console.log(`✓ Fichier modèle généré avec succès : ${nomFichier}`)
  process.exit(0)
}

async function executerImport() {
  const entrepriseCible = args.entreprise
  const type = (args.type || 'articles').toLowerCase()
  const cheminFichier = args.fichier

  if (!entrepriseCible || !cheminFichier) {
    console.log(`
Agent CLI d'Importation — D-INTRANTS
------------------------------------
Usage :
  node scripts/importer-donnees.mjs --entreprise="<ID_OU_NOM>" --type=<articles|fournisseurs|clients> --fichier=<chemin.csv>
  node scripts/importer-donnees.mjs --modele=<articles|fournisseurs|clients>
    `)
    process.exit(1)
  }

  if (!fs.existsSync(cheminFichier)) {
    console.error(`Fichier introuvable : ${cheminFichier}`)
    process.exit(1)
  }

  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(entrepriseCible)
  let requete = supabase.from('entreprises').select('id, nom')
  if (isUuid) {
    requete = requete.eq('id', entrepriseCible)
  } else {
    requete = requete.ilike('nom', `%${entrepriseCible}%`)
  }
  const { data: ents, error: errEnt } = await requete
  if (errEnt || !ents || ents.length === 0) {
    console.error(`Aucune entreprise d'intrants trouvée pour "${entrepriseCible}"`)
    process.exit(1)
  }
  const ent = ents[0]

  const { data: magasins } = await supabase.from('magasins').select('id, nom').eq('entreprise_id', ent.id).order('created_at')
  const magasinId = magasins?.[0]?.id || null

  console.log(`Entreprise identifiée : ${ent.nom} (${ent.id})`)
  if (magasinId) console.log(`Dépôt/Magasin principal : ${magasins[0].nom} (${magasinId})`)
  console.log(`Type d'import : ${type}`)

  const contenu = fs.readFileSync(cheminFichier, 'utf8')
  const records = cheminFichier.endsWith('.json') ? JSON.parse(contenu) : parserCSV(contenu)
  console.log(`Nombre de lignes détectées : ${records.length}`)

  let succes = 0
  let erreurs = 0

  if (type === 'articles') {
    for (const item of records) {
      try {
        const designation = (item.designation || item.nom || item.libelle || '').trim()
        if (!designation) {
          erreurs++
          continue
        }
        const reference = (item.reference || item.ref || '').trim() || null
        const unite = (item.unite || 'sac').trim()
        const prixVente = parseFloat(String(item.prix_vente || item.prix || '0').replace(',', '.')) || 0
        const seuilAlerte = parseFloat(String(item.seuil_alerte || '0').replace(',', '.')) || 0

        // Catégorie
        let categorieId = null
        const nomCat = (item.categorie || item.famille || '').trim()
        if (nomCat) {
          const { data: catEx } = await supabase.from('categories').select('id').eq('entreprise_id', ent.id).ilike('nom', nomCat).maybeSingle()
          if (catEx) {
            categorieId = catEx.id
          } else {
            const { data: newCat } = await supabase.from('categories').insert({ entreprise_id: ent.id, nom: nomCat }).select('id').single()
            if (newCat) categorieId = newCat.id
          }
        }

        // Article
        let articleId = null
        if (reference) {
          const { data: artEx } = await supabase.from('articles').select('id').eq('entreprise_id', ent.id).eq('reference', reference).maybeSingle()
          if (artEx) articleId = artEx.id
        }
        if (!articleId) {
          const { data: artNomEx } = await supabase.from('articles').select('id').eq('entreprise_id', ent.id).ilike('designation', designation).maybeSingle()
          if (artNomEx) articleId = artNomEx.id
        }

        if (!articleId) {
          const { data: newArt, error: errArt } = await supabase.from('articles').insert({
            entreprise_id: ent.id,
            categorie_id: categorieId,
            reference,
            designation,
            unite,
            prix_vente: prixVente,
            seuil_alerte: seuilAlerte,
            actif: true
          }).select('id').single()
          if (errArt) throw errArt
          articleId = newArt.id
        }

        // Stock initial
        const quantite = parseFloat(String(item.quantite || item.stock || '0').replace(',', '.')) || 0
        if (quantite > 0 && magasinId) {
          await supabase.from('mouvements_stock').insert({
            magasin_id: magasinId,
            article_id: articleId,
            type_mouvement: 'ajustement_positif',
            quantite,
            motif: 'Import initial stocks intrants'
          })
        }

        succes++
      } catch (e) {
        console.error(`Erreur intrant "${item.designation || item.nom}" :`, e.message)
        erreurs++
      }
    }
  } else if (type === 'fournisseurs') {
    for (const item of records) {
      try {
        const nom = (item.nom || item.fournisseur || '').trim()
        if (!nom) {
          erreurs++
          continue
        }
        const { error } = await supabase.from('fournisseurs').insert({
          entreprise_id: ent.id,
          nom,
          telephone: item.telephone || null,
          adresse: item.adresse || null
        })
        if (error) throw error
        succes++
      } catch (e) {
        console.error(`Erreur fournisseur "${item.nom}" :`, e.message)
        erreurs++
      }
    }
  } else if (type === 'clients') {
    if (!magasinId) {
      console.error('Aucun magasin trouvé pour lier les clients.')
      process.exit(1)
    }
    for (const item of records) {
      try {
        const nom = (item.nom || item.client || '').trim()
        if (!nom) {
          erreurs++
          continue
        }
        const { error } = await supabase.from('clients').insert({
          entreprise_id: ent.id,
          magasin_id: magasinId,
          nom,
          telephone: item.telephone || null,
          adresse: item.adresse || null
        })
        if (error) throw error
        succes++
      } catch (e) {
        console.error(`Erreur client "${item.nom}" :`, e.message)
        erreurs++
      }
    }
  }

  console.log(`\nImportation terminée pour ${ent.nom} :`)
  console.log(`✓ Lignes importées avec succès : ${succes}`)
  if (erreurs > 0) console.log(`✗ Échecs ou ignorées : ${erreurs}`)
}

executerImport()
