import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('Gate F plain-language composer contract', () => {
  const readSource = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8').replaceAll('\r\n', '\n')
  const app = readSource('../src/App.tsx')
  const composer = readSource('../src/features/canvas/SelectionComposer.tsx')
  const rail = readSource('../src/features/workrail/WorkRail.tsx')
  const canvas = readSource('../src/features/canvas/ProjectCanvas.tsx')

  it('launches runs directly from selected context without a technical confirmation page', () => {
    expect(app).not.toContain('<RunConfirmDialog')
    expect(app).toContain('selectionComposer: selectedIds.length ?')
    expect(app).toContain('onSend: requestSelectionRun')
    expect(composer).toContain('data-testid="selection-composer"')
    expect(composer).toContain('Ctrl/Cmd+Enter')
  })

  it('shows only user decisions and hides internal run parameters', () => {
    expect(composer).toContain('做什么…')
    expect(composer).toContain('label="操作"')
    expect(composer).toContain('label="结果"')
    expect(composer).not.toContain('结果作为新节点')
    expect(composer).toContain('label="Agent"')
    expect(composer).not.toContain('工作方式')
    expect(composer).not.toContain('结果去向')
    expect(composer).not.toContain('编辑对象')
    expect(rail).not.toContain('outputIntent')
    expect(rail).not.toContain('Result Policy')
  })

  it('makes selected and explicitly added context visible and removable', () => {
    expect(app).toContain('defaultSelectionContextIds')
    expect(app).toContain('relationNodes.map((node) => node.id)')
    expect(app).toContain('onToggleContext: toggleContext')
    expect(composer).toContain('onToggleContext')
    expect(composer).toContain('lcos-context-peek-popover')
  })

  it('persists command drafts instead of clearing them on selection changes', () => {
    expect(app).toContain("getCommandDraft(activeProjectId, workspaceId, 'selection'")
    expect(app).toContain("saveCommandDraft(activeProjectId, workspaceId, 'selection'")
    expect(app).toContain("deleteCommandDraft(activeProjectId, workspaceId, 'selection'")
    expect(app).not.toContain("setSelectionComposerText('')\n  }, [selectedIds.join(',')")
  })

  it('keeps the right rail as workspace/canvas global context', () => {
    expect(rail).toContain('对整个{contextLabel}直接工作')
    expect(rail).toContain('global-context-composer')
    expect(app).toContain('contextCount: globalContextIds.length')
    expect(app).toContain('onSend: requestGlobalRun')
  })

  it('memoizes the heavy Canvas while the inline command changes', () => {
    expect(canvas).toContain('memo(function ProjectCanvas')
    expect(app).toContain('const sceneStyle = useMemo')
    expect(app).toContain('onPointerWorldChange: rememberCanvasPoint')
  })
})
