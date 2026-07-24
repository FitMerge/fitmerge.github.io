// Tiny WebAudio ding + haptic buzz for the rest timer. The AudioContext must be
// created/resumed from a user gesture (browser autoplay policy), so callers should
// invoke primeAudio() on a tap (e.g. checking a set) before the timer fires.

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

/** A short two-tone ding. No-op if audio was never primed / isn't available. */
export function beep(): void {
  if (!ctx || ctx.state !== 'running') return
  const now = ctx.currentTime
  for (const [i, freq] of [880, 1320].entries()) {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.value = freq
    const start = now + i * 0.16
    gain.gain.setValueAtTime(0.0001, start)
    gain.gain.exponentialRampToValueAtTime(0.35, start + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.15)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(start)
    osc.stop(start + 0.16)
  }
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
