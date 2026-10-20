'use client'

import {
  findOfflineAccount,
  saveOfflineAccount,
  getOfflineAccounts,
  removeOfflineAccount,
  type OfflineStoredAccount,
} from './offline-storage'
import { normaliserIdentifiant } from '../auth-identifier'

export interface OfflineUserContext {
  userId: string
  nomComplet?: string | null
  identifiant: string
  telephone?: string | null
  email?: string | null
  role: string
  entrepriseId: string
  entrepriseNom: string
  magasinId?: string | null
  magasinNom?: string | null
  devise?: string
  permissions?: any
}

export interface OfflineSession {
  user: OfflineUserContext
  isOffline: boolean
  token: string
  createdAt: string
  expiresAt: number
}

const STORAGE_SESSION_KEY = 'demba_offline_session_active'
const COOKIE_OFFLINE_KEY = 'demba_offline_active'

/**
 * Génère un sel cryptographique aléatoire
 */
export function generateSalt(): string {
  if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
    const bytes = new Uint8Array(16)
    window.crypto.getRandomValues(bytes)
    return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
  }
  return Math.random().toString(36).substring(2) + Date.now().toString(36)
}

/**
 * Hachage sécurisé d'un mot de passe avec sel via Web Crypto API (SHA-256)
 */
export async function hashPasswordWithSalt(password: string, salt: string): Promise<string> {
  if (typeof window === 'undefined' || !window.crypto || !window.crypto.subtle) {
    // Fallback pseudo-hash basique en environnement sans WebCrypto
    let hash = 0
    const str = `demba:${salt}:${password}`
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i)
      hash |= 0
    }
    return Math.abs(hash).toString(16)
  }

  const encoder = new TextEncoder()
  const data = encoder.encode(`demba_salt:${salt}:${password}`)
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Enregistre ou met à jour les identifiants d'un compte pour authentification locale hors-ligne
 */
export async function cacheOfflineAccount(
  rawIdentifier: string,
  password: string,
  context: OfflineUserContext
): Promise<void> {
  if (!password || !rawIdentifier) return

  const salt = generateSalt()
  const passwordHash = await hashPasswordWithSalt(password, salt)

  const idList = [
    normaliserIdentifiant(rawIdentifier),
    context.identifiant ? normaliserIdentifiant(context.identifiant) : null,
    context.telephone ? normaliserIdentifiant(context.telephone) : null,
    context.email ? normaliserIdentifiant(context.email) : null,
  ].filter(Boolean) as string[]

  const uniqueIdentifiers = Array.from(new Set(idList))

  const account: OfflineStoredAccount = {
    id: context.userId,
    identifier: normaliserIdentifiant(rawIdentifier),
    identifiers: uniqueIdentifiers,
    salt,
    passwordHash,
    userContext: context,
    lastLoginAt: new Date().toISOString(),
  }

  await saveOfflineAccount(account)
}

/**
 * Vérifie les identifiants en local (mode hors-ligne direct sans connexion Internet)
 */
export async function verifyOfflineCredentials(
  identifierOrPhone: string,
  password: string
): Promise<{ success: boolean; session?: OfflineSession; error?: string }> {
  if (!identifierOrPhone || !identifierOrPhone.trim()) {
    return { success: false, error: "Veuillez renseigner votre identifiant, téléphone ou e-mail." }
  }
  if (!password) {
    return { success: false, error: "Veuillez renseigner votre mot de passe." }
  }

  const account = await findOfflineAccount(identifierOrPhone)
  if (!account) {
    return {
      success: false,
      error: "Ce compte n'est pas encore synchronisé pour la connexion hors-ligne sur cet appareil. Connectez-vous au moins une fois avec Internet.",
    }
  }

  const computedHash = await hashPasswordWithSalt(password, account.salt)
  if (computedHash !== account.passwordHash) {
    return {
      success: false,
      error: "Mot de passe incorrect pour le compte hors-ligne.",
    }
  }

  // Création de la session locale sécurisée
  const now = Date.now()
  const session: OfflineSession = {
    user: account.userContext,
    isOffline: true,
    token: `demba_off_${now}_${Math.random().toString(36).substring(2, 9)}`,
    createdAt: new Date().toISOString(),
    expiresAt: now + 30 * 24 * 60 * 60 * 1000, // 30 jours
  }

  setOfflineSession(session)

  // Mise à jour de la date de dernier accès
  account.lastLoginAt = new Date().toISOString()
  await saveOfflineAccount(account)

  return { success: true, session }
}

/**
 * Sauvegarde la session locale dans le stockage et pose le cookie indicatif
 */
export function setOfflineSession(session: OfflineSession): void {
  if (typeof window === 'undefined') return

  try {
    const raw = JSON.stringify(session)
    sessionStorage.setItem(STORAGE_SESSION_KEY, raw)
    localStorage.setItem(STORAGE_SESSION_KEY, raw)
    // Cookie session pour informer le middleware client
    document.cookie = `${COOKIE_OFFLINE_KEY}=1; path=/; max-age=2592000; SameSite=Lax`
  } catch (e) {
    console.error('Erreur stockage session hors-ligne:', e)
  }
}

/**
 * Récupère la session hors-ligne courante
 */
export function getOfflineSession(): OfflineSession | null {
  if (typeof window === 'undefined') return null

  try {
    let raw = sessionStorage.getItem(STORAGE_SESSION_KEY)
    if (!raw) raw = localStorage.getItem(STORAGE_SESSION_KEY)
    if (!raw) return null

    const session: OfflineSession = JSON.parse(raw)
    if (session.expiresAt && Date.now() > session.expiresAt) {
      clearOfflineSession()
      return null
    }
    return session
  } catch {
    return null
  }
}

/**
 * Supprime la session hors-ligne
 */
export function clearOfflineSession(): void {
  if (typeof window === 'undefined') return

  try {
    sessionStorage.removeItem(STORAGE_SESSION_KEY)
    localStorage.removeItem(STORAGE_SESSION_KEY)
    document.cookie = `${COOKIE_OFFLINE_KEY}=; path=/; max-age=0`
  } catch {}
}
