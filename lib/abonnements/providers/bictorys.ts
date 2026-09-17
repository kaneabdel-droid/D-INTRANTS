// Adaptateur Bictorys — construit d'après la skill izisaas mobile money
// (references/bictorys.md, examples/bictorys.ts), adapté d'un modèle BYOK à un
// compte plateforme unique (clé en variable d'environnement). PAS ENCORE ACTIF :
// en attente de BICTORYS_API_KEY — cf. lib/abonnements/registry.ts.
//
// ⚠️ Bictorys est derrière un WAF AWS qui bloque le fetch Node par défaut
// (empreinte TLS d'undici détectée comme bot) : on passe par un sous-processus
// curl avec des arguments minimaux. Ne pas ajouter de flags (-s, -A, --noproxy,
// Accept, User-Agent...) sous peine d'être re-détecté (cf. Chariow.md-like
// gotcha documenté dans la skill).
//
// ⚠️ Pas de re-pull fiable côté serveur : le WAF bloque aussi les appels de
// vérification. La réconciliation Bictorys ne passe donc QUE par un webhook
// dont la signature a été vérifiée — recupererStatut() retourne toujours null
// pour matérialiser cette impossibilité (voir lib/abonnements/reconcile.ts).

import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import crypto from 'node:crypto'
import type { AdaptateurPaiement, InitierPaiementParams, InitierPaiementResultat, StatutPaiementDistant, StatutProvider } from '../types'
import { versE164 } from '../telephone'

const execFileP = promisify(execFile)

const API_URL_LIVE = 'https://api.bictorys.com'
const API_URL_SANDBOX = 'https://api.test.bictorys.com'
const MAX_TENTATIVES_WAF = 3

function apiKey(): string {
  const key = process.env.BICTORYS_API_KEY
  if (!key) throw new Error('BICTORYS_API_KEY manquant')
  return key
}

function apiUrl(key: string): string {
  return key.startsWith('test_') ? API_URL_SANDBOX : API_URL_LIVE
}

function parserReponseHttpBrute(brut: string): { statut: number; corps: string } {
  const sep = brut.indexOf('\r\n\r\n')
  const entete = sep >= 0 ? brut.slice(0, sep) : brut
  const corps = sep >= 0 ? brut.slice(sep + 4) : ''
  const ligneStatut = entete.split(/\r?\n/)[0] ?? ''
  const m = ligneStatut.match(/^HTTP\/[\d.]+\s+(\d+)/)
  return { statut: m ? parseInt(m[1]!, 10) : 0, corps }
}

async function bictorysFetch(url: string, init: { method: string; headers: Record<string, string>; body?: string }): Promise<{ ok: boolean; statut: number; corps: string }> {
  const args: string[] = ['-i', '-X', init.method]
  for (const [k, v] of Object.entries(init.headers)) args.push('-H', `${k}: ${v}`)
  if (init.body) args.push('-d', init.body)
  args.push(url)

  let derniereErreur = ''
  for (let tentative = 0; tentative < MAX_TENTATIVES_WAF; tentative++) {
    try {
      const { stdout } = await execFileP('curl', args, { timeout: 15_000, maxBuffer: 4 * 1024 * 1024 })
      const { statut, corps } = parserReponseHttpBrute(stdout)

      if (statut === 403 && corps.includes('Forbidden')) {
        derniereErreur = `WAF Bictorys 403 (tentative ${tentative + 1}/${MAX_TENTATIVES_WAF})`
        if (tentative < MAX_TENTATIVES_WAF - 1) {
          await new Promise((r) => setTimeout(r, 2_000 * Math.pow(2, tentative)))
          continue
        }
      }
      return { ok: statut >= 200 && statut < 300, statut, corps }
    } catch (err) {
      derniereErreur = (err as Error).message
      if (tentative < MAX_TENTATIVES_WAF - 1) {
        await new Promise((r) => setTimeout(r, 2_000 * Math.pow(2, tentative)))
      }
    }
  }
  return { ok: false, statut: 0, corps: derniereErreur }
}

const PAYS_MARCHAND = process.env.BICTORYS_MERCHANT_COUNTRY || 'SN'

