import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8')
const app = source('../src/App.tsx')
const drive = source('../src/features/project/ProjectDrive.tsx')
const dialog = source('../src/features/create/ProjectCreateDialog.tsx')
const scene = source('../src/features/shell/CanvasSceneHost.tsx')
const onboarding = source('../src/features/onboarding/CanvasEmptyState.tsx')
const css = source('../src/product-interface.css')

describe('First-run and empty project contract', () => {
  it('returns a genuinely empty catalog to Project Drive', () => {
    expect(app).toContain("if (selection.kind === 'empty-catalog')")
    expect(app).toMatch(/if \(selection\.kind === 'empty-catalog'\)[\s\S]*setProjectOpen\(false\)/)
  })

  it('offers understandable first actions without internal project-model language', () => {
    expect(drive).toContain('从一个真实项目开始')
    expect(drive).toContain('打开已有创作文件夹')
    expect(drive).toContain('创建空白项目')
    expect(drive).toContain('不会移动或覆盖原文件')
    expect(drive).not.toContain('不负责用圆环图')
  })

  it('opens the safe directory dialog in the user-selected intent', () => {
    expect(dialog).toContain("initialIntent = 'create'")
    expect(dialog).toContain('setIntent(initialIntent)')
    expect(dialog).toContain('只读扫描并登记所选目录；不会移动或改写其中的文件')
  })

  it('shows onboarding only for a real zero-content project', () => {
    expect(app).toContain("emptyState: bootMode === 'runtime' && nodes.length === 0")
    expect(scene).toContain("props.surface === 'arrange' && props.emptyState")
    expect(scene).toContain("props.surface === 'arrange' && !props.emptyState")
    expect(onboarding).toContain('把第一份资料放进项目')
    expect(onboarding).toContain('也可以直接把文件拖到画布任意位置')
  })

  it('explains the three interface roles once the first artifact arrives', () => {
    expect(app).toContain('firstArtifactGuideArmedRef.current = true')
    expect(app).toContain('setFirstArtifactGuideOpen(true)')
    expect(onboarding).toContain('Workspace')
    expect(onboarding).toContain('当前现场')
    expect(onboarding).toContain('Agent')
  })

  it('keeps the overlay responsive and the canvas available for direct drops', () => {
    expect(css).toContain('.canvas-empty-state')
    expect(css).toMatch(/\.canvas-empty-state \{[\s\S]*pointer-events: none/)
    expect(css).toMatch(/\.canvas-empty-copy button \{[\s\S]*pointer-events: auto/)
    expect(css).toContain('@media (max-width: 720px)')
  })
})
