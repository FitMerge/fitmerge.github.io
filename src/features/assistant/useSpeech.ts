import { useCallback, useEffect, useRef, useState } from 'react'

// Minimal typings for the Web Speech API (not in the default DOM lib). It's a free,
// browser-native speech-to-text engine — no API key, no quota — so voice logging
// costs nothing; only the follow-up text parse hits Gemini.
type SpeechRecognitionAlternative = { transcript: string }
type SpeechRecognitionResult = { 0: SpeechRecognitionAlternative; isFinal: boolean; length: number }
type SpeechRecognitionResultList = { length: number; [i: number]: SpeechRecognitionResult }
type SpeechRecognitionEventLike = { resultIndex: number; results: SpeechRecognitionResultList }
type SpeechRecognitionLike = {
  lang: string
  continuous: boolean
  interimResults: boolean
  start: () => void
  stop: () => void
  abort: () => void
  onresult: ((e: SpeechRecognitionEventLike) => void) | null
  onerror: ((e: { error?: string }) => void) | null
  onend: (() => void) | null
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike

function getCtor(): SpeechRecognitionCtor | null {
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor
    webkitSpeechRecognition?: SpeechRecognitionCtor
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

export type UseSpeech = {
  supported: boolean
  listening: boolean
  interim: string
  error: string | null
  start: () => void
  stop: () => void
}

/**
 * Dictation hook. Calls `onFinal` with the recognized transcript when the user
 * stops speaking. `interim` streams the live partial text for display. Degrades to
 * `supported: false` where the API is absent (older browsers / some iOS PWAs) so the
 * caller can hide the mic and keep the text field.
 */
export function useSpeech(onFinal: (text: string) => void): UseSpeech {
  const [supported] = useState(() => getCtor() !== null)
  const [listening, setListening] = useState(false)
  const [interim, setInterim] = useState('')
  const [error, setError] = useState<string | null>(null)
  const recRef = useRef<SpeechRecognitionLike | null>(null)
  const finalRef = useRef(onFinal)
  finalRef.current = onFinal

  const stop = useCallback(() => {
    recRef.current?.stop()
  }, [])

  const start = useCallback(() => {
    const Ctor = getCtor()
    if (!Ctor) return
    setError(null)
    setInterim('')
    const rec = new Ctor()
    rec.lang = navigator.language || 'en-US'
    rec.continuous = false
    rec.interimResults = true
    rec.onresult = (e) => {
      let finalText = ''
      let interimText = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i]
        if (r.isFinal) finalText += r[0].transcript
        else interimText += r[0].transcript
      }
      if (interimText) setInterim(interimText)
      if (finalText) {
        setInterim('')
        finalRef.current(finalText.trim())
      }
    }
    rec.onerror = (ev) => {
      const e = ev.error
      setError(e === 'not-allowed' || e === 'service-not-allowed' ? 'Microphone permission denied.' : 'Voice input failed.')
      setListening(false)
    }
    rec.onend = () => {
      setListening(false)
      setInterim('')
    }
    recRef.current = rec
    try {
      rec.start()
      setListening(true)
    } catch {
      setListening(false)
    }
  }, [])

  useEffect(() => () => recRef.current?.abort(), [])

  return { supported, listening, interim, error, start, stop }
}
