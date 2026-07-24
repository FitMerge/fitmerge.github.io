// IndexedDB-backed storage for food photo thumbnails, via Dexie.
// We keep only a small cropped thumbnail (see lib/image.ts dataUrlToThumb) —
// never the full-resolution photo — to keep storage light.

import Dexie, { type Table } from 'dexie'
import { uid } from '../lib/id'

type PhotoThumb = {
  id: string
  dataUrl: string
}

class FitmergeDB extends Dexie {
  thumbs!: Table<PhotoThumb, string>

  constructor() {
    super('fitmerge')
    this.version(1).stores({
      thumbs: 'id',
    })
  }
}

const db = new FitmergeDB()

export async function savePhotoThumb(dataUrl: string): Promise<string> {
  const id = uid()
  await db.thumbs.put({ id, dataUrl })
  return id
}

export async function getPhotoThumb(id: string): Promise<string | undefined> {
  const record = await db.thumbs.get(id)
  return record?.dataUrl
}

export async function deletePhotoThumb(id: string): Promise<void> {
  await db.thumbs.delete(id)
}
