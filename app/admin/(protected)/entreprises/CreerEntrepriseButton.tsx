'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'
import { creerEntreprise } from './actions'

export default function CreerEntrepriseButton() {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [nom, setNom] = useState('')
  const [adresse, setAdresse] = useState('')
  const [telephone, setTelephone] = useState('')
  const [email, setEmail] = useState('')
  const [identifiantFiscal, setIdentifiantFiscal] = useState('')
  const [devise, setDevise] = useState('XOF')
  const [isPending, startTransition] = useTransition()
  const [message, setMessage] = useState<string | null>(null)

  const close = () => {
    setIsOpen(false)
    setNom('')
    setAdresse('')
    setTelephone('')
    setEmail('')
    setIdentifiantFiscal('')
    setDevise('XOF')
    setMessage(null)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setMessage(null)
    startTransition(async () => {
      try {
        const result = await creerEntreprise(nom, adresse, telephone, email, identifiantFiscal, devise)
        if (result.error) {
          setMessage(`Erreur : ${result.error}`)
        } else {
          close()
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
        className="flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-hover"
      >
        <Plus className="h-4 w-4" /> Créer une entreprise
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
            <div className="fixed inset-0 bg-black bg-opacity-75 transition-opacity" onClick={close} />

            <div className="relative transform overflow-hidden rounded-lg bg-surface text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-md border border-surface-border">
              <div className="bg-surface px-4 pb-4 pt-5 sm:p-6 sm:pb-4">
                <h3 className="text-lg font-semibold leading-6 text-foreground mb-4">Nouvelle entreprise</h3>

                <form id="creer-entreprise-form" onSubmit={handleSubmit} className="space-y-4">
                  {message && <p className="text-xs text-danger">{message}</p>}
                  <div>
                    <label className="block text-sm font-medium text-foreground">Nom</label>
                    <input
                      type="text"
                      required
                      value={nom}
                      onChange={(e) => setNom(e.target.value)}
                      disabled={isPending}
                      className="mt-1 block w-full rounded-md bg-background border border-surface-border text-foreground px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground">Adresse</label>
                    <input
                      type="text"
                      value={adresse}
                      onChange={(e) => setAdresse(e.target.value)}
                      disabled={isPending}
                      className="mt-1 block w-full rounded-md bg-background border border-surface-border text-foreground px-3 py-2"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-foreground">Téléphone</label>
                      <input
                        type="text"
                        value={telephone}
                        onChange={(e) => setTelephone(e.target.value)}
                        disabled={isPending}
                        className="mt-1 block w-full rounded-md bg-background border border-surface-border text-foreground px-3 py-2"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-foreground">Email</label>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        disabled={isPending}
                        className="mt-1 block w-full rounded-md bg-background border border-surface-border text-foreground px-3 py-2"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-foreground">Identifiant Fiscal (NINEA...)</label>
                      <input
                        type="text"
                        value={identifiantFiscal}
                        onChange={(e) => setIdentifiantFiscal(e.target.value)}
                        disabled={isPending}
                        className="mt-1 block w-full rounded-md bg-background border border-surface-border text-foreground px-3 py-2"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-foreground">Devise</label>
                      <input
                        type="text"
                        value={devise}
                        onChange={(e) => setDevise(e.target.value)}
                        disabled={isPending}
                        className="mt-1 block w-full rounded-md bg-background border border-surface-border text-foreground px-3 py-2"
                      />
                    </div>
                  </div>
                </form>
              </div>
              <div className="bg-background/50 px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6">
                <button
                  type="submit"
                  form="creer-entreprise-form"
                  disabled={isPending}
                  className="inline-flex w-full justify-center rounded-md bg-primary px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-hover sm:ml-3 sm:w-auto disabled:opacity-50"
                >
                  {isPending ? 'Création...' : 'Créer'}
                </button>
                <button
                  type="button"
                  onClick={close}
                  className="mt-3 inline-flex w-full justify-center rounded-md bg-surface px-3 py-2 text-sm font-semibold text-foreground shadow-sm ring-1 ring-inset ring-surface-border hover:bg-background sm:mt-0 sm:w-auto"
                >
                  Annuler
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
