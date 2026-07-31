import { defineConfig } from 'vitest/config'

// Security-rules tests only. These talk to a real Firestore emulator over the
// network, so they are slower than the unit suite and are kept out of the
// default `npm test` run (see the `exclude` in vite.config.ts).
//
// Run them with `npm run test:rules`, which starts and stops the emulator.
export default defineConfig({
  test: {
    include: ['**/*.rules.test.ts'],
    // One emulator, shared state: parallel files would race on the same
    // documents. Each test seeds what it needs and clears afterwards.
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 30_000,
  },
})
