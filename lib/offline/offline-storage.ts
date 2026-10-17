'use client'

export interface QueuedAction {
  id: string
  actionType: string
  label: string
  payload: any
  createdAt: string
  retryCount: number
  status: 'pending' | 'syncing' | 'failed'
  error?: string
}

const DB_NAME = 'demba_offline_dintrants'
const DB_VERSION = 1
const STORE_QUEUE = 'pending_queue'
const STORE_SNAPSHOTS = 'snapshots'

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB not supported'))
    }
    const request = window.indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result
      if (!db.objectStoreNames.contains(STORE_QUEUE)) {
        db.createObjectStore(STORE_QUEUE, { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains(STORE_SNAPSHOTS)) {
        db.createObjectStore(STORE_SNAPSHOTS, { keyPath: 'key' })
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function getLocalQueue(): QueuedAction[] {
  try {
    const raw = localStorage.getItem('demba_offline_dintrants_queue')
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveLocalQueue(queue: QueuedAction[]) {
  try {
    localStorage.setItem('demba_offline_dintrants_queue', JSON.stringify(queue))
  } catch (e) {
    console.error('LocalStorage write failed:', e)
  }
}

export async function enqueueAction(action: Omit<QueuedAction, 'id' | 'createdAt' | 'retryCount' | 'status'>): Promise<QueuedAction> {
  const queuedItem: QueuedAction = {
    ...action,
    id: `act_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
    createdAt: new Date().toISOString(),
    retryCount: 0,
    status: 'pending'
  }

  try {
    const db = await openDB()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_QUEUE, 'readwrite')
      tx.objectStore(STORE_QUEUE).add(queuedItem)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } catch {
    const queue = getLocalQueue()
    queue.push(queuedItem)
    saveLocalQueue(queue)
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('demba-offline-queue-changed'))
  }

  return queuedItem
}

export async function getPendingActions(): Promise<QueuedAction[]> {
  try {
    const db = await openDB()
    return await new Promise<QueuedAction[]>((resolve, reject) => {
      const tx = db.transaction(STORE_QUEUE, 'readonly')
      const req = tx.objectStore(STORE_QUEUE).getAll()
      req.onsuccess = () => resolve(req.result || [])
      req.onerror = () => reject(req.error)
    })
  } catch {
    return getLocalQueue()
  }
}

export async function removeAction(id: string): Promise<void> {
  try {
    const db = await openDB()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_QUEUE, 'readwrite')
      tx.objectStore(STORE_QUEUE).delete(id)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } catch {
    const queue = getLocalQueue().filter(a => a.id !== id)
    saveLocalQueue(queue)
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('demba-offline-queue-changed'))
  }
}

export async function updateActionStatus(id: string, status: 'pending' | 'syncing' | 'failed', error?: string): Promise<void> {
  try {
    const db = await openDB()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_QUEUE, 'readwrite')
      const store = tx.objectStore(STORE_QUEUE)
      const req = store.get(id)
      req.onsuccess = () => {
        const item: QueuedAction = req.result
        if (item) {
          item.status = status
          if (error) item.error = error
          item.retryCount = (item.retryCount || 0) + (status === 'failed' ? 1 : 0)
          store.put(item)
        }
        resolve()
      }
      req.onerror = () => reject(req.error)
    })
  } catch {
    const queue = getLocalQueue()
    const item = queue.find(a => a.id === id)
    if (item) {
      item.status = status
      if (error) item.error = error
      item.retryCount = (item.retryCount || 0) + (status === 'failed' ? 1 : 0)
      saveLocalQueue(queue)
    }
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('demba-offline-queue-changed'))
  }
}

export async function clearAllPending(): Promise<void> {
  try {
    const db = await openDB()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_QUEUE, 'readwrite')
      tx.objectStore(STORE_QUEUE).clear()
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } catch {
    saveLocalQueue([])
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('demba-offline-queue-changed'))
  }
}
