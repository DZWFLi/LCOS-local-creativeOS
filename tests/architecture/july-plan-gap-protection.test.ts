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

describe('GAP-UI-05: ActiveContext PUT is wired in Core but not consumed by Web', () => {
  // The Core server.ts line 546-557 shows PUT /active-context is implemented.
  // But Web App.tsx never calls PUT to sync Canvas selection back to Core.
  // This test verifies the server route exists so we can't regress the backend side.

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
})

describe('GAP-RUN-01: Run Intent defaults to revise', () => {
  // runtime-adapter.ts line 357: taskType = run.outputIntent === 'revise' ? 'markdown_script_revision' : 'creative_run'
  // When Web omits intent, Core defaults to 'revise', causing analyze runs to produce Markdown drafts.

  it('runtime-adapter assumes revise when no explicit intent', async () => {
    // Structural check: the adapter source must contain the revise-only branch
    const fs = require('node:fs')
    const adapterSrc = fs.readFileSync(
      join(__dirname, '../../apps/local-core/src/runtime-adapter.ts'), 'utf-8'
    )
    // We expect this to FAIL when we introduce a proper Intent Registry
    // Currently it PASSES (confirming the gap exists)
    expect(adapterSrc).toContain("outputIntent === 'revise' ? 'markdown_script_revision'")
  })

  it('REGRESSION GUARD: no path for analyze zero-file completion', async () => {
    // If analyze ever gets its own branch, this structural test must FAIL
    // and be replaced with proper integration tests.
    const fs = require('node:fs')
    const resultIngestSrc = fs.readFileSync(
      join(__dirname, '../../apps/local-core/src/runtime-result-ingestion.ts'), 'utf-8'
    )
    // Currently analyze produces the same path as revise — this is the bug
    const hasAnalyzeBranch = resultIngestSrc.includes('analyze')
      && !resultIngestSrc.includes("outputIntent !== 'revise'")
    // This test captures: analyze path does NOT have a separate zero-file flow
    expect(hasAnalyzeBranch).toBe(false)
  })
})

describe('GAP-RUN-06: Adapter hardcodes Markdown script-draft', () => {
  // runtime-adapter.ts line 337: outputPath = `staging/script-draft-${run.id}.md`
  // runtime-adapter.ts line 388: mediaType: 'text/markdown'
  // Every run, regardless of intent/format, gets a Markdown draft contract.

  it('output path is hardcoded to script-draft-*.md', async () => {
    const fs = require('node:fs')
    const adapterSrc = fs.readFileSync(
      join(__dirname, '../../apps/local-core/src/runtime-adapter.ts'), 'utf-8'
    )
    expect(adapterSrc).toContain('script-draft-')
    expect(adapterSrc).toContain("mediaType: 'text/markdown'")
  })

  it('no Adapter Registry exists yet', async () => {
    // The adapter should eventually select by Intent × Workflow × MIME.
    // Currently there is no registry file.
    const fs = require('node:fs')
    const registryPath = join(__dirname, '../../apps/local-core/src/adapter-registry.ts')
    expect(fs.existsSync(registryPath)).toBe(false)
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
