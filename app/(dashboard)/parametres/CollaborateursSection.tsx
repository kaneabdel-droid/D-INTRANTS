'use client'

import { useState, useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  UserPlus,
  Key,
  Trash2,
  Copy,
  Check,
  MessageSquare,
  Shield,
  AlertCircle,
  Building,
  Store,
  User,
  Phone,
  Mail,
  Lock,
} from 'lucide-react'
import {
  creerCollaborateur,
  supprimerCollaborateur,
  genererLienResetCollaborateur,
} from './actions'

export type CollaborateurItem = {
  id: string
  role: string | null
  identifiant: string | null
  telephone: string | null
  nom: string | null
  prenom: string | null
  nom_complet: string | null
  email?: string | null
  magasin_id?: string | null
  magasin_nom?: string | null
}

export type MagasinOption = {
  id: string
  nom: string
}

export const ROLES_STANDARDS = [
  { value: 'gerant', label: 'Gérant de magasin (ventes, stocks, achats, réceptions)' },
  { value: 'tresorier', label: 'Trésorier / Comptable (créances, dettes, trésorerie)' },
  { value: 'caissier', label: 'Caissier / Vendeur (ventes et encaissements)' },
  { value: 'magasinier', label: 'Magasinier (stock intrants, entrées & sorties)' },
  { value: 'collaborateur', label: 'Collaborateur standard de terrain' },
  { value: 'admin_entreprise', label: 'Co-administrateur (accès consolidé)' },
]

function getRoleBadge(role: string | null) {
  const r = (role || 'collaborateur').toLowerCase()
  if (r === 'admin_entreprise') {
    return 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/30'
  }
  if (r === 'gerant') {
    return 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30'
  }
  if (r === 'tresorier') {
    return 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
  }
  if (r === 'caissier') {
    return 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30'
  }
  if (r === 'magasinier') {
    return 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/30'
  }
  return 'bg-surface-border/50 text-foreground border-surface-border'
}

function getRoleLabel(role: string | null) {
  const found = ROLES_STANDARDS.find(r => r.value === role)
  return found ? found.label.split(' (')[0] : (role || 'Collaborateur')
}

