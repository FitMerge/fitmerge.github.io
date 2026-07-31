// Runs the Firestore security-rules suite against a local emulator.
//
// This wrapper exists for one reason: the Firestore emulator is a Java process,
// and Java on Windows cannot open an NIO selector when TMP points at an 8.3
// short path (the `C:\Users\JOSH~1.WRI\...` form). It builds its internal pipe
// over an AF_UNIX socket in the temp directory, and connect() on a short path
// fails with "Invalid argument", which surfaces as:
//
//   java.lang.IllegalStateException: failed to create a child event loop
//   Caused by: java.io.IOException: Unable to establish loopback connection
//
// Setting java.io.tmpdir does NOT fix it — the pipe uses the raw TMP/TEMP
// environment variables, so they have to be redirected before the process
// starts. Hence this file rather than a plain npm script.
//
// Requires a JDK on PATH (the emulator won't start without one).

import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { delimiter, join } from 'node:path'

/** A temp directory guaranteed free of 8.3 short names. */
function safeTempDir() {
  const candidate = process.platform === 'win32' ? 'C:\\Temp\\fitmerge-emulator' : join(tmpdir(), 'fitmerge-emulator')
  mkdirSync(candidate, { recursive: true })
  return candidate
}

/** Does `dir` contain a java executable? */
function hasJava(dir) {
  const exe = process.platform === 'win32' ? 'java.exe' : 'java'
  return existsSync(join(dir, exe))
}

/**
 * Locate a JDK's bin directory.
 *
 * Installing a JDK updates the machine environment, but shells that were
 * already open keep the old one — so right after installing, neither PATH nor
 * JAVA_HOME necessarily has it, and the emulator fails with a confusing
 * "Could not spawn `java -version`". Checking the usual install locations means
 * the tests work without needing to reopen a terminal.
 */
function findJavaBin() {
  const fromPath = (process.env.PATH ?? '').split(delimiter).find((p) => p && hasJava(p))
  if (fromPath) return null // already reachable, nothing to prepend

  const home = process.env.JAVA_HOME
  if (home && hasJava(join(home, 'bin'))) return join(home, 'bin')

  if (process.platform !== 'win32') return null
  for (const base of ['C:\\Program Files\\Eclipse Adoptium', 'C:\\Program Files\\Java', 'C:\\Program Files\\Microsoft']) {
    if (!existsSync(base)) continue
    for (const entry of readdirSync(base)) {
      const bin = join(base, entry, 'bin')
      if (hasJava(bin)) return bin
    }
  }
  return null
}

function pathWithJava() {
  const path = process.env.PATH ?? ''
  const bin = findJavaBin()
  return bin ? `${bin}${delimiter}${path}` : path
}

const temp = safeTempDir()
const env = { ...process.env, TMP: temp, TEMP: temp, PATH: pathWithJava() }

// Built as one string because it runs through a shell: emulators:exec takes the
// command to run as a SINGLE argument, so the quotes have to survive. Passing an
// args array here would split "vitest run --config …" into four arguments and
// the CLI rejects it with "Too many arguments".
//
// A project id starting with `demo-` keeps the emulator entirely offline — no
// credentials, and no chance of touching the real project.
const command =
  'firebase emulators:exec --only firestore --project demo-fitmerge ' +
  '"vitest run --config vitest.rules.config.ts"'

const child = spawn(command, {
  env,
  stdio: 'inherit',
  shell: true,
})

child.on('exit', (code) => process.exit(code ?? 1))
child.on('error', (err) => {
  console.error('Could not start the Firebase emulator:', err.message)
  console.error('A JDK must be installed and on PATH.')
  process.exit(1)
})
