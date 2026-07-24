// Rest-timer audio: a 3-2-1 countdown (three low beeps) then a higher "go" tone
// at zero, plus a haptic buzz. The AudioContext must be created/resumed from a
// user gesture (autoplay policy), so callers prime it on a tap (checking a set).

type Ctor = typeof AudioContext
let ctx: AudioContext | null = null

function audioCtor(): Ctor | null {
  if (typeof window === 'undefined') return null
  return window.AudioContext ?? (window as unknown as { webkitAudioContext?: Ctor }).webkitAudioContext ?? null
}

/** Create (once) and resume the AudioContext. Safe to call on every gesture. */
export function primeAudio(): void {
  const Ctor = audioCtor()
  if (!Ctor) return
  if (!ctx) {
    try {
      ctx = new Ctor()
    } catch {
      ctx = null
      return
    }
  }
  if (ctx.state === 'suspended') void ctx.resume()
}

/** One sine blip. delay lets us schedule a couple in quick succession. */
function tone(freq: number, duration: number, peak = 0.3, delay = 0): void {
  if (!ctx || ctx.state !== 'running') return
  const start = ctx.currentTime + delay
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'sine'
  osc.frequency.value = freq
  gain.gain.setValueAtTime(0.0001, start)
  gain.gain.exponentialRampToValueAtTime(peak, start + 0.01)
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration)
  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.start(start)
  osc.stop(start + duration + 0.02)
}

/** A short, low "get ready" blip — one per second at 3, 2, 1 remaining. */
export function beepCountdown(): void {
  tone(520, 0.12, 0.25)
}

/** The higher "go" tone when rest is up — two quick rising notes. */
export function beepDone(): void {
  tone(1046, 0.16, 0.34)
  tone(1318, 0.22, 0.34, 0.16)
}

/** Haptic buzz where supported (Android Chrome; iOS Safari has no Vibration API). */
export function vibrate(pattern: number | number[] = [120, 60, 120]): void {
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    try {
      navigator.vibrate(pattern)
    } catch {
      /* ignore */
    }
  }
}
