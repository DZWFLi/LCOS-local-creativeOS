import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { fixtureEdges, fixtureNodes } from './qa-fixtures/fixtures'
import { createChildScopeFromSelection } from '../src/state/canvasScopes'

const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8')
const scene = readFileSync(new URL('../src/features/shell/CanvasSceneHost.tsx', import.meta.url), 'utf8')
const surface = readFileSync(new URL('../src/surface.css', import.meta.url), 'utf8')
const canvas = readFileSync(new URL('../src/features/canvas/ProjectCanvas.tsx', import.meta.url), 'utf8')
const spatialCanvas = readFileSync(new URL('../src/features/spatial/SpatialCanvas.tsx', import.meta.url), 'utf8')
const strip = readFileSync(new URL('../src/features/shell/ProjectStripVNext.tsx', import.meta.url), 'utf8')
const dock = readFileSync(new URL('../src/features/shell/SurfaceDock.tsx', import.meta.url), 'utf8')

let counter = 0
const createId = (prefix: string) => `${prefix}-${++counter}`

describe('v0.6 phase 3.1 navigation and shortcut hotfix', () => {
  it('keeps scope navigation reachable through the bottom dock and parent exit', () => {
    expect(dock).toContain('vnext-scope-axis')
    expect(dock).toContain('onScope')
    expect(app).toContain('enterScope(activeScope.parentScopeId)')
  })

  it('routes Ctrl/Cmd+Enter to the active context composer without a confirmation page', () => {
    expect(app).toContain("if (modifier && event.key === 'Enter')")
    expect(app).toContain('selectedIds.length ? requestSelectionRun() : requestGlobalRun()')
    expect(app).not.toContain('setRunConfirmOpen(true)')
  })

  it('keeps project close logic while vNext strip converges project switching to the Drive', () => {
    expect(app).toContain('closeProjectTab')
    expect(strip).toContain('vnext-project-strip')
    expect(strip).toContain('onOpenProjectDrive')
  })

  it('copies all internal relationships in the normal child-scope creation selection', () => {
    const result = createChildScopeFromSelection(fixtureNodes, fixtureEdges, {
      parentScopeId: 'scope-root',
      label: 'Phase 3.1 normal path',
      kind: 'collection',
      selectedIds: ['proposal', 'feedback', 'reference'],
      containerPosition: { x: 1200, y: 220 },
      createId,
    })
    expect(result.views).toHaveLength(3)
    expect(result.edges).toHaveLength(2)
    expect(result.edges.map((edge) => edge.kind)).toEqual(expect.arrayContaining(['feedback', 'reference']))
    expect(canvas).toContain('edgeCount={edges.length}')
    expect(spatialCanvas).toContain('data-edge-count={edgeCount}')
    expect(canvas).toContain('data-edge-id={edge.id}')
  })
})
