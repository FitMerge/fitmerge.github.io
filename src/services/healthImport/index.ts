// Entry point for Health Data Connect: sniffs a picked file and routes it to the right parser.

import { parseAppleHealthFile } from './appleHealth'
import { parseFitmergeJson } from './fitmergeJson'
import { parseGarminCsv } from './garminCsv'
import type { HealthImportResult } from './types'

export type { HealthImportResult, HealthImportSource, ImportedSessionInput } from './types'
export { sourceLabel } from './types'

function extensionOf(name: string): string {
  const idx = name.lastIndexOf('.')
  return idx >= 0 ? name.slice(idx + 1).toLowerCase() : ''
}

export async function detectAndParse(
  file: File,
  onProgress?: (pct: number) => void,
): Promise<HealthImportResult> {
  const ext = extensionOf(file.name)

  if (ext === 'json') {
    const text = await file.text()
    return parseFitmergeJson(text)
  }

  if (ext === 'csv') {
    const text = await file.text()
    return parseGarminCsv(text)
  }

  if (ext === 'zip' || ext === 'xml') {
    return parseAppleHealthFile(file, onProgress)
  }

  // Unknown extension: sniff the content — zip magic bytes, XML declaration, or JSON.
  const head = new Uint8Array(await file.slice(0, 4).arrayBuffer())
  if (head[0] === 0x50 && head[1] === 0x4b) {
    return parseAppleHealthFile(file, onProgress)
  }

  const text = await file.text()
  const trimmed = text.trimStart()
  if (trimmed.startsWith('{')) return parseFitmergeJson(text)
  if (trimmed.startsWith('<')) return parseAppleHealthFile(file, onProgress)
  return parseGarminCsv(text)
}
