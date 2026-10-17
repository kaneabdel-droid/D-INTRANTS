import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { getCurrentUserContext } from '@/lib/auth/getCurrentUserContext'

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    online: true,
    app: 'd-intrants',
    timestamp: Date.now()
  })
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const context = await getCurrentUserContext()
    const body = await req.json()
    const actions: any[] = body.actions || []

    const syncedIds: string[] = []
    const failures: { id: string; error: string; label?: string }[] = []

    for (const act of actions) {
      try {
        const { id, actionType, payload, label } = act

        if (actionType === 'creer_vente') {
          const { clientId, modePaiement, montantPaye, lignes } = payload
          const { data, error } = await supabase.rpc('creer_vente', {
            p_magasin_id: context.magasinId,
            p_client_id: clientId || null,
            p_mode_paiement: modePaiement || 'comptant',
            p_montant_paye: montantPaye || 0,
            p_lignes: lignes || []
          })

          if (error) {
            failures.push({ id, label, error: error.message })
          } else {
            syncedIds.push(id)
          }
        } else if (actionType === 'creer_client') {
          const { error } = await supabase.from('clients').insert({
            ...payload,
            magasin_id: context.magasinId,
            entreprise_id: context.entrepriseId
          })
          if (error) failures.push({ id, label, error: error.message })
          else syncedIds.push(id)
        } else if (actionType === 'ajouter_charge') {
          const { error } = await supabase.from('charges').insert({
            ...payload,
            magasin_id: context.magasinId,
            entreprise_id: context.entrepriseId
          })
          if (error) failures.push({ id, label, error: error.message })
          else syncedIds.push(id)
        } else if (actionType === 'creer_article') {
          const { error } = await supabase.from('articles').insert({
            ...payload,
            entreprise_id: context.entrepriseId
          })
          if (error) failures.push({ id, label, error: error.message })
          else syncedIds.push(id)
        } else {
          syncedIds.push(id)
        }
      } catch (err: any) {
        failures.push({ id: act.id, label: act.label, error: err?.message || 'Erreur traitement action' })
      }
    }

    return NextResponse.json({
      success: true,
      syncedIds,
      failures
    })
  } catch (globalErr: any) {
    return NextResponse.json({
      error: globalErr?.message || 'Erreur serveur synchronisation'
    }, { status: 500 })
  }
}
