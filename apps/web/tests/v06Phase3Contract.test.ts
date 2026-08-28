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
  })

  it('Project Launcher renders Portal Grid fed by Core summary + visual profile (F6 truth)', () => {
    // 旧「项目磁盘 / 已打开」文案已随 ProjectDrive 重构退役；新 truth = Project Portal Grid。
    expect(drive).toContain('project-portal-grid')
    // Portal 数据来自 Core 读模型：ProjectSummaryV1 / ProjectVisualProfileV0，不是前端自算。
    expect(drive).toContain('client.projectSummary(')
    expect(drive).toContain('client.projectVisualProfile(')
    expect(drive).toContain('summary.objectCount')
    expect(drive).toContain('summary?.lastMeaningfulEditedAt')
    // Visual profile 由 CAS 控件管理（B4 只读 + CAS 写）。
    expect(drive).toContain('ProjectVisualProfileControl')
    // 新建入口与 Portal 同构（同一 grid 内的 create portal），不是独立第二套 UI。
    expect(drive).toContain('project-create-portal')
    expect(drive).toContain('新建项目')
  })

  it('Project Glyph is a project mark, not a Conversation Glyth', () => {
    // Project Portal 的视觉标识是 ProjectGlyphMark（visual profile 驱动），与 Conversation Glyth 是两个体系。
    expect(existsSync(new URL('../src/features/project/ProjectGlyphMark.tsx', import.meta.url))).toBe(true)
    expect(drive).toContain('ProjectGlyphMark')
    expect(drive).toContain('profile?.glythMarkId')
    expect(drive).not.toContain('LcosGlyth')
    expect(drive).not.toContain('GlythAvatar')
  })

  it('Capture Inbox is an assembly source entry, never disguised as a Project portal', () => {
    // Capture Inbox 独立于 portal grid（不进 portal 结构、不带 project-portal class），只是装配来源入口。
    expect(drive).toContain('project-capture-inbox')
    expect(drive).toContain('onOpenCaptureSpace')
    expect(drive).toContain('capturePendingCount')
    const inboxBlock = drive.slice(drive.indexOf('project-capture-inbox'), drive.indexOf('project-capture-inbox') + 400)
    expect(inboxBlock).not.toContain('project-portal"')
    expect(inboxBlock).not.toContain('aria-label="打开项目')
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
