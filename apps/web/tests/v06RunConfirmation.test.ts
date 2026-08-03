import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('vNext direct context composer contract', () => {
  const readSource = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8').replaceAll('\r\n', '\n')
  const app = readSource('../src/App.tsx')
  const composer = readSource('../src/features/canvas/SelectionComposer.tsx')
  const rail = readSource('../src/features/workrail/WorkRail.tsx')
  const canvas = readSource('../src/features/canvas/ProjectCanvas.tsx')

  it('launches runs directly from the selected context without RunConfirmDialog', () => {
    expect(app).not.toContain('<RunConfirmDialog')
    expect(app).toContain('selectionComposer={selectedIds.length ?')
    expect(app).toContain('onSend: requestSelectionRun')
    expect(composer).toContain('data-testid="selection-composer"')
    expect(composer).toContain('Ctrl/Cmd+Enter')
  })

  it('keeps intent, provider, result policy and edit target independent', () => {
    expect(composer).toContain('范式')
    expect(composer).toContain('Agent')
    expect(composer).toContain('结果')
    expect(composer).toContain('编辑对象')
    expect(app).toContain('targetRevisionId')
    expect(app).toContain('resultPolicy: { type: resultPolicy }')
  })

  it('uses single+linked context and strict multi-selection context', () => {
    expect(app).toContain("if (selectedIds.length !== 1) return [...selectedIds]")
    expect(app).toContain('relationNodes.map((node) => node.id)')
    expect(composer).toContain('当前对象 +')
    expect(composer).toContain('严格使用已选')
  })

  it('keeps the right rail as workspace/canvas global context', () => {
    expect(rail).toContain('对整个{contextLabel}直接工作')
    expect(rail).toContain('global-context-composer')
    expect(app).toContain('contextCount={globalContextIds.length}')
    expect(app).toContain('onSend={requestGlobalRun}')
  })

  it('memoizes the heavy Canvas while the inline command changes', () => {
    expect(canvas).toContain('memo(function ProjectCanvas')
    expect(app).toContain('const sceneStyle = useMemo')
    expect(app).toContain('onPointerWorldChange={rememberCanvasPoint}')
  })
})
