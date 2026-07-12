// Provider-agnostic camera barcode scanner.
//
// Uses the native BarcodeDetector API when available, otherwise falls back to
// @zxing/browser. This module is only ever loaded via dynamic import() from
// the UI so ZXing never lands in the main bundle.

export type BarcodeScanner = {
  start: (video: HTMLVideoElement, onDetect: (code: string) => void) => Promise<void>
  stop: () => void
}

const BARCODE_FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128']
const DETECT_INTERVAL_MS = 250
const DUPLICATE_WINDOW_MS = 2000

// Minimal ambient typing for the (not-yet-standard-lib) BarcodeDetector API.
interface DetectedBarcodeLike {
  rawValue: string
}

interface BarcodeDetectorLike {
  detect(source: CanvasImageSource): Promise<DetectedBarcodeLike[]>
}

interface BarcodeDetectorConstructor {
  new (options: { formats: string[] }): BarcodeDetectorLike
}

function getNativeDetectorCtor(): BarcodeDetectorConstructor | undefined {
  if (!('BarcodeDetector' in window)) return undefined
  return (window as unknown as { BarcodeDetector: BarcodeDetectorConstructor }).BarcodeDetector
}

/** Suppress repeat detections of the same code within a short window. */
function createDetectionDebouncer(onDetect: (code: string) => void): (code: string) => void {
  let lastCode = ''
  let lastAt = 0
  return (code: string) => {
    const now = Date.now()
    if (code === lastCode && now - lastAt < DUPLICATE_WINDOW_MS) return
    lastCode = code
    lastAt = now
    onDetect(code)
  }
}

function createNativeScanner(ctor: BarcodeDetectorConstructor): BarcodeScanner {
  let stream: MediaStream | null = null
  let rafId = 0
  let stopped = false

  return {
    async start(video, onDetect) {
      stopped = false
      const detector = new ctor({ formats: BARCODE_FORMATS })
      const emit = createDetectionDebouncer(onDetect)

      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      })
      video.srcObject = stream
      await video.play()

      let lastDetectAt = 0
      let detecting = false

      const loop = (time: number) => {
        if (stopped) return
        if (time - lastDetectAt >= DETECT_INTERVAL_MS && !detecting && video.readyState >= 2) {
          lastDetectAt = time
          detecting = true
          detector
            .detect(video)
            .then((results) => {
              const raw = results[0]?.rawValue
              if (raw && !stopped) emit(raw)
            })
            .catch(() => {
              // Ignore per-frame detection failures; keep scanning.
            })
            .finally(() => {
              detecting = false
            })
        }
        rafId = requestAnimationFrame(loop)
      }
      rafId = requestAnimationFrame(loop)
    },

    stop() {
      stopped = true
      cancelAnimationFrame(rafId)
      if (stream) {
        for (const track of stream.getTracks()) track.stop()
        stream = null
      }
    },
  }
}

async function createZxingScanner(): Promise<BarcodeScanner> {
  const { BrowserMultiFormatReader } = await import('@zxing/browser')

  let controls: { stop: () => void } | null = null
  let videoEl: HTMLVideoElement | null = null
  let stopped = false

  return {
    async start(video, onDetect) {
      stopped = false
      videoEl = video
      const reader = new BrowserMultiFormatReader()
      const emit = createDetectionDebouncer(onDetect)

      controls = await reader.decodeFromVideoDevice(undefined, video, (result) => {
        if (result && !stopped) emit(result.getText())
      })
    },

    stop() {
      stopped = true
      controls?.stop()
      controls = null
      // decodeFromVideoDevice manages the stream, but belt-and-braces: release
      // anything still attached to the element.
      const src = videoEl?.srcObject
      if (src instanceof MediaStream) {
        for (const track of src.getTracks()) track.stop()
      }
      if (videoEl) videoEl.srcObject = null
      videoEl = null
    },
  }
}

export async function createBarcodeScanner(): Promise<BarcodeScanner> {
  const nativeCtor = getNativeDetectorCtor()
  if (nativeCtor) return createNativeScanner(nativeCtor)
  return createZxingScanner()
}
