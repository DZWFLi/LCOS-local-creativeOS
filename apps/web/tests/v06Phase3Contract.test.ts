import { readFileSync } from 'node:fs'
import { existsSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8')
const drive = readFileSync(new URL('../src/features/project/ProjectDrive.tsx', import.meta.url), 'utf8')
const scopeDialog = readFileSync(new URL('../src/features/create/ScopeCreateDialog.tsx', import.meta.url), 'utf8')
const canvas = readFileSync(new URL('../src/features/canvas/ProjectCanvas.tsx', import.meta.url), 'utf8')

describe('v0.6 phase 3 UI contract', () => {
  it('opens independent Project Packages through Project Drive and tabs', () => {
    // GUI-1：V07TopBar 是死代码（从未渲染），已删除；项目切换收敛到 ProjectStrip + Drive。
    expect(existsSync(new URL('../src/features/shell/V07TopBar.tsx', import.meta.url))).toBe(false)
    expect(app).not.toContain('V07TopBar')
    expect(app).toContain('applyProjectState')
    expect(app).toContain('resetGraph')
    expect(drive).toContain('项目磁盘')
    expect(drive).toContain('已打开')
  })

  it('creates Collection as exact aggregate membership without cloning or navigating to a child canvas', () => {
    const createCollectionBlock = app.slice(app.indexOf('const createScopeFromSelection'), app.indexOf('const togglePositionLock'))
    expect(app).toContain('createAggregateScopeEntity')
    expect(app).toContain("kind: 'collection'")
    expect(app).toContain('setCollectionMembersById')
    expect(app).toContain('setExpandedCollectionScopeIds')
    expect(app).toContain('点击 Collection 可原地展开')
    expect(app).not.toContain('createChildScopeFromSelection')
    expect(createCollectionBlock).not.toContain('projectViewsIntoScope')
    expect(canvas).toContain('onCreateScopeFromSelection')
    expect(scopeDialog).toContain('不再创建 Collection 子画布')
  })

  it('keeps one graph with breadcrumb navigation and locked layout anchors', () => {
    expect(app).toContain('buildScopePath')
    expect(app).toContain('positionLocked')
    expect(app).toContain('layoutMode: \'semantic\'')
    expect(canvas).toContain('data-position-locked={node.positionLocked || undefined}')
  })
})
