import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const graphSurface = readFileSync(new URL('../src/features/surfaces/ContextGraphSurface.tsx', import.meta.url), 'utf8')
const projection = readFileSync(new URL('../src/features/surfaces/ProjectionSurfaces.tsx', import.meta.url), 'utf8')
const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8')

describe('Phase 3 Slice 2 — Relationship Home contract', () => {
  it('renders saved Context views as draggable primary nodes on the relation surface', () => {
    expect(graphSurface).toContain('lcos-relationship-home')
    expect(graphSurface).toContain('lcos-context-view-node')
    expect(graphSurface).toContain("setData('application/x-lcos-context-view'")
    expect(graphSurface).toContain('proposeContextMergeCandidate(source, target)')
  })

  it('shows a merge proposal with accept/reject before any durable write', () => {
    expect(graphSurface).toContain('context-merge-proposal')
    expect(graphSurface).toContain('拒绝')
    expect(graphSurface).toContain('接受')
    expect(graphSurface).toContain('mergeProposal.additions.length')
  })

  it('wires accept into exact Context Presentation membership without cloning into a child Scope', () => {
    expect(projection).toContain('contextViews={props.contextViews}')
    expect(projection).toContain('onContextMergeAccept={props.onContextMergeAccept}')
    expect(app).toContain('savedContextViews')
    expect(app).toContain("appendExactPresentationMembers('context', targetContextId")
    expect(app).not.toContain('projectViewsIntoScope(additions, targetContextId)')
    expect(app).toContain('目标 Context 已不存在，未做任何修改')
  })
})
