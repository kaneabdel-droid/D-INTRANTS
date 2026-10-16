'use server'

import { createClient } from '@/utils/supabase/server'
import { getCurrentUserContext } from '@/lib/auth/getCurrentUserContext'
import { revalidatePath } from 'next/cache'

export async function importerDonneesIntrants(typeId: string, records: any[]) {
  const context = await getCurrentUserContext()
  if (!context?.entrepriseId) return { succes: 0, erreurs: records.length, details: ['Session ou entreprise introuvable.'] }

  const supabase = await createClient()
  const entrepriseId = context.entrepriseId
  let magasinId = context.magasinId

  if (!magasinId) {
    const { data: mag } = await supabase.from('magasins').select('id').eq('entreprise_id', entrepriseId).order('created_at').limit(1).maybeSingle()
    magasinId = mag?.id || null
  }

  let succes = 0
  let erreurs = 0
  const details: string[] = []

  if (typeId === 'articles') {
    for (const item of records) {
      try {
        const designation = (item.designation || item.nom || item.libelle || '').trim()
        if (!designation) {
          erreurs++
          details.push('Ligne ignorée : désignation intrant manquante')
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
          const { data: catEx } = await supabase.from('categories').select('id').eq('entreprise_id', entrepriseId).ilike('nom', nomCat).maybeSingle()
          if (catEx) {
            categorieId = catEx.id
          } else {
            const { data: newCat } = await supabase.from('categories').insert({ entreprise_id: entrepriseId, nom: nomCat }).select('id').single()
            if (newCat) categorieId = newCat.id
          }
        }

        // Article
        let articleId = null
        if (reference) {
          const { data: artEx } = await supabase.from('articles').select('id').eq('entreprise_id', entrepriseId).eq('reference', reference).maybeSingle()
          if (artEx) articleId = artEx.id
        }
        if (!articleId) {
          const { data: artNomEx } = await supabase.from('articles').select('id').eq('entreprise_id', entrepriseId).ilike('designation', designation).maybeSingle()
          if (artNomEx) articleId = artNomEx.id
        }

        if (!articleId) {
          const { data: newArt, error: errArt } = await supabase.from('articles').insert({
            entreprise_id: entrepriseId,
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
            motif: 'Import initial stock intrants'
          })
        }

        succes++
      } catch (e: any) {
        erreurs++
        details.push(`Erreur sur "${item.designation || 'intrant'}" : ${e.message}`)
      }
    }
    revalidatePath('/articles')
    revalidatePath('/stock')
  } else if (typeId === 'fournisseurs') {
    for (const item of records) {
      try {
        const nom = (item.nom || item.fournisseur || '').trim()
        if (!nom) {
          erreurs++
          continue
        }
        const { error } = await supabase.from('fournisseurs').insert({
          entreprise_id: entrepriseId,
          nom,
          telephone: (item.telephone || '').trim() || null,
          adresse: (item.adresse || '').trim() || null
        })
        if (error) throw error
        succes++
      } catch (e: any) {
        erreurs++
        details.push(`Erreur fournisseur "${item.nom}" : ${e.message}`)
      }
    }
    revalidatePath('/fournisseurs')
  } else if (typeId === 'clients') {
    if (!magasinId) {
      return { succes: 0, erreurs: records.length, details: ['Aucun magasin configuré pour rattacher les clients.'] }
    }
    for (const item of records) {
      try {
        const nom = (item.nom || item.client || '').trim()
        if (!nom) {
          erreurs++
          continue
        }
        const { error } = await supabase.from('clients').insert({
          entreprise_id: entrepriseId,
          magasin_id: magasinId,
          nom,
          telephone: (item.telephone || '').trim() || null,
          adresse: (item.adresse || '').trim() || null
        })
        if (error) throw error
        succes++
      } catch (e: any) {
        erreurs++
        details.push(`Erreur client "${item.nom}" : ${e.message}`)
      }
    }
    revalidatePath('/clients')
  }

  return { succes, erreurs, details }
}
