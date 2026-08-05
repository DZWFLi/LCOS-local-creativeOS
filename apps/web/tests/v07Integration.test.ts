import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8')
const contracts = readFileSync(new URL('../src/runtime/v07UiContracts.ts', import.meta.url), 'utf8')
const capability = readFileSync(new URL('../src/features/shell/CapabilityPopover.tsx', import.meta.url), 'utf8')
const workspace = readFileSync(new URL('../src/features/workspace/WorkspaceDock.tsx', import.meta.url), 'utf8')
const canvas = readFileSync(new URL('../src/features/canvas/ProjectCanvas.tsx', import.meta.url), 'utf8')
const nodeVisual = readFileSync(new URL('../src/features/canvas/CanvasNodeVisual.tsx', import.meta.url), 'utf8')
const railMode = readFileSync(new URL('../src/state/workRailMode.ts', import.meta.url), 'utf8')
const main = readFileSync(new URL('../src/main.tsx', import.meta.url), 'utf8')
const v071 = readFileSync(new URL('../src/v071.css', import.meta.url), 'utf8')

function functionBlock(source: string, name: string, nextName: string) {
  const start = source.indexOf(`const ${name}`)
  const end = source.indexOf(`const ${nextName}`, start)
  return source.slice(start, end)
}

describe('v0.7.1 lightweight backend-integrated UI', () => {
  it('keeps one Workspace rail and replaces the second dock with a compact capability popover', () => {
    expect(app).toContain('<WorkspaceDock')
    expect(app).toContain('<CapabilityPopover')
    expect(app).not.toContain('<UtilityDock')
    expect(workspace).toContain('capability-launcher')
    expect(capability).toContain('快捷能力')
  })

  it('keeps Workspace activation and location independent from Scope navigation', () => {
    const changeWorkspace = functionBlock(app, 'changeWorkspace', 'locateWorkspace')
    const locateWorkspace = functionBlock(app, 'locateWorkspace', 'enterScope')
    expect(changeWorkspace).toContain('setWorkspaceId(id)')
    expect(changeWorkspace).not.toContain('setScopeId')
    expect(changeWorkspace).not.toContain('setCamera')
    expect(locateWorkspace).toContain('setCamera')
    expect(locateWorkspace).not.toContain('setScopeId')
  })

  it('uses direct node controls instead of opening selection details in the Work Rail', () => {
    expect(canvas).toContain('<NodeContextToolbar')
    expect(canvas).toContain('camera.zoom > .2')
    expect(nodeVisual).toContain('<CircleHelp')
    expect(app).toContain('<NodeInfoPopover')
    expect(app).not.toContain('<NodeQuickLook')
    expect(railMode).toContain("return 'workspace'")
    expect(railMode).not.toContain("return 'selection'")
  })

  it('keeps canonical Runtime capability gates and imports the v0.7.1 density layer', () => {
    expect(contracts).toContain("runWorkflow: runtime ? { enabled: true } : unavailable('请先打开一个本地项目')")
    expect(capability).toContain('props.capabilities.runWorkflow.reason')
    expect(main).toContain("import './v071.css'")
    expect(v071).toContain('top: 10px; transform: none;')
  })

  it('routes Link References to server-side universal import instead of frontend form generation', () => {
    expect(contracts).toContain('readonly title?: string')
    expect(contracts).not.toContain('createLinkReferenceDocument')
    expect(contracts).not.toContain('readonly purpose: string')
    expect(app).toContain('importResourceUrl(')
    expect(app).not.toContain('dropFiles([file]')
  })
})
