import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// RC-8 收口：旧 ContextGraphSurface 整页已删除，关系场逻辑迁至
// ContextRelationshipHomeSurface + contextMerge 纯函数（断言随迁，语义不变）。
const relationshipHome = readFileSync(new URL('../src/features/surfaces/ContextRelationshipHomeSurface.tsx', import.meta.url), 'utf8')
const projection = readFileSync(new URL('../src/features/surfaces/ProjectionSurfaces.tsx', import.meta.url), 'utf8')
const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8')

describe('Phase 3 Slice 2 — Relationship Home contract', () => {
  it('renders saved Context views as draggable primary nodes on the relation surface', () => {
    expect(relationshipHome).toContain('lcos-context-relationship-home')
    expect(relationshipHome).toContain('lcos-context-dot-core')
    expect(relationshipHome).toContain("setData('application/x-lcos-context-view'")
    expect(relationshipHome).toContain('proposeContextMergeCandidate')
  })

  it('shows a merge proposal with accept/cancel before any durable write', () => {
    expect(relationshipHome).toContain('context-merge-proposal')
    expect(relationshipHome).toContain('取消')
    expect(relationshipHome).toContain('接受')
    expect(relationshipHome).toContain('mergeProposal.additions.length')
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
