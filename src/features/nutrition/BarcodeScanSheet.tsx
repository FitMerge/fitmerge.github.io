import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, Loader2 } from 'lucide-react'
import Button from '../../components/Button'
import { fetchProductByBarcode } from '../../services/foodSearch/openFoodFacts'
import type { SearchFood } from '../../services/foodSearch/openFoodFacts'
import type { BarcodeScanner } from '../../services/barcode/scanner'

type Stage = 'starting' | 'scanning' | 'looking-up' | 'camera-error' | 'not-found' | 'lookup-error'

type BarcodeScanSheetProps = {
  onBack: () => void
  onFound: (food: SearchFood) => void
}

const MANUAL_CODE_RE = /^\d{8,14}$/

export default function BarcodeScanSheet({ onBack, onFound }: BarcodeScanSheetProps) {
  const [stage, setStage] = useState<Stage>('starting')
  const [cameraFailed, setCameraFailed] = useState(false)
  const [activeCode, setActiveCode] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [manualCode, setManualCode] = useState('')

  const videoRef = useRef<HTMLVideoElement>(null)
  const scannerRef = useRef<BarcodeScanner | null>(null)
  const lookupRef = useRef<AbortController | null>(null)
  const stageRef = useRef<Stage>('starting')
  const unmountedRef = useRef(false)

  stageRef.current = stage

  useEffect(() => {
    unmountedRef.current = false
    let cancelled = false

    async function boot() {
      const video = videoRef.current
      if (!video) return
      try {
        const { createBarcodeScanner } = await import('../../services/barcode/scanner')
        const scanner = await createBarcodeScanner()
        if (cancelled) {
          scanner.stop()
          return
        }
        scannerRef.current = scanner
        await scanner.start(video, handleDetect)
        if (cancelled) {
          scanner.stop()
          return
        }
        setStage('scanning')
      } catch {
        if (!cancelled) {
          setCameraFailed(true)
          setStage('camera-error')
        }
      }
    }

    void boot()

    return () => {
      cancelled = true
      unmountedRef.current = true
      scannerRef.current?.stop()
      scannerRef.current = null
      lookupRef.current?.abort()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function stopCamera() {
    scannerRef.current?.stop()
    scannerRef.current = null
  }

  function lookup(code: string) {
    lookupRef.current?.abort()
    const controller = new AbortController()
    lookupRef.current = controller

    setActiveCode(code)
    setErrorMessage('')
    setStage('looking-up')

    fetchProductByBarcode(code, controller.signal)
      .then((food) => {
        if (unmountedRef.current || controller.signal.aborted) return
        if (food) {
          stopCamera()
          onFound(food)
        } else {
          setStage('not-found')
        }
      })
      .catch((err: unknown) => {
        if (unmountedRef.current) return
        if (err instanceof DOMException && err.name === 'AbortError') return
        setErrorMessage(err instanceof Error ? err.message : 'Barcode lookup failed — please try again')
        setStage('lookup-error')
      })
  }

  function handleDetect(code: string) {
    if (unmountedRef.current) return
    if (stageRef.current === 'looking-up') return
    lookup(code)
  }

  function handleBack() {
    stopCamera()
    lookupRef.current?.abort()
    onBack()
  }

  function handleTryAgain() {
    setErrorMessage('')
    // If the camera never started there is nothing to resume — stay in the
    // manual-entry-focused error state until a new lookup is attempted.
    setStage(cameraFailed || !scannerRef.current ? 'camera-error' : 'scanning')
  }

  const manualValid = MANUAL_CODE_RE.test(manualCode)

  let caption: string
  switch (stage) {
    case 'starting':
      caption = 'Starting camera…'
      break
    case 'looking-up':
      caption = `Looking up ${activeCode}…`
      break
    case 'camera-error':
      caption = 'Camera unavailable — enter the barcode below'
      break
    case 'not-found':
      caption = 'No product found for this barcode'
      break
    case 'lookup-error':
      caption = errorMessage
      break
    default:
      caption = 'Point at a barcode…'
  }

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={handleBack}
        className="flex items-center gap-1 text-sm text-slate-400 active:text-slate-200"
      >
        <ChevronLeft size={16} />
        Back to search
      </button>

      {cameraFailed ? (
        <div className="rounded-xl bg-slate-900 border border-slate-800 px-4 py-8 text-center">
          <p className="text-sm text-slate-500">Camera unavailable — enter the barcode below</p>
        </div>
      ) : (
        <div className="relative rounded-xl overflow-hidden bg-black aspect-[4/3]">
          <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />

          {stage === 'starting' && (
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 size={28} className="animate-spin text-primary-400" />
            </div>
          )}

          {(stage === 'scanning' || stage === 'looking-up') && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="w-3/4 h-1/3 rounded-lg border-2 border-emerald-400/70 animate-pulse" />
            </div>
          )}
        </div>
      )}

      {stage !== 'camera-error' && (
        <p
          className={`text-center text-sm ${
            stage === 'not-found' || stage === 'lookup-error' ? 'text-red-400' : 'text-slate-400'
          }`}
        >
          {caption}
        </p>
      )}

      {(stage === 'not-found' || stage === 'lookup-error') && (
        <Button variant="ghost" full onClick={handleTryAgain}>
          Try again
        </Button>
      )}

      <div className="flex gap-2">
        <input
          type="text"
          inputMode="numeric"
          value={manualCode}
          onChange={(e) => setManualCode(e.target.value.replace(/\D/g, ''))}
          onFocus={(e) => e.currentTarget.select()}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              e.currentTarget.blur()
              if (manualValid && stage !== 'looking-up') lookup(manualCode)
            }
          }}
          enterKeyHint="go"
          placeholder="Or type barcode digits"
          className="min-w-0 flex-1 bg-slate-800 rounded-lg px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-primary-500"
        />
        <Button
          variant="ghost"
          className="shrink-0"
          disabled={!manualValid || stage === 'looking-up'}
          onClick={() => lookup(manualCode)}
        >
          Look up
        </Button>
      </div>
    </div>
  )
}
