'use client'

import { useState, useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  UserPlus,
  Key,
  Trash2,
  Check,
  Shield,
  AlertCircle,
  Store,
  User,
  Phone,
  Mail,
  Lock,
  Edit2,
  ExternalLink,
  PlusCircle,
  KeyRound,
} from 'lucide-react'
import {
  creerCollaborateur,
  modifierCollaborateur,
  reinitialiserMotDePasseCollaborateur,
  supprimerCollaborateur,
  genererLienResetCollaborateur,
  creerMagasin,
} from './actions'
import { PALIERS, type PalierCode } from '@/lib/abonnements/paliers'

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
  doit_changer_mot_de_passe?: boolean
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
  const found = ROLES_STANDARDS.find((r) => r.value === role)
  return found ? found.label.split(' (')[0] : role || 'Collaborateur'
}

export default function CollaborateursSection({
  collaborateurs,
  magasins,
  currentUserId,
  palier,
}: {
  collaborateurs: CollaborateurItem[]
  magasins: MagasinOption[]
  currentUserId: string
  palier?: string
}) {
  const router = useRouter()
  const [collabList, setCollabList] = useState<CollaborateurItem[]>(collaborateurs)
  const [magList, setMagList] = useState<MagasinOption[]>(magasins)

  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showResetModal, setShowResetModal] = useState(false)
  const [showMagasinModal, setShowMagasinModal] = useState(false)

  const [selectedCollab, setSelectedCollab] = useState<CollaborateurItem | null>(null)

  // Formulaire d'ajout
  const [addPhone, setAddPhone] = useState('')
  const [addIdentifiant, setAddIdentifiant] = useState('')
  const [addRole, setAddRole] = useState('gerant')
  const [selectedMagasinId, setSelectedMagasinId] = useState(magasins[0]?.id || '')
  const [addForcePassword, setAddForcePassword] = useState(true)

  // Formulaire de modification
  const [editRole, setEditRole] = useState('gerant')
  const [editMagasinId, setEditMagasinId] = useState('')
  const [editForcePassword, setEditForcePassword] = useState(false)

  // Lien de récupération
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

  useEffect(() => {
    setCollabList(collaborateurs)
  }, [collaborateurs])

  useEffect(() => {
    setMagList(magasins)
    if (!selectedMagasinId && magasins.length > 0) {
      setSelectedMagasinId(magasins[0].id)
    }
  }, [magasins, selectedMagasinId])

  const palierCode = ((palier as PalierCode) || 'standard') in PALIERS ? (palier as PalierCode) : 'standard'
  const palierInfo = PALIERS[palierCode] || PALIERS.standard
  const isPremiumPlus = palierCode === 'premium_plus'

  const utilisateursMax = palierInfo.utilisateursMax
  const magasinsMax = palierInfo.magasinsMax
  const quotaUtilisateursAtteint = utilisateursMax !== null && collabList.length >= utilisateursMax
  const quotaMagasinsAtteint = magList.length >= magasinsMax

  // Synchronisation du téléphone vers l'identifiant par défaut
  function handlePhoneChange(val: string) {
    setAddPhone(val)
    const cleanDigits = val.replace(/\D/g, '')
    if (!addIdentifiant || /^\d+$/.test(addIdentifiant)) {
      setAddIdentifiant(cleanDigits)
    }
  }

  // Création d'un collaborateur
  async function handleAddCollaborateur(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setModalError(null)
    setErrorMsg(null)
    setSuccessMsg(null)

    const form = e.currentTarget
    const formData = new FormData(form)
    formData.set('doit_changer_mot_de_passe', addForcePassword ? 'true' : 'false')

    startTransition(async () => {
      const res = await creerCollaborateur(formData)
      if (res.error) {
        setModalError(res.error)
      } else {
        setShowAddModal(false)
        setSuccessMsg('Collaborateur ajouté avec succès !')
        form.reset()
        setAddPhone('')
        setAddIdentifiant('')
        setAddRole('gerant')
        setAddForcePassword(true)
        if (res.collaborateur) {
          setCollabList((prev) => [res.collaborateur!, ...prev.filter((c) => c.id !== res.collaborateur!.id)])
        }
        router.refresh()
        setTimeout(() => setSuccessMsg(null), 4000)
      }
    })
  }

  // Modification d'un collaborateur
  async function handleEditCollaborateur(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!selectedCollab) return
    setModalError(null)
    setErrorMsg(null)

    const form = e.currentTarget
    const formData = new FormData(form)
    formData.set('id', selectedCollab.id)
    formData.set('doit_changer_mot_de_passe', editForcePassword ? 'true' : 'false')

    startTransition(async () => {
      const res = await modifierCollaborateur(formData)
      if (res.error) {
        setModalError(res.error)
      } else {
        setShowEditModal(false)
        setSuccessMsg('Collaborateur mis à jour avec succès.')
        router.refresh()
        setTimeout(() => setSuccessMsg(null), 3000)
      }
    })
  }

  // Réinitialisation mot de passe
  async function handleResetPassword(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!selectedCollab) return
    setModalError(null)

    const form = e.currentTarget
    const formData = new FormData(form)
    formData.set('id', selectedCollab.id)

    startTransition(async () => {
      const res = await reinitialiserMotDePasseCollaborateur(formData)
      if (res.error) {
        setModalError(res.error)
      } else {
        setShowResetModal(false)
        setSuccessMsg(`Nouveau mot de passe enregistré pour ${selectedCollab.nom_complet || selectedCollab.identifiant}.`)
        router.refresh()
        setTimeout(() => setSuccessMsg(null), 3000)
      }
    })
  }

  // Création de magasin
  async function handleAddMagasin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setModalError(null)
    const form = e.currentTarget
    const formData = new FormData(form)

    startTransition(async () => {
      const res = await creerMagasin(formData)
      if (res.error) {
        setModalError(res.error)
      } else {
        setShowMagasinModal(false)
        setSuccessMsg('Nouveau point de vente / magasin créé avec succès !')
        form.reset()
        if (res.magasin) {
          setMagList((prev) => [...prev, { id: res.magasin!.id, nom: res.magasin!.nom }])
        }
        router.refresh()
        setTimeout(() => setSuccessMsg(null), 4000)
      }
    })
  }

  // Suppression
  function handleDelete(collab: CollaborateurItem) {
    const nom =
      collab.nom_complet ||
      `${collab.prenom || ''} ${collab.nom || ''}`.trim() ||
      collab.identifiant ||
      'ce collaborateur'
    if (!confirm(`Supprimer définitivement le compte de ${nom} ?`)) return

    setErrorMsg(null)
    startTransition(async () => {
      const res = await supprimerCollaborateur(collab.id)
      if (res.error) {
        setErrorMsg(res.error)
      } else {
        setCollabList((prev) => prev.filter((c) => c.id !== collab.id))
        setSuccessMsg(`Accès de ${nom} révoqué.`)
        router.refresh()
        setTimeout(() => setSuccessMsg(null), 3000)
      }
    })
  }

  // Lien de récupération
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
    <div className="rounded-xl border border-surface-border bg-surface p-6 shadow-sm space-y-6">
      {/* En-tête & Quotas */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-surface-border">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-base font-bold font-heading text-foreground flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary" />
              Équipe, Utilisateurs & Magasins
            </h2>
            <span className="text-[11px] font-mono text-foreground-muted bg-background px-2 py-0.5 rounded-full border border-surface-border">
              {collabList.length} utilisateur{collabList.length > 1 ? 's' : ''} /{' '}
              {isPremiumPlus ? 'Illimité' : utilisateursMax}
            </span>
            <span className="text-[11px] font-mono text-foreground-muted bg-background px-2 py-0.5 rounded-full border border-surface-border">
              {magList.length} magasin{magList.length > 1 ? 's' : ''} / {magasinsMax}
            </span>
            {isPremiumPlus && (
              <span className="text-[10px] font-bold text-amber-600 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                ✨ Formule Premium Plus
              </span>
            )}
          </div>
          <p className="text-xs text-foreground-muted mt-1">
            Gérez vos gérants d&apos;intrants, trésoriers, magasiniers et vendeurs affectés à vos magasins. Identifiant par défaut = numéro de téléphone.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => {
              setShowMagasinModal(true)
              setModalError(null)
            }}
            disabled={quotaMagasinsAtteint}
            className="inline-flex items-center gap-1.5 rounded-xl border border-surface-border bg-background px-3 py-2 text-xs font-semibold text-foreground shadow-sm hover:bg-surface-border/50 disabled:opacity-50 cursor-pointer"
          >
            <Store className="h-3.5 w-3.5 text-primary" />
            Nouveau magasin
          </button>

          <button
            type="button"
            onClick={() => {
              setShowAddModal(true)
              setModalError(null)
              setErrorMsg(null)
            }}
            disabled={quotaUtilisateursAtteint}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-3.5 py-2 text-xs font-bold text-white shadow-sm hover:bg-primary/90 transition-all disabled:opacity-50 cursor-pointer"
          >
            <UserPlus className="h-4 w-4" />
            Ajouter un collaborateur
          </button>
        </div>
      </div>

      {/* Alerte Quota Atteint */}
      {(quotaUtilisateursAtteint || quotaMagasinsAtteint) && (
        <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs flex items-center justify-between gap-3 text-amber-800 dark:text-amber-200">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
            <span>
              {quotaUtilisateursAtteint && quotaMagasinsAtteint
                ? `Quotas d'utilisateurs (${collabList.length}/${utilisateursMax}) et de magasins (${magList.length}/${magasinsMax}) atteints pour votre formule ${palierInfo.nom}.`
                : quotaUtilisateursAtteint
                  ? `Quota d'utilisateurs atteint (${collabList.length}/${utilisateursMax}) pour la formule ${palierInfo.nom}.`
                  : `Quota de magasins atteint (${magList.length}/${magasinsMax}) pour la formule ${palierInfo.nom}.`}
            </span>
          </div>
          <Link
            href="/abonnement"
            className="inline-flex items-center gap-1 font-bold text-amber-700 dark:text-amber-300 hover:underline shrink-0"
          >
            <span>Passer à la formule supérieure</span>
            <ExternalLink className="h-3 w-3" />
          </Link>
        </div>
      )}

      {errorMsg && (
        <div className="p-3 rounded-lg bg-danger/10 border border-danger/20 text-danger text-xs font-medium flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-3 rounded-lg bg-success/10 border border-success/20 text-success text-xs font-semibold flex items-center gap-2">
          <Check className="h-4 w-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Liste des collaborateurs */}
      <div className="divide-y divide-surface-border overflow-hidden rounded-xl border border-surface-border bg-background/40">
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
                    {collab.doit_changer_mot_de_passe && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-600 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                        <KeyRound className="h-2.5 w-2.5" /> Changement MDP requis
                      </span>
                    )}
                    {isMe && (
                      <span className="text-[10px] font-semibold text-foreground-muted bg-surface px-1.5 py-0.5 rounded border border-surface-border">
                        Vous (Admin)
                      </span>
                    )}
                  </div>

                  <div className="mt-1 flex items-center gap-4 text-xs text-foreground-muted flex-wrap">
                    {collab.telephone && (
                      <span className="flex items-center gap-1 font-semibold text-foreground">
                        <Phone className="h-3 w-3 text-primary" /> {collab.telephone}
                      </span>
                    )}
                    {collab.identifiant && (
                      <span className="flex items-center gap-1 font-mono text-[11px]">
                        <User className="h-3 w-3" /> @{collab.identifiant}
                      </span>
                    )}
                    {collab.magasin_nom ? (
                      <span className="flex items-center gap-1 text-primary font-medium">
                        <Store className="h-3 w-3" /> {collab.magasin_nom}
                      </span>
                    ) : collab.role === 'admin_entreprise' ? (
                      <span className="flex items-center gap-1 text-purple-600 dark:text-purple-400 font-medium">
                        Vue consolidée entreprise
                      </span>
                    ) : null}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCollab(collab)
                      setEditRole(collab.role || 'gerant')
                      setEditMagasinId(collab.magasin_id || magList[0]?.id || '')
                      setEditForcePassword(collab.doit_changer_mot_de_passe || false)
                      setShowEditModal(true)
                      setModalError(null)
                    }}
                    title="Modifier ce collaborateur"
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-surface-border bg-surface text-xs font-semibold text-foreground hover:bg-background transition-colors"
                  >
                    <Edit2 className="h-3.5 w-3.5 text-foreground-muted" />
                    <span className="hidden sm:inline">Modifier</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCollab(collab)
                      setShowResetModal(true)
                      setModalError(null)
                    }}
                    title="Définir un nouveau mot de passe"
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-surface-border bg-surface text-xs font-semibold text-foreground hover:bg-background transition-colors"
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
                      className="p-1.5 rounded-lg border border-danger/20 bg-danger/5 text-danger hover:bg-danger/10 transition-colors disabled:opacity-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            )
          })
        ) : (
          <div className="p-8 text-center text-xs text-foreground-muted">
            Aucun collaborateur enregistré pour le moment.
          </div>
        )}
      </div>

      {/* Modal Ajout Collaborateur */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface border border-surface-border rounded-2xl w-full max-w-lg shadow-2xl p-6 relative animate-in fade-in zoom-in-95 duration-150">
            <h3 className="text-base font-bold font-heading text-foreground flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-primary" />
              Ajouter un collaborateur
            </h3>
            <p className="text-xs text-foreground-muted mt-1">
              Affectez ce collaborateur à un magasin d&apos;intrants. L&apos;identifiant par défaut est son numéro de téléphone.
            </p>

            {modalError && (
              <div className="mt-4 p-3 rounded-lg bg-danger/10 border border-danger/20 text-danger text-xs font-medium flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleAddCollaborateur} className="mt-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-foreground">
                    Téléphone (Identifiant par défaut) <span className="text-danger">*</span>
                  </label>
                  <input
                    type="tel"
                    name="telephone"
                    required
                    value={addPhone}
                    onChange={(e) => handlePhoneChange(e.target.value)}
                    placeholder="ex: 77 123 45 67"
                    className="mt-1 block w-full rounded-xl border border-surface-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-foreground-muted focus:border-primary focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-foreground">
                    Identifiant de connexion <span className="text-danger">*</span>
                  </label>
                  <input
                    type="text"
                    name="identifiant"
                    required
                    value={addIdentifiant}
                    onChange={(e) => setAddIdentifiant(e.target.value)}
                    placeholder="ex: 771234567 ou prenom_nom"
                    className="mt-1 block w-full rounded-xl border border-surface-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-foreground-muted focus:border-primary focus:outline-none"
                  />
                </div>
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

                {addRole !== 'admin_entreprise' && (
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-foreground">
                      Magasin assigné <span className="text-danger">*</span>
                    </label>
                    <select
                      name="magasin_id"
                      value={selectedMagasinId}
                      onChange={(e) => setSelectedMagasinId(e.target.value)}
                      className="mt-1 block w-full rounded-xl border border-surface-border bg-background px-3 py-2 text-xs text-foreground focus:border-primary focus:outline-none"
                    >
                      {magList.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.nom}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
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

              {/* Option changement de mot de passe à la première connexion */}
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 flex items-start gap-2.5">
                <input
                  type="checkbox"
                  id="add_doit_changer_mdp_intrants"
                  name="doit_changer_mot_de_passe"
                  checked={addForcePassword}
                  onChange={(e) => setAddForcePassword(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-surface-border text-primary focus:ring-primary cursor-pointer"
                />
                <label htmlFor="add_doit_changer_mdp_intrants" className="text-xs text-foreground cursor-pointer">
                  <span className="font-bold block">Forcer le changement de mot de passe dès la 1ère connexion</span>
                  <span className="text-foreground-muted text-[11px] block mt-0.5">
                    L&apos;utilisateur sera invité à définir son propre mot de passe personnel dès sa connexion au dashboard.
                  </span>
                </label>
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

      {/* Modal Modification Collaborateur */}
      {showEditModal && selectedCollab && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface border border-surface-border rounded-2xl w-full max-w-lg shadow-2xl p-6 relative animate-in fade-in zoom-in-95 duration-150">
            <h3 className="text-base font-bold font-heading text-foreground flex items-center gap-2">
              <Edit2 className="h-5 w-5 text-primary" />
              Modifier le collaborateur
            </h3>
            <p className="text-xs text-foreground-muted mt-1">
              Ajustez l&apos;affectation au magasin, le rôle ou les coordonnées de {selectedCollab.nom_complet || selectedCollab.identifiant}.
            </p>

            {modalError && (
              <div className="mt-4 p-3 rounded-lg bg-danger/10 border border-danger/20 text-danger text-xs font-medium flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleEditCollaborateur} className="mt-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-foreground">
                    Téléphone
                  </label>
                  <input
                    type="tel"
                    name="telephone"
                    defaultValue={selectedCollab.telephone || ''}
                    placeholder="ex: 77 123 45 67"
                    className="mt-1 block w-full rounded-xl border border-surface-border bg-background px-3 py-2 text-xs text-foreground focus:border-primary focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-foreground">
                    Identifiant
                  </label>
                  <input
                    type="text"
                    name="identifiant"
                    defaultValue={selectedCollab.identifiant || ''}
                    placeholder="ex: 771234567"
                    className="mt-1 block w-full rounded-xl border border-surface-border bg-background px-3 py-2 text-xs text-foreground focus:border-primary focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-foreground">
                  Nom Complet
                </label>
                <input
                  type="text"
                  name="nom_complet"
                  defaultValue={selectedCollab.nom_complet || ''}
                  placeholder="ex: Moussa Sarr"
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
                    value={editRole}
                    onChange={(e) => setEditRole(e.target.value)}
                    className="mt-1 block w-full rounded-xl border border-surface-border bg-background px-3 py-2 text-xs text-foreground focus:border-primary focus:outline-none"
                  >
                    {ROLES_STANDARDS.map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.label.split(' (')[0]}
                      </option>
                    ))}
                  </select>
                </div>

                {editRole !== 'admin_entreprise' && (
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-foreground">
                      Magasin assigné
                    </label>
                    <select
                      name="magasin_id"
                      value={editMagasinId}
                      onChange={(e) => setEditMagasinId(e.target.value)}
                      className="mt-1 block w-full rounded-xl border border-surface-border bg-background px-3 py-2 text-xs text-foreground focus:border-primary focus:outline-none"
                    >
                      {magList.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.nom}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div className="rounded-xl border border-surface-border bg-background/50 p-3 flex items-start gap-2.5">
                <input
                  type="checkbox"
                  id="edit_doit_changer_mdp_intrants"
                  name="doit_changer_mot_de_passe"
                  checked={editForcePassword}
                  onChange={(e) => setEditForcePassword(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-surface-border text-primary focus:ring-primary cursor-pointer"
                />
                <label htmlFor="edit_doit_changer_mdp_intrants" className="text-xs text-foreground cursor-pointer">
                  <span className="font-semibold block">Exiger un changement de mot de passe à la prochaine connexion</span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-surface-border">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="rounded-xl border border-surface-border px-4 py-2 text-xs font-semibold text-foreground hover:bg-background"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="rounded-xl bg-primary px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-primary/90 disabled:opacity-50 cursor-pointer"
                >
                  {isPending ? 'Enregistrement...' : 'Enregistrer les modifications'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Réinitialisation Mot de passe */}
      {showResetModal && selectedCollab && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface border border-surface-border rounded-2xl w-full max-w-md shadow-2xl p-6 relative animate-in fade-in zoom-in-95 duration-150">
            <h3 className="text-base font-bold font-heading text-foreground flex items-center gap-2">
              <Key className="h-5 w-5 text-amber-500" />
              Réinitialiser le mot de passe
            </h3>
            <p className="text-xs text-foreground-muted mt-1">
              Définissez un mot de passe provisoire pour <strong>{selectedCollab.nom_complet || selectedCollab.identifiant}</strong>.
            </p>

            {modalError && (
              <div className="mt-4 p-3 rounded-lg bg-danger/10 border border-danger/20 text-danger text-xs font-medium flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleResetPassword} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-foreground">
                  Nouveau mot de passe provisoire
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

              <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 flex items-start gap-2.5">
                <input
                  type="checkbox"
                  id="reset_doit_changer_mdp_intrants"
                  name="doit_changer_mot_de_passe"
                  defaultChecked
                  className="mt-0.5 h-4 w-4 rounded border-surface-border text-amber-600 focus:ring-amber-500 cursor-pointer"
                />
                <label htmlFor="reset_doit_changer_mdp_intrants" className="text-xs text-foreground cursor-pointer">
                  <span className="font-semibold block">Forcer le changement lors de la connexion</span>
                  <span className="text-foreground-muted text-[11px] block mt-0.5">
                    L&apos;utilisateur devra choisir son propre mot de passe après avoir saisi celui-ci.
                  </span>
                </label>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-surface-border">
                <button
                  type="button"
                  onClick={() => handleGenerateResetLink(selectedCollab)}
                  className="text-xs text-primary hover:underline font-medium"
                >
                  Générer un lien
                </button>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowResetModal(false)}
                    className="rounded-xl border border-surface-border px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-background"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={isPending}
                    className="rounded-xl bg-amber-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-amber-700 disabled:opacity-50 cursor-pointer"
                  >
                    {isPending ? 'Mise à jour...' : 'Définir le mot de passe'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Nouveau Magasin */}
      {showMagasinModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface border border-surface-border rounded-2xl w-full max-w-md shadow-2xl p-6 relative animate-in fade-in zoom-in-95 duration-150">
            <h3 className="text-base font-bold font-heading text-foreground flex items-center gap-2">
              <Store className="h-5 w-5 text-primary" />
              Nouveau point de vente (Magasin)
            </h3>
            <p className="text-xs text-foreground-muted mt-1">
              Ajoutez un nouveau magasin ou dépôt pour vos intrants ({magList.length} / {magasinsMax} autorisés).
            </p>

            {modalError && (
              <div className="mt-4 p-3 rounded-lg bg-danger/10 border border-danger/20 text-danger text-xs font-medium flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleAddMagasin} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-foreground">
                  Nom du point de vente / magasin <span className="text-danger">*</span>
                </label>
                <input
                  type="text"
                  name="nom"
                  required
                  placeholder="ex: Dépôt Saint-Louis, Magasin Kaolack"
                  className="mt-1 block w-full rounded-xl border border-surface-border bg-background px-3 py-2 text-xs text-foreground focus:border-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-foreground">
                  Adresse / Emplacement
                </label>
                <input
                  type="text"
                  name="adresse"
                  placeholder="ex: Zone Industrielle, Kaolack"
                  className="mt-1 block w-full rounded-xl border border-surface-border bg-background px-3 py-2 text-xs text-foreground focus:border-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-foreground">
                  Téléphone du point de vente
                </label>
                <input
                  type="tel"
                  name="telephone"
                  placeholder="ex: +221 33 900 00 00"
                  className="mt-1 block w-full rounded-xl border border-surface-border bg-background px-3 py-2 text-xs text-foreground focus:border-primary focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-surface-border">
                <button
                  type="button"
                  onClick={() => setShowMagasinModal(false)}
                  className="rounded-xl border border-surface-border px-4 py-2 text-xs font-semibold text-foreground hover:bg-background"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="rounded-xl bg-primary px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-primary/90 disabled:opacity-50 cursor-pointer"
                >
                  {isPending ? 'Création...' : 'Créer le magasin'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Lien de Récupération (WhatsApp direct) */}
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

            <div className="mt-4 p-3 rounded-xl border border-surface-border bg-background/80">
              <div className="flex items-center justify-between gap-2">
                <input
                  type="text"
                  readOnly
                  value={activeResetLink.link}
                  className="bg-transparent text-xs text-foreground font-mono w-full focus:outline-none truncate"
                />
                <button
                  type="button"
                  onClick={handleCopy}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-surface border border-surface-border text-xs font-semibold text-foreground hover:bg-background shrink-0"
                >
                  {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Key className="h-3.5 w-3.5 text-primary" />}
                  <span>{copied ? 'Copié !' : 'Copier'}</span>
                </button>
              </div>
            </div>

            {activeResetLink.telephone && (
              <div className="mt-4">
                <a
                  href={`https://wa.me/${activeResetLink.telephone.replace(/\D/g, '')}?text=${encodeURIComponent(
                    `Bonjour ${activeResetLink.nom}, voici votre lien sécurisé pour définir votre mot de passe sur la plateforme : ${activeResetLink.link}`
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 transition-colors"
                >
                  Envoyer par WhatsApp
                </a>
              </div>
            )}

            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => setActiveResetLink(null)}
                className="rounded-xl border border-surface-border px-4 py-2 text-xs font-semibold text-foreground hover:bg-background"
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
