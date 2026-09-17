'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { UserPlus } from 'lucide-react'
import { creerUtilisateur } from '../actions'

function genererMotDePasse(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
  const bytes = new Uint32Array(12)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => chars[b % chars.length]).join('')
}

type Magasin = { id: string; nom: string }

export default function AjouterUtilisateurButton({ entrepriseId, magasins }: { entrepriseId: string; magasins: Magasin[] }) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [nom, setNom] = useState('')
  const [prenom, setPrenom] = useState('')
  const [role, setRole] = useState<'admin_entreprise' | 'gerant'>('gerant')
  const [magasinId, setMagasinId] = useState(magasins[0]?.id ?? '')
  const [isPending, startTransition] = useTransition()
  const [message, setMessage] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const close = () => {
    setIsOpen(false)
    setEmail('')
    setPassword('')
    setNom('')
    setPrenom('')
    setRole('gerant')
    setMessage(null)
    setSuccess(null)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setMessage(null)
    setSuccess(null)
    startTransition(async () => {
      try {
        const result = await creerUtilisateur(
          entrepriseId,
          email,
          password,
          role,
          role === 'gerant' ? magasinId : null,
          nom,
          prenom
        )
        if (result.error) {
          setMessage(`Erreur : ${result.error}`)
        } else {
          setSuccess(`Compte créé pour ${email}. Mot de passe : ${password} (à transmettre à l'utilisateur, il ne sera plus affiché).`)
          setEmail('')
          setPassword('')
          router.refresh()
        }
      } catch (err) {
        setMessage(`Erreur inattendue : ${err instanceof Error ? err.message : String(err)}`)
      }
    })
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-hover"
      >
        <UserPlus className="h-4 w-4" /> Ajouter un utilisateur
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
            <div className="fixed inset-0 bg-black bg-opacity-75 transition-opacity" onClick={close} />

            <div className="relative transform overflow-hidden rounded-lg bg-surface text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-md border border-surface-border">
              <div className="bg-surface px-4 pb-4 pt-5 sm:p-6 sm:pb-4">
                <h3 className="text-lg font-semibold leading-6 text-foreground mb-4">
                  Ajouter un utilisateur à cette entreprise
                </h3>

                {success ? (
                  <p className="text-sm text-success bg-success/10 border border-success/20 rounded-md p-3">{success}</p>
                ) : (
                  <form id="add-user-form" onSubmit={handleSubmit} className="space-y-4">
                    {message && <p className="text-xs text-danger">{message}</p>}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-foreground">Prénom</label>
                        <input
                          type="text"
                          value={prenom}
                          onChange={(e) => setPrenom(e.target.value)}
                          disabled={isPending}
                          className="mt-1 block w-full rounded-md bg-background border border-surface-border text-foreground px-3 py-2"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-foreground">Nom</label>
                        <input
                          type="text"
                          value={nom}
                          onChange={(e) => setNom(e.target.value)}
                          disabled={isPending}
                          className="mt-1 block w-full rounded-md bg-background border border-surface-border text-foreground px-3 py-2"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-foreground">Email</label>
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        disabled={isPending}
                        className="mt-1 block w-full rounded-md bg-background border border-surface-border text-foreground px-3 py-2"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-foreground">Mot de passe temporaire</label>
                      <div className="mt-1 flex gap-2">
                        <input
                          type="text"
                          required
                          minLength={6}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          disabled={isPending}
                          className="block w-full rounded-md bg-background border border-surface-border text-foreground px-3 py-2"
                        />
                        <button
                          type="button"
                          onClick={() => setPassword(genererMotDePasse())}
                          disabled={isPending}
                          className="shrink-0 rounded-md bg-surface-border px-3 py-2 text-sm font-medium text-foreground hover:bg-surface-border/70"
                        >
                          Générer
                        </button>
                      </div>
                      <p className="mt-1 text-xs text-foreground-muted">À transmettre vous-même à l&apos;utilisateur (il pourra le changer après connexion).</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-foreground">Rôle</label>
                      <select
                        value={role}
                        onChange={(e) => setRole(e.target.value as 'admin_entreprise' | 'gerant')}
                        disabled={isPending}
                        className="mt-1 block w-full rounded-md bg-background border border-surface-border text-foreground px-3 py-2"
                      >
                        <option value="gerant">Gérant</option>
                        <option value="admin_entreprise">Admin entreprise</option>
                      </select>
                    </div>
                    {role === 'gerant' && (
                      <div>
                        <label className="block text-sm font-medium text-foreground">Magasin</label>
                        <select
                          value={magasinId}
                          onChange={(e) => setMagasinId(e.target.value)}
                          disabled={isPending}
                          required
                          className="mt-1 block w-full rounded-md bg-background border border-surface-border text-foreground px-3 py-2"
                        >
                          <option value="" disabled>Sélectionner un magasin</option>
                          {magasins.map((m) => (
                            <option key={m.id} value={m.id}>{m.nom}</option>
                          ))}
                        </select>
                        {magasins.length === 0 && (
                          <p className="mt-1 text-xs text-danger">Créez d&apos;abord un magasin pour cette entreprise.</p>
                        )}
                      </div>
                    )}
                  </form>
                )}
              </div>
              <div className="bg-background/50 px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6">
                {!success && (
                  <button
                    type="submit"
                    form="add-user-form"
                    disabled={isPending || (role === 'gerant' && magasins.length === 0)}
                    className="inline-flex w-full justify-center rounded-md bg-primary px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-hover sm:ml-3 sm:w-auto disabled:opacity-50"
                  >
                    {isPending ? 'Création...' : 'Créer le compte'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={close}
                  className="mt-3 inline-flex w-full justify-center rounded-md bg-surface px-3 py-2 text-sm font-semibold text-foreground shadow-sm ring-1 ring-inset ring-surface-border hover:bg-background sm:mt-0 sm:w-auto"
                >
                  {success ? 'Fermer' : 'Annuler'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
