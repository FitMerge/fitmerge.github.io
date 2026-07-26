import { useCallback, useEffect, useRef, useState } from 'react'
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
import { triggerGarminLink } from '../../services/garmin/githubPull'
import { useSettingsStore } from '../../store/settings'

const IDLE: GarminStatus = { state: 'idle', message: '', lastSyncAt: null }

/**
 * App-wide: a live Garmin link IS the answer to "how do you track?", so record it
 * rather than asking again. Covers everyone who connected before that question
 * existed — their redundant manual sleep/steps tile disappears on its own.
 * Costs one status-doc listener, and none at all once the source is known.
 */
export function useGarminSourceDetect(): void {
  const { user, status: authStatus } = useAuth()
  const uid = user?.uid ?? null
  const trackingSource = useSettingsStore((s) => s.trackingSource)

  useEffect(() => {
    if (!uid || authStatus !== 'signed-in' || !garminLinkAvailable()) return
    if (trackingSource === 'garmin') return
    let cancelled = false
    let unsub: (() => void) | null = null
    void subscribeStatus(uid, (next) => {
      if (cancelled || next.state !== 'linked') return
      if (useSettingsStore.getState().trackingSource !== 'garmin') {
        useSettingsStore.getState().setTrackingSource('garmin')
      }
    }).then((fn) => {
      if (cancelled) fn()
      else unsub = fn
    })
    return () => {
      cancelled = true
      unsub?.()
    }
  }, [uid, authStatus, trackingSource])
}

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

  // Only the repo owner has a GitHub token, so only they can start the worker.
  // Everyone else waits on its schedule — see `canStartWorker` below.
  const githubToken = useSettingsStore((s) => s.githubToken)
  const githubRepo = useSettingsStore((s) => s.githubRepo)
  const canStartWorker = githubToken.trim().length > 0 && githubRepo.trim().length > 0

  // When the connection started waiting, so the UI can show real elapsed time
  // instead of a spinner that looks identical at 5 seconds and 5 minutes.
  const [waitingSince, setWaitingSince] = useState<number | null>(null)
  const [workerStarted, setWorkerStarted] = useState(false)

  /**
   * Kick the link worker so a fresh connection isn't stuck behind a cron tick.
   * Best-effort by design: a failure here never fails the connection itself,
   * because the scheduled run is still coming.
   */
  const startWorker = useCallback(async (): Promise<boolean> => {
    if (!canStartWorker) return false
    try {
      await triggerGarminLink(githubToken, githubRepo)
      setWorkerStarted(true)
      return true
    } catch {
      return false
    }
  }, [canStartWorker, githubToken, githubRepo])

  // Keep the latest startWorker without making connect/sendMfaCode re-create on
  // every keystroke in Settings.
  const startWorkerRef = useRef(startWorker)
  useEffect(() => {
    startWorkerRef.current = startWorker
  }, [startWorker])

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

  // The wait is over once the job reaches a settled state, whichever way it went.
  useEffect(() => {
    if (status.state === 'linked' || status.state === 'error' || status.state === 'needs_relink') {
      setWaitingSince(null)
    }
  }, [status.state])


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
      setWaitingSince(Date.now())
      setWorkerStarted(false)
      // Credentials are stored before this runs, so the worker finds them
      // whether it starts from here or from its own schedule.
      await startWorkerRef.current()
    }),
    [uid, run],
  )

  const sendMfaCode = useCallback(
    (code: string) => run(async () => {
      if (!uid) throw new Error('Sign in first.')
      await submitMfaCode(uid, code)
      setStatus((s) => ({ ...s, state: 'pending', message: 'Checking your code…' }))
      setWaitingSince(Date.now())
      // A code expires in minutes, so this leg is the one that most needs a
      // worker running now rather than at the next cron tick.
      await startWorkerRef.current()
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
    /** True when this device holds a GitHub token and can start the worker itself. */
    canStartWorker,
    /** True once a worker run has been requested for this connection attempt. */
    workerStarted,
    /** When the current wait began, for showing elapsed time. */
    waitingSince,
    startWorker,
  }
}
