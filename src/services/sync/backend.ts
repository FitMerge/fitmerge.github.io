// The transport contract the sync manager talks to. A real implementation
// (Firestore) lives alongside the Firebase glue; an in-memory fake here powers
// deterministic multi-device tests without touching the network.

export type StoreName = 'nutrition' | 'workouts' | 'body' | 'settings'

/** A store's synced data — a plain, JSON-serializable snapshot of its fields. */
export type StoreData = Record<string, unknown>

export interface SyncBackend {
  /** Current cloud snapshot for a store, or null if the account has none yet. */
  get(store: StoreName): Promise<StoreData | null>
  /** Overwrite the cloud snapshot for a store. */
  set(store: StoreName, data: StoreData): Promise<void>
  /**
   * Subscribe to changes made by OTHER devices. The callback must NOT fire for
   * writes this same backend instance made — that is how the manager avoids
   * echo loops. Returns an unsubscribe function.
   */
  subscribe(store: StoreName, cb: (data: StoreData) => void): () => void
}

type Shared = {
  docs: Map<StoreName, { data: StoreData; writer: number }>
  listeners: Set<{ id: number; store: StoreName; cb: (data: StoreData) => void }>
}

/**
 * In-memory backend shared by several "devices". Each `InMemoryBackend` is one
 * device (distinct writer id); a write notifies only listeners belonging to
 * other devices, mirroring Firestore's own-write suppression.
 */
export class InMemoryBackend implements SyncBackend {
  private static counter = 0
  private readonly writerId: number

  constructor(private readonly shared: Shared) {
    InMemoryBackend.counter += 1
    this.writerId = InMemoryBackend.counter
  }

  static createShared(): Shared {
    return { docs: new Map(), listeners: new Set() }
  }

  async get(store: StoreName): Promise<StoreData | null> {
    const doc = this.shared.docs.get(store)
    return doc ? clone(doc.data) : null
  }

  async set(store: StoreName, data: StoreData): Promise<void> {
    const snapshot = clone(data)
    this.shared.docs.set(store, { data: snapshot, writer: this.writerId })
    for (const l of this.shared.listeners) {
      if (l.store === store && l.id !== this.writerId) l.cb(clone(snapshot))
    }
  }

  subscribe(store: StoreName, cb: (data: StoreData) => void): () => void {
    const entry = { id: this.writerId, store, cb }
    this.shared.listeners.add(entry)
    return () => this.shared.listeners.delete(entry)
  }
}

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T
}
