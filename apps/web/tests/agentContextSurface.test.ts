import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const webRoot = join(import.meta.dirname, '..', 'src')

describe('C3 Agent visual context surface', () => {
  it('opens agent mode for ?agent=codex and renders the surface', () => {
    const app = readFileSync(join(webRoot, 'App.tsx'), 'utf8')
    expect(app).toContain("get('agent') === 'codex'")
    expect(app).toContain('agent-context-surface')
  })

  it('surface carries sync state, proposals, pending runs and run lock', () => {
    const app = readFileSync(join(webRoot, 'App.tsx'), 'utf8')
    expect(app).toContain('ACTIVE_CONTEXT_CONFLICT')
    expect(app).toContain('onAcceptProposal')
    expect(app).toContain('onRejectProposal')
    expect(app).toContain('pendingRuns')
    expect(app).toContain('runLocked')
    expect(app).toContain('listContextProposals')
  })

  it('client exposes activeContext GET and proposal APIs', () => {
    const client = readFileSync(join(webRoot, 'runtime', 'localCoreClient.ts'), 'utf8')
    expect(client).toContain('activeContext(projectId, workspaceId')
    expect(client).toContain('proposeContextChange')
    expect(client).toContain('acceptContextProposal')
    expect(client).toContain('rejectContextProposal')
    expect(client).toContain('afterVersion')
    expect(client).toContain('workspaceId')
  })
})
