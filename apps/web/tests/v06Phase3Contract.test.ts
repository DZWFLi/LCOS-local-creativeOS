import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8')
const drive = readFileSync(new URL('../src/features/project/ProjectDrive.tsx', import.meta.url), 'utf8')
const scopeDialog = readFileSync(new URL('../src/features/create/ScopeCreateDialog.tsx', import.meta.url), 'utf8')
const canvas = readFileSync(new URL('../src/features/canvas/ProjectCanvas.tsx', import.meta.url), 'utf8')
const topbar = readFileSync(new URL('../src/features/shell/V07TopBar.tsx', import.meta.url), 'utf8')

describe('v0.6 phase 3 UI contract', () => {
  it('opens independent Project Packages through Project Drive and tabs', () => {
    expect(topbar).toContain('props.openProjectIds.map')
    expect(app).toContain('applyProjectState')
    expect(app).toContain('resetGraph')
    expect(drive).toContain('项目磁盘')
    expect(drive).toContain('已打开')
  })

  it('creates a child Canvas from a selection while preserving source views', () => {
    expect(app).toContain('createChildScopeFromSelection')
    expect(app).toContain('setScopeId(result.scope.id)')
    expect(canvas).toContain('onCreateScopeFromSelection')
    expect(scopeDialog).toContain('原对象仍保留在当前画布')
  })

  it('keeps one graph with breadcrumb navigation and locked layout anchors', () => {
    expect(app).toContain('buildScopePath')
    expect(app).toContain('positionLocked')
    expect(app).toContain('layoutMode: \'semantic\'')
    expect(canvas).toContain('data-position-locked={node.positionLocked || undefined}')
  })
})
