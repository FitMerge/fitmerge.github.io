// Entry point for Health Data Connect: sniffs a picked file and routes it to the right parser.

import { parseAppleHealthFile, parseAppleHealthXml, readAppleExportXml } from './appleHealth'
import { parseFitmergeJson } from './fitmergeJson'
import { parseGarminCsv } from './garminCsv'
import { isFitbitExport, parseFitbitJson, parseFitbitZip } from './fitbitExport'
import type { HealthImportResult } from './types'

export type { HealthImportResult, HealthImportSource, ImportedSessionInput } from './types'
export { sourceLabel } from './types'

function extensionOf(name: string): string {
  const idx = name.lastIndexOf('.')
  return idx >= 0 ? name.slice(idx + 1).toLowerCase() : ''
}

/** A JSON file can be a FitMerge import or a single extracted Fitbit file; try both. */
function parseJsonText(text: string): HealthImportResult {
  try {
    return parseFitmergeJson(text)
  } catch (fitmergeErr) {
    try {
      return parseFitbitJson(text)
    } catch {
      throw fitmergeErr
    }
  }
}

/**
 * A zip is either an Apple Health export (contains export.xml) or a Fitbit Google Takeout
 * export (a "Fitbit/" tree of JSON files). We list the entry names WITHOUT decompressing
 * anything (fflate only inflates entries the filter accepts), decide, then parse — reading
 * the file into memory just once.
 */
async function parseZip(
  file: File,
  onProgress?: (pct: number) => void,
): Promise<HealthImportResult> {
  const buf = new Uint8Array(await file.arrayBuffer())
  const { unzipSync } = await import('fflate')
  const names: string[] = []
  unzipSync(buf, {
    filter: (entry) => {
      names.push(entry.name)
      return false
    },
  })

  if (names.some((n) => /(^|\/)export\.xml$/i.test(n))) {
    return parseAppleHealthXml(await readAppleExportXml(buf), onProgress)
  }
  if (isFitbitExport(names)) {
    return parseFitbitZip(buf, onProgress)
  }
  throw new Error('Unrecognized zip — expected an Apple Health or Fitbit (Google Takeout) export')
}

export async function detectAndParse(
  file: File,
  onProgress?: (pct: number) => void,
): Promise<HealthImportResult> {
  const ext = extensionOf(file.name)

  if (ext === 'json') {
    const text = await file.text()
    return parseJsonText(text)
  }

  if (ext === 'csv') {
    const text = await file.text()
    return parseGarminCsv(text)
  }

  if (ext === 'zip') {
    return parseZip(file, onProgress)
  }

  if (ext === 'xml') {
    return parseAppleHealthFile(file, onProgress)
  }

  // Unknown extension: sniff the content — zip magic bytes, XML declaration, or JSON.
  const head = new Uint8Array(await file.slice(0, 4).arrayBuffer())
  if (head[0] === 0x50 && head[1] === 0x4b) {
    return parseZip(file, onProgress)
  }

  const text = await file.text()
  const trimmed = text.trimStart()
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) return parseJsonText(text)
  if (trimmed.startsWith('<')) return parseAppleHealthFile(file, onProgress)
  return parseGarminCsv(text)
}
