import { useEffect, useRef, useState } from 'react'
import { useSettingsStore } from '../../store/settings'
import { GarminPullError, latestGarminRun, triggerGarminPull, type PullRun } from '../../services/garmin/githubPull'

export type PullPhase = 'idle' | 'dispatching' | 'running' | 'done' | 'error'

export type GarminPull = {
  configured: boolean
  phase: PullPhase
  message: string
  run: PullRun | null
  lastPull?: number
  /** Pull the last `days` of activity. Defaults to a fortnight — enough to catch up. */
  pull: (days?: number) => Promise<void>
}

/** A year is plenty to reach every activity worth charting, without a huge job. */
export const BACKFILL_DAYS = 365

/**
 * Shared "pull from Garmin" driver used by both the Settings card and the Action
 * Hub tile: dispatches the GitHub workflow, then polls the run status until it
 * finishes. The pulled data itself arrives via Firestore sync, so this is only the
 * trigger + progress. The poll interval is cleaned up on unmount.
 */
export function useGarminPull(): GarminPull {
  const token = useSettingsStore((s) => s.githubToken)
  const repo = useSettingsStore((s) => s.githubRepo)
  const lastPull = useSettingsStore((s) => s.lastGarminPullAt)
  const setLastPull = useSettingsStore((s) => s.setLastGarminPullAt)

  const configured = token.trim().length > 0 && repo.trim().length > 0

  const [phase, setPhase] = useState<PullPhase>('idle')
  const [message, setMessage] = useState('')
  const [run, setRun] = useState<PullRun | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined)

  useEffect(() => () => clearInterval(pollRef.current), [])

  async function pull(days = 14) {
    if (!configured) {
      setPhase('error')
      setMessage('Add your GitHub repo and token in Settings → Pull from Garmin first.')
      return
    }
    setPhase('dispatching')
    setMessage('')
    setRun(null)
    try {
      await triggerGarminPull(token, repo, days)
      setLastPull(Date.now())
      setPhase('running')
      let tries = 0
      clearInterval(pollRef.current)
      pollRef.current = setInterval(async () => {
        tries++
        try {
          const r = await latestGarminRun(token, repo)
          if (r) setRun(r)
          if (r && r.status === 'completed') {
            clearInterval(pollRef.current)
            if (r.conclusion === 'success') {
              setPhase('done')
              setMessage('Garmin data pulled — it’s syncing into your app now.')
            } else {
              setPhase('error')
              setMessage(`The pull finished with "${r.conclusion ?? 'failure'}". Check the run log.`)
            }
          }
        } catch {
          /* transient poll error — keep trying */
        }
        if (tries >= 40) clearInterval(pollRef.current)
      }, 6000)
    } catch (err) {
      setPhase('error')
      setMessage(err instanceof GarminPullError ? err.message : 'Could not start the pull.')
    }
  }

  return { configured, phase, message, run, lastPull, pull }
}