export default function CollaborateursSection({
  collaborateurs,
  magasins,
  currentUserId,
}: {
  collaborateurs: CollaborateurItem[]
  magasins: MagasinOption[]
  currentUserId: string
}) {
  const router = useRouter()
  const [collabList, setCollabList] = useState<CollaborateurItem[]>(collaborateurs)
  const [showAddModal, setShowAddModal] = useState(false)
  const [addRole, setAddRole] = useState('gerant')
  const [selectedMagasinId, setSelectedMagasinId] = useState(magasins[0]?.id || '')

  useEffect(() => {
    setCollabList(collaborateurs)
  }, [collaborateurs])

  const [activeResetLink, setActiveResetLink] = useState<{
    link: string
    nom: string
    telephone?: string | null
    identifiant?: string | null
  } | null>(null)
  const [copied, setCopied] = useState(false)

  const [isPending, startTransition] = useTransition()
  const [modalError, setModalError] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  // Création d'un collaborateur
  async function handleAddCollaborateur(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setModalError(null)
    setErrorMsg(null)
    setSuccessMsg(null)

    const form = e.currentTarget
    const formData = new FormData(form)

    startTransition(async () => {
      const res = await creerCollaborateur(formData)
      if (res.error) {
        setModalError(res.error)
      } else {
        setShowAddModal(false)
        setSuccessMsg('Collaborateur ajouté avec succès !')
        form.reset()
        setAddRole('gerant')
        if (res.collaborateur) {
          setCollabList(prev => [res.collaborateur!, ...prev.filter(c => c.id !== res.collaborateur!.id)])
        }
        router.refresh()
        setTimeout(() => setSuccessMsg(null), 4000)
      }
    })
  }

  // Suppression
  function handleDelete(collab: CollaborateurItem) {
    const nom = collab.nom_complet || `${collab.prenom || ''} ${collab.nom || ''}`.trim() || collab.identifiant || 'ce collaborateur'
    if (!confirm(`Supprimer définitivement le compte de ${nom} ?`)) return

    setErrorMsg(null)
    startTransition(async () => {
      const res = await supprimerCollaborateur(collab.id)
      if (res.error) {
        setErrorMsg(res.error)
      } else {
        setCollabList(prev => prev.filter(c => c.id !== collab.id))
        setSuccessMsg(`Accès de ${nom} révoqué.`)
        router.refresh()
        setTimeout(() => setSuccessMsg(null), 3000)
      }
    })
  }

  // Génération du lien de récupération
  function handleGenerateResetLink(collab: CollaborateurItem) {
    setErrorMsg(null)
    startTransition(async () => {
      const res = await genererLienResetCollaborateur(collab.id)
      if (res.error) {
        setErrorMsg(res.error)
      } else if (res.link) {
        setActiveResetLink({
          link: res.link,
          nom: collab.nom_complet || collab.identifiant || 'Collaborateur',
          telephone: res.telephone,
          identifiant: res.identifiant,
        })
      }
    })
  }

  function handleCopy() {
    if (!activeResetLink?.link) return
    navigator.clipboard.writeText(activeResetLink.link)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  return (
    <div className="rounded-xl border border-surface-border bg-surface p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-surface-border">
        <div>
          <h2 className="text-base font-bold font-heading text-foreground flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" />
            Équipe & Collaborateurs de l&apos;Entreprise
          </h2>
          <p className="text-xs text-foreground-muted mt-0.5">
            Gérez vos gérants de magasins, trésoriers, caissiers et magasiniers. Création possible avec un simple identifiant ou numéro de téléphone (sans e-mail requis).
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setShowAddModal(true)
            setModalError(null)
            setErrorMsg(null)
          }}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-3.5 py-2 text-xs font-bold text-white shadow-sm hover:bg-primary/90 transition-all cursor-pointer"
        >
          <UserPlus className="h-4 w-4" />
          Ajouter un collaborateur
        </button>
      </div>

      {errorMsg && (
        <div className="mt-4 p-3 rounded-lg bg-danger/10 border border-danger/20 text-danger text-xs font-medium flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="mt-4 p-3 rounded-lg bg-success/10 border border-success/20 text-success text-xs font-semibold flex items-center gap-2">
          <Check className="h-4 w-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Liste des collaborateurs */}
      <div className="mt-5 divide-y divide-surface-border overflow-hidden rounded-xl border border-surface-border bg-background/40">
        {collabList.length > 0 ? (
          collabList.map((collab) => {
            const isMe = collab.id === currentUserId
            const displayName =
              collab.nom_complet ||
              `${collab.prenom || ''} ${collab.nom || ''}`.trim() ||
              collab.identifiant ||
              'Sans nom'

            return (
              <div
                key={collab.id}
                className="flex flex-wrap items-center justify-between gap-3 p-4 hover:bg-background/80 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-sm text-foreground">{displayName}</span>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${getRoleBadge(
                        collab.role
                      )}`}
                    >
                      {getRoleLabel(collab.role)}
                    </span>
                    {isMe && (
                      <span className="text-[10px] font-semibold text-foreground-muted bg-surface px-1.5 py-0.5 rounded border border-surface-border">
                        Vous (Administrateur)
                      </span>
                    )}
                  </div>

                  <div className="mt-1 flex items-center gap-4 text-xs text-foreground-muted flex-wrap">
                    {collab.identifiant && (
                      <span className="flex items-center gap-1 font-mono">
                        <User className="h-3 w-3" /> @{collab.identifiant}
                      </span>
                    )}
                    {collab.telephone && (
                      <span className="flex items-center gap-1">
                        <Phone className="h-3 w-3" /> {collab.telephone}
                      </span>
                    )}
                    {collab.magasin_nom && (
                      <span className="flex items-center gap-1 text-primary">
                        <Store className="h-3 w-3" /> Magasin : {collab.magasin_nom}
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleGenerateResetLink(collab)}
                    disabled={isPending}
                    title="Générer un lien de réinitialisation de mot de passe"
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-surface-border bg-surface text-xs font-semibold text-foreground hover:bg-background transition-colors disabled:opacity-50"
                  >
                    <Key className="h-3.5 w-3.5 text-amber-500" />
                    <span className="hidden sm:inline">Mot de passe</span>
                  </button>

                  {!isMe && (
                    <button
                      type="button"
                      onClick={() => handleDelete(collab)}
                      disabled={isPending}
                      title="Supprimer l'accès de ce collaborateur"
                      className="p-1.5 rounded-lg text-foreground-muted hover:text-danger hover:bg-danger/10 transition-colors disabled:opacity-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            )
          })
        ) : (
          <div className="p-8 text-center text-xs text-foreground-muted">
            Aucun collaborateur enregistré. Cliquez sur &quot;Ajouter un collaborateur&quot; pour créer un premier compte.
          </div>
        )}
      </div>

      {/* Modal Ajout Collaborateur */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface border border-surface-border rounded-2xl w-full max-w-md shadow-2xl p-6 relative animate-in fade-in zoom-in-95 duration-150">
            <h3 className="text-base font-bold font-heading text-foreground flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-primary" />
              Nouveau Collaborateur
            </h3>
            <p className="text-xs text-foreground-muted mt-1">
              Renseignez un identifiant ou un numéro de téléphone pour lui créer un accès sécurisé.
            </p>

            {modalError && (
              <div className="mt-3 p-3 rounded-xl bg-danger/10 border border-danger/20 text-danger text-xs font-medium flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleAddCollaborateur} className="mt-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-foreground">
                  Identifiant ou Nom d&apos;utilisateur <span className="text-danger">*</span>
                </label>
                <input
                  type="text"
                  name="identifiant"
                  required
                  placeholder="ex: moussa_sarr ou 771234567"
                  className="mt-1 block w-full rounded-xl border border-surface-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-foreground-muted focus:border-primary focus:outline-none"
                />
                <p className="text-[10px] text-foreground-muted mt-0.5">
                  Sera utilisé pour la connexion en ligne et directe hors-ligne.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-foreground">
                  Nom Complet
                </label>
                <input
                  type="text"
                  name="nom_complet"
                  placeholder="ex: Moussa Sarr"
                  className="mt-1 block w-full rounded-xl border border-surface-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-foreground-muted focus:border-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-foreground">
                  Numéro de Téléphone
                </label>
                <input
                  type="tel"
                  name="telephone"
                  placeholder="ex: +221 77 123 45 67"
                  className="mt-1 block w-full rounded-xl border border-surface-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-foreground-muted focus:border-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-foreground">
                  Adresse E-mail <span className="text-foreground-muted font-normal">(Facultatif)</span>
                </label>
                <input
                  type="email"
                  name="email"
                  placeholder="agent@domaine.com (optionnel)"
                  className="mt-1 block w-full rounded-xl border border-surface-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-foreground-muted focus:border-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-foreground">
                  Mot de passe provisoire <span className="text-danger">*</span>
                </label>
                <input
                  type="password"
                  name="password"
                  required
                  minLength={6}
                  placeholder="6 caractères minimum"
                  className="mt-1 block w-full rounded-xl border border-surface-border bg-background px-3 py-2 text-xs text-foreground focus:border-primary focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-foreground">
                    Rôle
                  </label>
                  <select
                    name="role"
                    value={addRole}
                    onChange={(e) => setAddRole(e.target.value)}
                    className="mt-1 block w-full rounded-xl border border-surface-border bg-background px-3 py-2 text-xs text-foreground focus:border-primary focus:outline-none"
                  >
                    {ROLES_STANDARDS.map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.label.split(' (')[0]}
                      </option>
                    ))}
                  </select>
                </div>

                {addRole !== 'admin_entreprise' && magasins.length > 0 && (
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-foreground">
                      Magasin assigné
                    </label>
                    <select
                      name="magasin_id"
                      value={selectedMagasinId}
                      onChange={(e) => setSelectedMagasinId(e.target.value)}
                      className="mt-1 block w-full rounded-xl border border-surface-border bg-background px-3 py-2 text-xs text-foreground focus:border-primary focus:outline-none"
                    >
                      {magasins.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.nom}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-surface-border">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="rounded-xl border border-surface-border px-4 py-2 text-xs font-semibold text-foreground hover:bg-background"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="rounded-xl bg-primary px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-primary/90 disabled:opacity-50 cursor-pointer"
                >
                  {isPending ? 'Création en cours...' : 'Créer le collaborateur'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Lien de Réinitialisation (avec WhatsApp Direct) */}
      {activeResetLink && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface border border-surface-border rounded-2xl w-full max-w-md shadow-2xl p-6 relative animate-in fade-in zoom-in-95 duration-150">
            <h3 className="text-base font-bold font-heading text-foreground flex items-center gap-2">
              <Key className="h-5 w-5 text-amber-500" />
              Lien de Récupération
            </h3>
            <p className="text-xs text-foreground-muted mt-1">
              Transmettez ce lien sécurisé à <strong>{activeResetLink.nom}</strong> pour lui permettre de choisir son nouveau mot de passe.
            </p>

            <div className="mt-4 p-3 rounded-xl bg-background border border-surface-border font-mono text-[11px] break-all select-all text-foreground">
              {activeResetLink.link}
            </div>

            <div className="mt-4 flex flex-col sm:flex-row gap-2">
              <button
                type="button"
                onClick={handleCopy}
                className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl border border-surface-border bg-surface px-3 py-2 text-xs font-semibold text-foreground hover:bg-background"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? 'Copié !' : 'Copier le lien'}
              </button>

              {activeResetLink.telephone && (
                <a
                  href={`https://wa.me/${activeResetLink.telephone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(
                    `Bonjour ${activeResetLink.nom}, voici votre lien sécurisé pour définir votre mot de passe sur d-intrants : ${activeResetLink.link}`
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700 shadow-sm"
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                  Envoyer via WhatsApp
                </a>
              )}
            </div>

            <div className="mt-4 text-right">
              <button
                type="button"
                onClick={() => setActiveResetLink(null)}
                className="text-xs text-foreground-muted hover:text-foreground font-medium"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