export const bictorysAdapter: AdaptateurPaiement = {
  id: 'bictorys',

  async initierPaiement(params: InitierPaiementParams): Promise<InitierPaiementResultat> {
    if (params.retourUrl.includes('localhost')) {
      return { ok: false, error: "Bictorys rejette les URLs contenant 'localhost' — utiliser ngrok ou un domaine public en dev." }
    }

    const body = {
      amount: params.montantFcfa,
      currency: 'XOF',
      country: PAYS_MARCHAND,
      paymentReference: params.abonnementId,
      successRedirectUrl: params.retourUrl,
      // Bictorys est sensible à la casse sur ce champ selon la version d'API :
      // envoyer les deux casses (cf. skill izisaas, gotcha documenté).
      errorRedirectUrl: params.retourUrl,
      ErrorRedirectUrl: params.retourUrl,
      customerObject: {
        name: `${params.prenomClient} ${params.nomClient}`.trim() || params.nomEntreprise,
        email: params.emailClient,
        phone: versE164(params.telephoneLocal, params.telephonePays),
        city: 'Dakar',
        country: PAYS_MARCHAND,
        locale: 'fr-FR',
      },
    }

    const key = apiKey()
    const res = await bictorysFetch(`${apiUrl(key)}/pay/v1/charges`, {
      method: 'POST',
      headers: { 'X-Api-Key': key, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const estWaf = res.statut === 403 && res.corps.includes('Forbidden')
      return { ok: false, error: estWaf ? 'Bictorys a bloqué la requête (WAF, 3 tentatives épuisées).' : `Bictorys a répondu ${res.statut} : ${res.corps.slice(0, 300)}` }
    }

    let data: { transactionId?: string; chargeId?: string; link?: string; redirectUrl?: string }
    try {
      data = JSON.parse(res.corps)
    } catch {
      return { ok: false, error: 'Bictorys : réponse JSON invalide' }
    }

    const idTransaction = data.transactionId || data.chargeId
    const checkoutUrl = data.link || data.redirectUrl
    if (!idTransaction || !checkoutUrl) {
      return { ok: false, error: 'Bictorys : réponse incomplète (pas de transactionId/link)' }
    }

    return { ok: true, checkoutUrl, referenceProvider: idTransaction }
  },

  // Toujours null : voir l'avertissement en tête de fichier (WAF bloque le re-pull).
  async recupererStatut(): Promise<StatutPaiementDistant | null> {
    return null
  },
}

// Bictorys : mode HMAC préféré (headers X-Webhook-Signature + X-Webhook-Timestamp),
// repli sur X-Secret-Key statique si le mode HMAC n'est pas activé côté dashboard.
export function verifierSignatureBictorys(corpsBrut: Buffer, signature: string | null, timestamp: string | null, cleSecrete: string | null): boolean {
  const secret = process.env.BICTORYS_WEBHOOK_SECRET
  if (!secret) return false

  if (signature && timestamp) {
    let ts = parseInt(timestamp, 10)
    if (isNaN(ts)) return false
    if (ts < 10_000_000_000) ts *= 1000
    if (Math.abs(Date.now() - ts) > 5 * 60_000) return false

    const attendue = crypto.createHmac('sha256', secret).update(`${timestamp}.${corpsBrut.toString('utf-8')}`).digest('hex')
    const a = Buffer.from(signature)
    const b = Buffer.from(attendue)
    return a.length === b.length && crypto.timingSafeEqual(a, b)
  }

  if (cleSecrete) {
    const a = Buffer.from(cleSecrete)
    const b = Buffer.from(secret)
    return a.length === b.length && crypto.timingSafeEqual(a, b)
  }

  return false
}

export function parserEvenementBictorys(body: unknown): { providerReference: string; statut: StatutProvider; montant?: number; devise?: string; providerReferenceAttendue?: string } | null {
  const b = body as { event?: string; status?: string; transactionId?: string; chargeId?: string; paymentReference?: string; amount?: number; currency?: string } | null
  if (!b) return null

  const id = b.transactionId || b.chargeId
  if (!id) return null

  const brut = (b.status || b.event || '').toLowerCase()
  let statut: StatutProvider = 'pending'
  if (brut.includes('succeed')) statut = 'succeeded'
  else if (brut.includes('fail') || brut.includes('cancel')) statut = 'failed'
  else return null

  return { providerReference: id, statut, montant: b.amount, devise: b.currency, providerReferenceAttendue: b.paymentReference }
}
