import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const runtime = readFileSync(new URL('../src/runtime/runtimeBridge.ts', import.meta.url), 'utf8')
const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8')
const flow = readFileSync(new URL('../src/features/surfaces/ContextFlowSurface.tsx', import.meta.url), 'utf8')
const workflow = readFileSync(new URL('../src/features/surfaces/WorkflowSurface.tsx', import.meta.url), 'utf8')
const canvas = readFileSync(new URL('../src/features/canvas/ProjectCanvas.tsx', import.meta.url), 'utf8')

describe('relation three-layer projection contract', () => {
  it('marks canonical Core relations as domain edges', () => {
    expect(runtime).toContain("scope: 'domain' as const")
  })

  it('marks presentation-only links as presentation edges', () => {
    // R2：Signal Track 不再有临时边（trackSegments 取代）；presentation-only links
    // 语义载体保留在 Workflow 的 presentation edges。
    expect(workflow).toContain("scope: 'presentation' as const")
    expect(workflow).toContain('usePresentationDraftEdges')
  })

  it('marks execution/attention links as runtime edges', () => {
    expect(app).toContain("scope: 'runtime'")
  })

  it('renders edge scope as a mechanical CSS class', () => {
    expect(canvas).toContain('edge-scope-${edge.scope}')
  })
})
