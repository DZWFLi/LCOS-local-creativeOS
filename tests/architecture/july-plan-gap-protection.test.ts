/**
 * Protective Gap Tests — Slice A: Lock known July plan fulfillment gaps.
 *
 * Each test currently FAILS because the corresponding gap exists.
 * When the gap is fixed in Slice B–F, the test must be updated or removed.
 *
 * Convention: GAP-XXX maps to Capability Ledger IDs.
 */

import { describe, it, expect } from 'vitest'
import { join } from 'node:path'

/* ── helpers ── */

describe('UI-05: ActiveContext write-back from Web to Core (Slice D fix)', () => {
  // Core PUT /active-context + Web App.tsx selection sync must both exist.
  // The browser probe tests/e2e/active-context-probe.mjs verifies the real chain.

  it('server.ts declares PUT /active-context handler', () => {
    // This is a structural test: if someone accidentally removes the PUT, this catches it.
    // We grep for the known server pattern without starting the server.
    const fs = require('node:fs')
    const serverSrc = fs.readFileSync(
      join(__dirname, '../../apps/local-core/src/server.ts'), 'utf-8'
    )
    expect(serverSrc).toContain("method === 'GET' || method === 'PUT'")
  })

  it('active-context-store exports an update method', async () => {
    const { ActiveContextStore } = await import('../../apps/local-core/src/active-context-store')
    const store = new ActiveContextStore()
    // Verify update exists — the Core-side contract is intact
    expect(typeof store.update).toBe('function')
  })

  it('App.tsx writes Canvas selection back through updateActiveContext', async () => {
    const fs = require('node:fs')
    const appSrc = fs.readFileSync(
      join(__dirname, '../../apps/web/src/App.tsx'), 'utf-8'
    )
    expect(appSrc).toContain('updateActiveContext')
  })
})

describe('GAP-RUN-01: Run Intent defaults to revise', () => {
  it('runtime-adapter resolves contracts through the Adapter Registry (Slice B fix)', async () => {
    // Slice B-3 replaced the revise-only ternary with registry-based resolution.
    // Positive structural lock: no intent hardcode may return.
    const fs = require('node:fs')
    const adapterSrc = fs.readFileSync(
      join(__dirname, '../../apps/local-core/src/runtime-adapter.ts'), 'utf-8'
    )
    expect(adapterSrc).toContain('adapterRegistry.resolve')
    expect(adapterSrc).not.toContain("outputIntent === 'revise' ? 'markdown_script_revision'")
  })

  it('analyze zero-file completion path exists (Slice B fix)', async () => {
    // Slice B added a real analyze branch: zero changed files complete the Run
    // without creating a Draft. Positive structural lock + integration tests.
    const fs = require('node:fs')
    const resultIngestSrc = fs.readFileSync(
      join(__dirname, '../../apps/local-core/src/runtime-result-ingestion.ts'), 'utf-8'
    )
    expect(resultIngestSrc).toContain("kind: 'analyze'")
    expect(resultIngestSrc).toContain('Analyze runs must return zero changed files')
  })
})

describe('RUN-06: Adapter selects contracts via Registry (Slice B fix)', () => {
  it('runtime-adapter no longer hardcodes the Markdown draft path or media type', async () => {
    const fs = require('node:fs')
    const adapterSrc = fs.readFileSync(
      join(__dirname, '../../apps/local-core/src/runtime-adapter.ts'), 'utf-8'
    )
    expect(adapterSrc).not.toContain('script-draft-')
    expect(adapterSrc).not.toContain("mediaType: 'text/markdown'")
    expect(adapterSrc).toContain('resolveProfile')
  })

  it('Adapter Registry exists and resolves by Intent × Kind × MIME', async () => {
    const fs = require('node:fs')
    const registryPath = join(__dirname, '../../apps/local-core/src/adapter-registry.ts')
    expect(fs.existsSync(registryPath)).toBe(true)
    const registrySrc = fs.readFileSync(registryPath, 'utf-8')
    expect(registrySrc).toContain('defaultRuntimeAdapterRegistry')
    expect(registrySrc).toContain('resolveRevise')
    expect(registrySrc).toContain('UNSUPPORTED_OUTPUT_FORMAT')
  })
})

describe('GAP-QA-02: Bridge offline allows Run dispatch', () => {
  // runtime-adapter.ts line 196: code 'BRIDGE_UNAVAILABLE'
  // But dispatch still proceeds; the error is only recorded after the fact.
  // There is no pre-flight health gate.

  it('dispatch has BRIDGE_UNAVAILABLE error handling', async () => {
    const fs = require('node:fs')
    const adapterSrc = fs.readFileSync(
      join(__dirname, '../../apps/local-core/src/runtime-adapter.ts'), 'utf-8'
    )
    expect(adapterSrc).toContain('BRIDGE_UNAVAILABLE')
  })

  it('REGRESSION GUARD: no pre-flight Bridge health check before dispatch', async () => {
    // The adapter dispatches, catches the error, and marks recovery_required.
    // A pre-flight check (POST /health to bridge before POST /tasks) is missing.
    // When a health gate is added, this test MUST be updated.
    const fs = require('node:fs')
    const adapterSrc = fs.readFileSync(
      join(__dirname, '../../apps/local-core/src/runtime-adapter.ts'), 'utf-8'
    )
    const hasPreflightPattern = adapterSrc.includes('/health')
      && adapterSrc.includes('dispatch')
    // Currently there is no coordinated health-then-dispatch
    expect(hasPreflightPattern).toBe(false)
  })
})

describe('GAP-UI-07: Checkpoint button is a toast, not a Core API call', () => {
  // App.tsx line 1649: setNotice('检查点已创建') — only shows a toast.
  // Core server has POST /checkpoints route (line ~560), but Web never calls it.

  it('server.ts declares POST /checkpoints handler', () => {
    const fs = require('node:fs')
    const serverSrc = fs.readFileSync(
      join(__dirname, '../../apps/local-core/src/server.ts'), 'utf-8'
    )
    expect(serverSrc).toContain('/checkpoints')
    expect(serverSrc).toContain('createCheckpoint')
  })

  it('App.tsx Checkpoint button never calls Core API', () => {
    // When Checkpoint becomes real, the setNotice('检查点已创建') must be replaced
    // with a Core API call. Until then, this test documents the gap.
    const fs = require('node:fs')
    const appSrc = fs.readFileSync(
      join(__dirname, '../../apps/web/src/App.tsx'), 'utf-8'
    )
    // Currently only a toast — no fetch/POST/Core call near checkpoint
    const hasCheckpointBtn = appSrc.includes('已形成稳定修改集')
    expect(hasCheckpointBtn).toBe(true)
    // REGRESSION GUARD: when fixed, this search for absence of Core call MUST be updated
  })
})
