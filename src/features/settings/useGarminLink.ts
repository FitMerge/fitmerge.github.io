import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../../auth/AuthProvider'
import {
  disconnectGarmin,
  requestPull,
  submitCredentials,
  submitMfaCode,
  subscribeStatus,
  type GarminStatus,
} from '../../services/garmin/garminLink'
import { garminLinkAvailable } from '../../services/garmin/linkCrypto'

const IDLE: GarminStatus = { state: 'idle', message: '', lastSyncAt: null }

/**
 * Drives the in-app Garmin connection. Progress comes from a live subscription
 * to the sync job's status document rather than polling, so the two-factor
 * prompt appears the moment the job asks for it.
 */
export function useGarminLink() {
  const { user, status: authStatus } = useAuth()
  const uid = user?.uid ?? null

  const [status, setStatus] = useState<GarminStatus>(IDLE)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!uid || !garminLinkAvailable()) {
      setStatus(IDLE)
      return
    }
    let cancelled = false
    let unsub: (() => void) | null = null
    void subscribeStatus(uid, (next) => {
      if (!cancelled) setStatus(next)
    }).then((fn) => {
      if (cancelled) fn()
      else unsub = fn
    })
    return () => {
      cancelled = true
      unsub?.()
    }
  }, [uid])

  const run = useCallback(
    async (fn: () => Promise<void>) => {
      setError('')
      setBusy(true)
      try {
        await fn()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong.')
      } finally {
        setBusy(false)
      }
    },
    [],
  )

  const connect = useCallback(
    (email: string, password: string) => run(async () => {
      if (!uid) throw new Error('Sign in first to connect Garmin.')
      await submitCredentials(uid, email, password)
      // Show progress immediately; the job replaces this within a few minutes.
      setStatus({ state: 'pending', message: 'Connecting to Garmin…', lastSyncAt: null })
    }),
    [uid, run],
  )

  const sendMfaCode = useCallback(
    (code: string) => run(async () => {
      if (!uid) throw new Error('Sign in first.')
      await submitMfaCode(uid, code)
      setStatus((s) => ({ ...s, state: 'pending', message: 'Checking your code…' }))
    }),
    [uid, run],
  )

  const syncNow = useCallback(
    () => run(async () => {
      if (!uid) throw new Error('Sign in first.')
      await requestPull(uid)
    }),
    [uid, run],
  )

  const disconnect = useCallback(
    () => run(async () => {
      if (!uid) throw new Error('Sign in first.')
      await disconnectGarmin(uid)
      setStatus(IDLE)
    }),
    [uid, run],
  )

  return {
    /** The feature is compiled in and the user is signed in, so it can be used. */
    available: garminLinkAvailable() && authStatus === 'signed-in' && Boolean(uid),
    signedIn: authStatus === 'signed-in',
    status,
    busy,
    error,
    connect,
    sendMfaCode,
    syncNow,
    disconnect,
  }
}
