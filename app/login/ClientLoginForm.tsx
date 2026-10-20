'use client'

import { useState, useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { WifiOff, Wifi, User, Lock, AlertCircle, CheckCircle2, ShieldCheck } from 'lucide-react'
import PasswordInput from '@/components/PasswordInput'
import { login, type LoginActionResult } from './actions'
import {
  cacheOfflineAccount,
  verifyOfflineCredentials,
  getOfflineSession,
} from '@/lib/offline/offline-auth'

export default function ClientLoginForm({
  dict,
  initialMessage,
}: {
  dict: any
  initialMessage?: string
}) {
  const router = useRouter()
  const t = dict.auth.login

  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  )
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState<string | null>(initialMessage || null)
  const [successNotice, setSuccessNotice] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // Vérifier si une session hors-ligne valide est déjà active
    const activeSession = getOfflineSession()
    if (activeSession && !navigator.onLine) {
      setSuccessNotice(`Session locale détectée pour ${activeSession.user.nomComplet || activeSession.user.identifiant}.`)
    }

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setMessage(null)
    setSuccessNotice(null)

    const cleanIdentifier = identifier.trim()
    if (!cleanIdentifier || !password) {
      setMessage('Veuillez renseigner votre identifiant et votre mot de passe.')
      return
    }

    // 1. CAS HORS-LIGNE DIRECT (Pas d'accès Internet)
    if (!isOnline || !navigator.onLine) {
      startTransition(async () => {
        const offRes = await verifyOfflineCredentials(cleanIdentifier, password)
        if (offRes.success && offRes.session) {
          document.cookie = 'demba_offline_active=1; path=/; max-age=2592000; SameSite=Lax'
          setSuccessNotice('Connexion locale validée ! Accès à votre espace hors-ligne...')
          setTimeout(() => {
            window.location.href = '/dashboard'
          }, 600)
        } else {
          setMessage(offRes.error || 'Identifiant ou mot de passe incorrect en mode hors-ligne.')
        }
      })
      return
    }

    // 2. CAS EN LIGNE (Tentative de connexion réseau standard avec fallback hors-ligne automatique)
    startTransition(async () => {
      const formData = new FormData()
      formData.set('email', cleanIdentifier)
      formData.set('password', password)

      try {
        const res: LoginActionResult = await login(formData)

        if (res.error) {
          // Si l'erreur ressemble à une rupture de réseau transitoire, tentative de fallback hors-ligne
          if (res.error.toLowerCase().includes('fetch') || res.error.toLowerCase().includes('réseau') || res.error.toLowerCase().includes('network')) {
            const offRes = await verifyOfflineCredentials(cleanIdentifier, password)
            if (offRes.success) {
              document.cookie = 'demba_offline_active=1; path=/; max-age=2592000; SameSite=Lax'
              setSuccessNotice('Réseau instable : connexion locale hors-ligne activée !')
              setTimeout(() => {
                window.location.href = '/dashboard'
              }, 600)
              return
            }
          }
          setMessage(res.error)
          return
        }

        if (res.success) {
          // Mémorisation sécurisée des identifiants dans le cache hors-ligne (IndexedDB)
          if (res.userContext) {
            try {
              await cacheOfflineAccount(cleanIdentifier, password, res.userContext)
            } catch (err) {
              console.warn('Erreur mise en cache hors-ligne:', err)
            }
          }

          document.cookie = 'demba_offline_active=1; path=/; max-age=2592000; SameSite=Lax'

          // Pré-mettre en cache le shell du dashboard en tâche de fond
          if ('caches' in window) {
            try {
              const cache = await caches.open('demba-offline-dintrants-v3')
              const dashRes = await fetch('/dashboard')
              if (dashRes && dashRes.ok) {
                await cache.put('/dashboard', dashRes)
              }
            } catch (cacheErr) {
              console.warn('Erreur pré-mise en cache dashboard shell:', cacheErr)
            }
          }

          setSuccessNotice('Connexion réussie ! Redirection...')
          window.location.href = res.redirectUrl || '/dashboard'
        }
      } catch (networkError: any) {
        // En cas d'échec total de communication avec le serveur (coupure brutale)
        const offRes = await verifyOfflineCredentials(cleanIdentifier, password)
        if (offRes.success) {
          document.cookie = 'demba_offline_active=1; path=/; max-age=2592000; SameSite=Lax'
          setSuccessNotice('Connexion hors-ligne de secours validée !')
          setTimeout(() => {
            window.location.href = '/dashboard'
          }, 600)
        } else {
          setMessage(
            'Impossible de joindre le serveur et aucun compte hors-ligne synchronisé trouvé. Vérifiez votre connexion Internet.'
          )
        }
      }
    })
  }

  return (
    <div className="space-y-6">
      {/* Alerte Mode Réseau / Hors-ligne */}
      {!isOnline && (
        <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-200 text-xs font-medium flex items-start gap-2.5 animate-in fade-in">
          <WifiOff className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
          <div>
            <strong className="font-semibold block">Connexion Directe Hors-Ligne Active</strong>
            Pas de connexion Internet. Connectez-vous avec vos identifiants habituels pour accéder au catalogue et enregistrer vos opérations en local.
          </div>
        </div>
      )}

      {message && (
        <div className="p-3.5 rounded-xl bg-danger/10 border border-danger/20 text-danger text-xs font-medium flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{message}</span>
        </div>
      )}

      {successNotice && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
          <span>{successNotice}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label htmlFor="identifier" className="block text-xs font-semibold uppercase tracking-wider text-foreground">
            Identifiant, Téléphone ou E-mail
          </label>
          <div className="mt-2 relative">
            <input
              id="identifier"
              name="email"
              type="text"
              autoComplete="username"
              required
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="ex: amadou_ba ou +221 77 123 45 67"
              className="block w-full rounded-xl border border-surface-border bg-surface px-3.5 py-2.5 text-sm text-foreground placeholder:text-foreground-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary shadow-xs"
            />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between">
            <label htmlFor="password" className="block text-xs font-semibold uppercase tracking-wider text-foreground">
              {t.password}
            </label>
            {isOnline && (
              <a href="/forgot-password" className="text-xs font-semibold text-primary hover:underline">
                {t.forgotPassword}
              </a>
            )}
          </div>
          <div className="mt-2">
            <PasswordInput
              id="password"
              name="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="block w-full rounded-xl border border-surface-border bg-surface px-3.5 py-2.5 text-sm text-foreground shadow-xs focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>

        <div>
          <button
            type="submit"
            disabled={isPending}
            className="flex w-full justify-center items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-white shadow-md hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-50 transition-all cursor-pointer"
          >
            {isPending ? (
              <span>Vérification...</span>
            ) : !isOnline ? (
              <>
                <WifiOff className="h-4 w-4" />
                <span>Se connecter en local (Hors-ligne)</span>
              </>
            ) : (
              <>
                <ShieldCheck className="h-4 w-4" />
                <span>{t.submit}</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}
