// Triggers the cloud Garmin-pull GitHub Actions workflow from the app and reports
// its progress. The browser can't talk to Garmin directly (no public API, 2FA, CORS),
// so the pull runs in GitHub Actions; here we just dispatch it and poll the run status.
// The pulled data lands in the user's FitMerge cloud and reaches the app through the
// existing Firestore realtime sync — this module only drives the trigger + status UI.

const API = 'https://api.github.com'
const WORKFLOW_FILE = 'garmin-pull.yml'
// The link worker finishes first-time connections. It runs on a schedule too,
// but GitHub's short crons are best-effort and routinely skip, which leaves a
// fresh connection spinning — so whoever holds a token nudges it directly.
const LINK_WORKFLOW_FILE = 'garmin-link.yml'

export class GarminPullError extends Error {}

export type PullStatus = 'queued' | 'in_progress' | 'completed' | 'unknown'
export type PullRun = { id: number; status: PullStatus; conclusion: string | null; url: string; createdAt: string }

function parseRepo(repo: string): { owner: string; name: string } {
  const m = repo.trim().replace(/^https?:\/\/github\.com\//, '').match(/^([\w.-]+)\/([\w.-]+?)(?:\.git)?$/)
  if (!m) throw new GarminPullError('Repository must look like "owner/repo".')
  return { owner: m[1], name: m[2] }
}

function headers(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token.trim()}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  }
}

async function ghError(res: Response): Promise<string> {
  let detail = ''
  try {
    const body = (await res.json()) as { message?: string }
    detail = body?.message ?? ''
  } catch {
    /* ignore */
  }
  if (res.status === 401) return 'GitHub token is invalid or expired.'
  if (res.status === 403) return detail || 'GitHub denied the request — check the token has Actions read/write on this repo.'
  if (res.status === 404)
    return 'Workflow or repo not found. Make sure garmin-pull.yml is on the repo’s default branch and the token can see it.'
  if (res.status === 422) return detail || 'GitHub rejected the request (is the workflow on the default branch?).'
  return detail || `GitHub request failed (${res.status}).`
}

/** The repo's default branch — workflow_dispatch must target a real branch that
 * has the workflow, and it's not always "main". */
async function defaultBranch(token: string, owner: string, name: string): Promise<string> {
  let res: Response
  try {
    res = await fetch(`${API}/repos/${owner}/${name}`, { headers: headers(token) })
  } catch {
    throw new GarminPullError('Network error reaching GitHub.')
  }
  if (!res.ok) throw new GarminPullError(await ghError(res))
  const body = (await res.json()) as { default_branch?: string }
  return body.default_branch || 'main'
}

/** Fire a workflow_dispatch event. Resolves when GitHub accepts it (HTTP 204). */
async function dispatchWorkflow(
  token: string,
  repo: string,
  workflow: string,
  inputs?: Record<string, string>,
): Promise<void> {
  if (!token.trim()) throw new GarminPullError('Add a GitHub token first.')
  const { owner, name } = parseRepo(repo)
  const ref = await defaultBranch(token, owner, name)
  let res: Response
  try {
    res = await fetch(`${API}/repos/${owner}/${name}/actions/workflows/${workflow}/dispatches`, {
      method: 'POST',
      headers: { ...headers(token), 'Content-Type': 'application/json' },
      body: JSON.stringify(inputs ? { ref, inputs } : { ref }),
    })
  } catch {
    throw new GarminPullError('Network error reaching GitHub.')
  }
  if (!res.ok) throw new GarminPullError(await ghError(res))
}

export async function triggerGarminPull(token: string, repo: string, days = 14): Promise<void> {
  return dispatchWorkflow(token, repo, WORKFLOW_FILE, { days: String(days) })
}

/**
 * Start the link worker now instead of waiting for its cron. Takes no inputs —
 * the worker picks up whoever is pending in Firestore, so this helps anyone
 * mid-connect, not just the person who pressed it.
 */
export async function triggerGarminLink(token: string, repo: string): Promise<void> {
  return dispatchWorkflow(token, repo, LINK_WORKFLOW_FILE)
}

/** Latest run of the pull workflow, so the UI can show queued → running → done. */
export async function latestGarminRun(token: string, repo: string): Promise<PullRun | null> {
  const { owner, name } = parseRepo(repo)
  let res: Response
  try {
    res = await fetch(`${API}/repos/${owner}/${name}/actions/workflows/${WORKFLOW_FILE}/runs?per_page=1`, {
      headers: headers(token),
    })
  } catch {
    throw new GarminPullError('Network error reaching GitHub.')
  }
  if (!res.ok) throw new GarminPullError(await ghError(res))
  const body = (await res.json()) as { workflow_runs?: Array<Record<string, unknown>> }
  const run = body.workflow_runs?.[0]
  if (!run) return null
  return {
    id: run.id as number,
    status: (run.status as PullStatus) ?? 'unknown',
    conclusion: (run.conclusion as string | null) ?? null,
    url: (run.html_url as string) ?? '',
    createdAt: (run.created_at as string) ?? '',
  }
}
