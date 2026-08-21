import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = (relative: string) => readFileSync(new URL(`../src/${relative}`, import.meta.url), 'utf8')
const app = source('App.tsx')
const spatial = source('features/spatial/SpatialCanvas.tsx')
const drop = source('features/spatial/semanticDrop.ts')

describe('R3.1 B3R5 cross-surface reference Drop contract', () => {
  const handler = app.slice(app.indexOf('const directDropToProjectRailView'), app.indexOf('const addMembersToSavedContext'))

  it('registers Arrange, Context and Workflow surface destinations', () => {
    for (const id of ['surface:arrange', 'surface:context-graph', 'surface:context', 'surface:workflow-graph', 'surface:workflow']) {
      expect(drop).toContain(`'${id}'`)
      expect(spatial).toContain(`id: '${id}'`)
    }
  })

  it('uses stable EntityRefs / Presentation membership without ownership moves or recursive expansion', () => {
    expect(handler).toContain('semanticRefsForSourceIds(sourceIds, nodes)')
    expect(handler).toContain("appendExactPresentationEntityRefs('context'")
    expect(handler).toContain("appendExactPresentationEntityRefs('workflow'")
    expect(handler).toContain("appendExactPresentationEntityRefs('custom', `workspace:${workspace.id}`")
    expect(handler).not.toContain('createAggregateScopeEntity')
    expect(handler).not.toContain('projectViewsIntoScope')
    expect(handler).not.toContain('clone')
  })

  it('keeps Scene, Context and Workflow drops as references and does not create nested containers', () => {
    expect(handler).toContain('没有创建子 Scene')
    expect(handler).toContain('已作为引用加入 Context')
    expect(handler).toContain('已作为引用加入 Workflow')
    expect(app).toContain('MAX_STRUCTURAL_CONTAINER_DEPTH')
    expect(app).toContain('已达到集合嵌套上限')
  })
})
