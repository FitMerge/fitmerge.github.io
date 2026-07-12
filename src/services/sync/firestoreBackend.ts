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
    const data = snap.data() as StoredDoc
    return isStoreData(data.payload) ? data.payload : null
  }

  async set(store: StoreName, data: StoreData): Promise<void> {
    await setDoc(this.ref(store), {
      payload: data,
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
      if (isStoreData(data.payload)) cb(data.payload)
    })
  }
}

function isStoreData(value: unknown): value is StoreData {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}
