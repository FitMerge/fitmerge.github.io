// Firestore implementation of the SyncBackend contract (see backend.ts). This
// module is only ever reached via a dynamic import from AuthProvider once a
// user is signed in, so pulling in `firebase/firestore` statically here does
// NOT put Firebase in the main entry chunk.

import {
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  serverTimestamp,
  type Firestore,
} from 'firebase/firestore'
import { uid } from '../../lib/id'
import type { StoreData, StoreName, SyncBackend } from './backend'

/** Stable id for this tab/session — lets us ignore Firestore's echo of our own writes. */
const CLIENT_ID = uid()

type StoredDoc = {
  payload?: unknown
  clientId?: unknown
}

export class FirestoreBackend implements SyncBackend {
  constructor(
    private readonly db: Firestore,
    private readonly uid: string,
  ) {}

  private ref(store: StoreName) {
    return doc(this.db, 'users', this.uid, 'state', store)
  }

  async get(store: StoreName): Promise<StoreData | null> {
    const snap = await getDoc(this.ref(store))
    if (!snap.exists()) return null
    return decodePayload((snap.data() as StoredDoc).payload)
  }

  async set(store: StoreName, data: StoreData): Promise<void> {
    await setDoc(this.ref(store), {
      // Store the payload as a single JSON string, NOT a nested map. Firestore's
      // 1MB document limit counts every nested field name, so a large map (years of
      // daily health metrics = tens of thousands of fields) blows past 1MB and the
      // write is rejected. A JSON string is just its byte length — the same data
      // fits comfortably. Reads accept both the string and legacy nested-map form.
      payload: JSON.stringify(data),
      clientId: CLIENT_ID,
      updatedAt: serverTimestamp(),
    })
  }

  subscribe(store: StoreName, cb: (data: StoreData) => void): () => void {
    return onSnapshot(this.ref(store), { includeMetadataChanges: false }, (snap) => {
      if (!snap.exists()) return
      if (snap.metadata.hasPendingWrites) return // our own write, not yet confirmed remotely
      const data = snap.data() as StoredDoc
      if (data.clientId === CLIENT_ID) return // echo of our own write
      const decoded = decodePayload(data.payload)
      if (decoded) cb(decoded)
    })
  }
}

function isStoreData(value: unknown): value is StoreData {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

/** Accepts the current JSON-string payload or a legacy nested-object payload. */
function decodePayload(payload: unknown): StoreData | null {
  if (typeof payload === 'string') {
    try {
      const parsed: unknown = JSON.parse(payload)
      return isStoreData(parsed) ? parsed : null
    } catch {
      return null
    }
  }
  return isStoreData(payload) ? payload : null
}
