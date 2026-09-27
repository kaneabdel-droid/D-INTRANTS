import { NextRequest, NextResponse } from 'next/server'
import crypto from 'node:crypto'
import { createAdminClient } from '@/utils/supabase/admin'

export const runtime = 'nodejs'

// Un compte de trésorerie mobile_money par boutique porte sa propre clé
// (comptes_tresorerie.cle_webhook, cf. migration 20260927150000) : n'importe
// quel gérant peut en configurer un, donc le secret ne peut pas être une
// simple variable d'environnement partagée par toute l'application.
function comparaisonConstante(a: string, b: string): boolean {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  return bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB)
}

// Format générique attendu : celui qu'on demande de reproduire à un relais
// (app SMS→webhook, Pabbly, Make, Zapier) quand le fournisseur n'a pas de
// webhook marchand natif — cf. l'exemple affiché dans WebhookCompteButton.
type CorpsGenerique = {
  montant?: number | string
  reference?: string
  expediteur?: string
  libelle?: string
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ compteId: string }> }) {
  const { compteId } = await params
  const secretRecu = req.nextUrl.searchParams.get('secret') ?? req.headers.get('x-webhook-secret')
  if (!secretRecu) {
    return NextResponse.json({ error: 'secret manquant' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const { data: compte } = await supabase
    .from('comptes_tresorerie')
    .select('id, magasin_id, type_compte, cle_webhook')
    .eq('id', compteId)
    .maybeSingle()

  if (!compte || compte.type_compte !== 'mobile_money' || !compte.cle_webhook) {
    // Message volontairement identique à celui d'un secret invalide, pour ne
    // pas laisser deviner de l'extérieur qu'un compte existe ou non.
    return NextResponse.json({ error: 'secret invalide' }, { status: 401 })
  }
  if (!comparaisonConstante(secretRecu, compte.cle_webhook)) {
    return NextResponse.json({ error: 'secret invalide' }, { status: 401 })
  }

  let corps: CorpsGenerique
  try {
    corps = await req.json()
  } catch {
    return NextResponse.json({ received: true, ignored: true })
  }

  const montant = Number(corps.montant)
  const reference = (corps.reference ?? '').toString().trim()
  if (!Number.isFinite(montant) || montant <= 0 || !reference) {
    return NextResponse.json({ error: 'montant et reference requis' }, { status: 400 })
  }

  const motif = [corps.libelle, corps.expediteur ? `de ${corps.expediteur}` : null].filter(Boolean).join(' ') || 'Encaissement mobile money'

  const { error } = await supabase.from('journal_tresorerie').insert({
    magasin_id: compte.magasin_id,
    compte_tresorerie_id: compte.id,
    type_mouvement: 'entree',
    montant,
    categorie: 'mobile_money',
    reference_type: 'mobile_money',
    reference_externe: reference,
    motif,
  })

  // Code 23505 = violation de l'index unique (compte, reference_externe) :
  // un webhook rejoué (retry réseau côté fournisseur/relais) n'est pas une
  // erreur, l'écriture existe déjà — on répond "reçu" sans la dupliquer.
  if (error && (error as { code?: string }).code !== '23505') {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
