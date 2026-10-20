'use client'

import { getPendingActions, removeAction, updateActionStatus, QueuedAction } from './offline-storage'

export type SyncState = {
  isOnline: boolean
  isSyncing: boolean
  pendingCount: number
  lastSyncTime: number | null
}

type SyncListener = (state: SyncState) => void

class OfflineSyncEngine {
  private isOnline: boolean = typeof navigator !== 'undefined' ? navigator.onLine : true
  private isSyncing: boolean = false
  private pendingCount: number = 0
  private lastSyncTime: number | null = null
  private listeners: Set<SyncListener> = new Set()
  private heartbeatInterval: any = null

  constructor() {
    if (typeof window !== 'undefined') {
      this.init()
    }
  }

  private async init() {
    this.isOnline = navigator.onLine
    await this.refreshPendingCount()

    window.addEventListener('online', () => {
      this.isOnline = true
      this.notifyListeners()
      this.syncNow()
    })

    window.addEventListener('offline', () => {
      this.isOnline = false
      this.notifyListeners()
    })

    window.addEventListener('demba-offline-queue-changed', () => {
      this.refreshPendingCount()
    })

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && navigator.onLine) {
        this.syncNow()
      }
    })

    // Heartbeat every 15s to check connectivity & sync if pending
    this.heartbeatInterval = setInterval(async () => {
      if (navigator.onLine && this.pendingCount > 0 && !this.isSyncing) {
        this.syncNow()
      }
    }, 15000)
  }

  public subscribe(listener: SyncListener): () => void {
    this.listeners.add(listener)
    listener(this.getState())
    return () => this.listeners.delete(listener)
  }

  public getState(): SyncState {
    return {
      isOnline: this.isOnline,
      isSyncing: this.isSyncing,
      pendingCount: this.pendingCount,
      lastSyncTime: this.lastSyncTime
    }
  }

  private notifyListeners() {
    const state = this.getState()
    this.listeners.forEach(l => l(state))
  }

  public async refreshPendingCount() {
    const pending = await getPendingActions()
    this.pendingCount = pending.length
    this.notifyListeners()
  }

  public async syncNow(): Promise<{ success: boolean; syncedCount: number; errors: string[] }> {
    if (this.isSyncing) return { success: false, syncedCount: 0, errors: ['Synchronisation déjà en cours'] }

    // Test actual network reachability
    try {
      const ping = await fetch('/api/offline-sync', { method: 'GET', cache: 'no-store' })
      if (!ping.ok) {
        this.isOnline = false
        this.notifyListeners()
        return { success: false, syncedCount: 0, errors: ['Serveur inaccessible'] }
      }
      this.isOnline = true
    } catch {
      this.isOnline = false
      this.notifyListeners()
      return { success: false, syncedCount: 0, errors: ['Pas de connexion Internet'] }
    }

    const pending = await getPendingActions()
    if (pending.length === 0) {
      this.pendingCount = 0
      this.notifyListeners()
      return { success: true, syncedCount: 0, errors: [] }
    }

    this.isSyncing = true
    this.notifyListeners()

    let syncedCount = 0
    const errors: string[] = []

    try {
      const res = await fetch('/api/offline-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actions: pending })
      })

      if (res.ok) {
        const data = await res.json()
        const syncedIds: string[] = data.syncedIds || []

        for (const id of syncedIds) {
          await removeAction(id)
          syncedCount++
        }

        if (data.failures && data.failures.length > 0) {
          for (const fail of data.failures) {
            await updateActionStatus(fail.id, 'failed', fail.error)
            errors.push(`${fail.label || fail.id}: ${fail.error}`)
          }
        }

        this.lastSyncTime = Date.now()

        window.dispatchEvent(new CustomEvent('demba-offline-synced', {
          detail: { syncedCount, errors }
        }))
      } else {
        const errText = await res.text()
        errors.push(`Erreur serveur (${res.status}): ${errText}`)
      }
    } catch (e: any) {
      errors.push(e?.message || 'Erreur réseau lors de la synchronisation')
    } finally {
      this.isSyncing = false
      await this.refreshPendingCount()
    }

    return { success: errors.length === 0, syncedCount, errors }
  }
}

export const syncEngine = typeof window !== 'undefined' ? new OfflineSyncEngine() : ({} as OfflineSyncEngine)
