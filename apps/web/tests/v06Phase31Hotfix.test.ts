import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { fixtureEdges, fixtureNodes } from '../src/qa-fixtures/fixtures'
import { createChildScopeFromSelection } from '../src/state/canvasScopes'

const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8')
const surface = readFileSync(new URL('../src/surface.css', import.meta.url), 'utf8')
const canvas = readFileSync(new URL('../src/features/canvas/ProjectCanvas.tsx', import.meta.url), 'utf8')
const topbar = readFileSync(new URL('../src/features/shell/V07TopBar.tsx', import.meta.url), 'utf8')

let counter = 0
const createId = (prefix: string) => `${prefix}-${++counter}`

describe('v0.6 phase 3.1 navigation and shortcut hotfix', () => {
  it('keeps breadcrumbs clickable and exposes a real parent navigation control', () => {
    expect(surface).toContain('.v06-breadcrumbs {')
    expect(surface).toContain('pointer-events: auto')
    expect(app).toContain('data-testid="scope-back"')
    expect(app).toContain('enterScope(activeScope.parentScopeId)')
  })

  it('routes Ctrl/Cmd+Enter through the run confirmation even when focus is outside the composer', () => {
    expect(app).toContain("if (modifier && event.key === 'Enter')")
    expect(app).toContain('requestRun()')
    expect(app).toContain('setRunConfirmOpen(true)')
  })

  it('exposes a discoverable close control for every project tab', () => {
    expect(topbar).toContain('aria-label={`关闭 ${project.label}`}')
    expect(topbar).toContain('props.onCloseProject(id)')
    expect(app).toContain('onCloseProject={closeProjectTab}')
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
    expect(canvas).toContain('data-edge-count={edges.length}')
    expect(canvas).toContain('data-edge-id={edge.id}')
  })
})
