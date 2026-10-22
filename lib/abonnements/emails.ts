import { createAdminClient } from '@/utils/supabase/admin'

type InfosPaiementAbonnement = {
  abonnementId: string
  entrepriseId: string | null
  palier: string
  dureeMois: number
  montant: number
  devise?: string
  provider: string
  providerReference?: string | null
  metadata?: Record<string, any> | null
  dateFin?: string | null
}

const NOMS_PALIERS: Record<string, string> = {
  standard: 'Standard',
  medium: 'Médium',
  premium: 'Premium',
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export async function envoyerEmailsConfirmationAbonnement(infos: InfosPaiementAbonnement, produitNom = 'D-INTRANTS') {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.warn('[Emails] RESEND_API_KEY absent : aucun email de confirmation envoyé')
    return false
  }

  const expediteur = process.env.EMAIL_EXPEDITEUR || 'noreply@dembasolution.com'
  const adminEmails = (process.env.ADMIN_EMAILS || 'kaneabdel@gmail.com')
    .split(',')
    .map((e) => e.trim())
    .filter(Boolean)

  const supabase = createAdminClient()

  let clientEmail = ''
  let clientNom = ''
  let nomEntreprise = ''
  let telephone = ''
  const isDemandePublique = !infos.entrepriseId

  if (isDemandePublique) {
    clientEmail = infos.metadata?.contactEmail || ''
    clientNom = infos.metadata?.contactNom || ''
    nomEntreprise = infos.metadata?.nomEntreprise || 'Nouvelle entreprise'
    telephone = infos.metadata?.contactTelephone || ''
  } else {
    const { data: ent } = await supabase
      .from('entreprises')
      .select('nom, email, telephone')
      .eq('id', infos.entrepriseId!)
      .maybeSingle()

    const { data: user } = await supabase
      .from('utilisateurs')
      .select('email, prenom, nom, telephone')
      .eq('entreprise_id', infos.entrepriseId!)
      .limit(1)
      .maybeSingle()

    nomEntreprise = ent?.nom || 'Votre entreprise'
    clientEmail = ent?.email || user?.email || infos.metadata?.contactEmail || ''
    clientNom = user ? `${user.prenom || ''} ${user.nom || ''}`.trim() : infos.metadata?.contactNom || nomEntreprise
    telephone = ent?.telephone || user?.telephone || infos.metadata?.contactTelephone || ''
  }

  const palierLibelle = NOMS_PALIERS[infos.palier] || infos.palier
  const montantFormate = `${Number(infos.montant).toLocaleString('fr-FR')} ${infos.devise || 'FCFA'}`
  const datePaiement = new Date().toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://d-intrants.dembasolution.com'

  // 1. Email au client (si une adresse email est trouvée)
  if (clientEmail) {
    const htmlClient = `
      <!doctype html>
      <html lang="fr">
      <head><meta charset="utf-8" /></head>
      <body style="margin:0;padding:0;background-color:#F8FAFC;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1E293B;">
        <div style="max-width:600px;margin:24px auto;background:#FFFFFF;border-radius:16px;border:1px solid #E2E8F0;overflow:hidden;box-shadow:0 4px 6px -1px rgba(0,0,0,0.05);">
          <div style="background:#0F172A;padding:28px 32px;text-align:center;">
            <h1 style="color:#FFFFFF;margin:0;font-size:22px;font-weight:700;letter-spacing:-0.5px;">${escapeHtml(produitNom)}</h1>
            <p style="color:#94A3B8;margin:6px 0 0;font-size:13px;">Gestion des intrants &amp; distribution agricole</p>
          </div>
          
          <div style="padding:32px;">
            <div style="background:#ECFDF5;border:1px solid #A7F3D0;border-radius:12px;padding:16px 20px;margin-bottom:24px;text-align:center;">
              <span style="font-size:24px;">✅</span>
              <h2 style="color:#065F46;margin:8px 0 4px;font-size:18px;font-weight:700;">Paiement confirmé avec succès !</h2>
              <p style="color:#047857;margin:0;font-size:14px;">Nous vous remercions pour votre confiance.</p>
            </div>

            <p style="font-size:15px;line-height:1.6;margin:0 0 16px;">
              Bonjour <strong>${escapeHtml(clientNom || nomEntreprise)}</strong>,
            </p>
            <p style="font-size:14px;line-height:1.6;color:#475569;margin:0 0 24px;">
              Votre règlement pour l'abonnement <strong>${escapeHtml(produitNom)}</strong> a bien été reçu et validé.
            </p>

            <table style="width:100%;border-collapse:collapse;margin-bottom:28px;background:#F8FAFC;border-radius:12px;border:1px solid #E2E8F0;font-size:14px;">
              <tr>
                <td style="padding:12px 16px;color:#64748B;border-bottom:1px solid #E2E8F0;">Entreprise</td>
                <td style="padding:12px 16px;font-weight:600;color:#0F172A;border-bottom:1px solid #E2E8F0;text-align:right;">${escapeHtml(nomEntreprise)}</td>
              </tr>
              <tr>
                <td style="padding:12px 16px;color:#64748B;border-bottom:1px solid #E2E8F0;">Formule souscrite</td>
                <td style="padding:12px 16px;font-weight:600;color:#0F172A;border-bottom:1px solid #E2E8F0;text-align:right;">${escapeHtml(palierLibelle)} (${infos.dureeMois} mois)</td>
              </tr>
              <tr>
                <td style="padding:12px 16px;color:#64748B;border-bottom:1px solid #E2E8F0;">Montant réglé</td>
                <td style="padding:12px 16px;font-weight:700;color:#059669;border-bottom:1px solid #E2E8F0;text-align:right;">${escapeHtml(montantFormate)}</td>
              </tr>
              <tr>
                <td style="padding:12px 16px;color:#64748B;border-bottom:1px solid #E2E8F0;">Date</td>
                <td style="padding:12px 16px;color:#0F172A;border-bottom:1px solid #E2E8F0;text-align:right;">${escapeHtml(datePaiement)}</td>
              </tr>
              <tr>
                <td style="padding:12px 16px;color:#64748B;">Moyen de paiement</td>
                <td style="padding:12px 16px;color:#0F172A;text-align:right;text-transform:capitalize;">${escapeHtml(infos.provider)}</td>
              </tr>
            </table>

            <div style="background:#F1F5F9;border-left:4px solid #3B82F6;padding:16px;border-radius:8px;margin-bottom:28px;">
              <p style="margin:0;font-size:13px;line-height:1.6;color:#334155;">
                ${
                  isDemandePublique
                    ? "<strong>Création de vos accès :</strong> Votre espace de travail est en cours d'initialisation par notre équipe technique. Vous recevrez vos identifiants d'accès par e-mail dans un délai maximum de 24h ouvrées."
                    : "<strong>Compte actif :</strong> Votre abonnement est d'ores et déjà actif. Vous pouvez vous connecter à tout moment sur votre tableau de bord."
                }
              </p>
            </div>

            <div style="text-align:center;margin-bottom:24px;">
              <a href="${siteUrl}" style="display:inline-block;background:#0F172A;color:#FFFFFF;text-decoration:none;font-weight:600;font-size:14px;padding:12px 28px;border-radius:10px;box-shadow:0 2px 4px rgba(0,0,0,0.1);">
                Accéder à ${escapeHtml(produitNom)}
              </a>
            </div>

            <p style="font-size:12px;color:#94A3B8;text-align:center;margin:0;">
              Besoin d'aide ou d'une question ? Contactez notre support à <a href="mailto:support@dembasolution.com" style="color:#64748B;">support@dembasolution.com</a>.
            </p>
          </div>

          <div style="background:#F8FAFC;padding:16px;text-align:center;border-top:1px solid #E2E8F0;font-size:11px;color:#94A3B8;">
            DembaSolution © ${new Date().getFullYear()} — Tous droits réservés.
          </div>
        </div>
      </body>
      </html>
    `

    try {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: `${produitNom} <${expediteur}>`,
          to: [clientEmail],
          subject: `Confirmation de votre abonnement ${produitNom} (${palierLibelle})`,
          html: htmlClient,
        }),
      })
    } catch (err) {
      console.error('[Emails] Échec envoi confirmation client:', err)
    }
  }

  // 2. Email de notification à l'administrateur
  if (adminEmails.length > 0) {
    const htmlAdmin = `
      <div style="font-family:sans-serif;line-height:1.6;color:#1E293B;">
        <h2 style="color:#0F172A;margin-top:0;">🎉 Nouveau paiement d'abonnement reçu — ${escapeHtml(produitNom)}</h2>
        <p>Un client vient de finaliser un paiement avec succès :</p>
        <ul>
          <li><strong>Produit :</strong> ${escapeHtml(produitNom)}</li>
          <li><strong>Entreprise :</strong> ${escapeHtml(nomEntreprise)}</li>
          <li><strong>Contact :</strong> ${escapeHtml(clientNom)} (${escapeHtml(clientEmail || 'N/A')}, ${escapeHtml(telephone || 'N/A')})</li>
          <li><strong>Formule :</strong> ${escapeHtml(palierLibelle)} (${infos.dureeMois} mois)</li>
          <li><strong>Montant :</strong> <strong>${escapeHtml(montantFormate)}</strong></li>
          <li><strong>Prestataire :</strong> ${escapeHtml(infos.provider)} (Réf: ${escapeHtml(infos.providerReference || infos.abonnementId)})</li>
          <li><strong>Type :</strong> ${isDemandePublique ? 'Nouvelle demande publique (à provisionner dans /admin/demandes)' : 'Renouvellement entreprise existante'}</li>
          <li><strong>Date :</strong> ${escapeHtml(datePaiement)}</li>
        </ul>
        ${
          isDemandePublique
            ? `<p style="background:#FEF3C7;border:1px solid #F59E0B;padding:12px;border-radius:8px;color:#92400E;">
                <strong>Action requise :</strong> Rendez-vous sur votre espace d'administration pour créer l'accès entreprise et transmettre les identifiants au client.
               </p>`
            : ''
        }
      </div>
    `

    try {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: `${produitNom} Notifications <${expediteur}>`,
          to: adminEmails,
          subject: `[Paiement Reçu] ${produitNom} — ${nomEntreprise} (${montantFormate})`,
          html: htmlAdmin,
        }),
      })
    } catch (err) {
      console.error('[Emails] Échec envoi notification admin:', err)
    }
  }

  return true
}
