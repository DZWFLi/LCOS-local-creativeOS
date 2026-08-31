import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8')
const scene = readFileSync(new URL('../src/features/shell/CanvasSceneHost.tsx', import.meta.url), 'utf8')
const contracts = readFileSync(new URL('../src/runtime/v07UiContracts.ts', import.meta.url), 'utf8')
const capability = readFileSync(new URL('../src/features/shell/CapabilityPopover.tsx', import.meta.url), 'utf8')
const workspace = readFileSync(new URL('../src/features/workspace/WorkspaceDock.tsx', import.meta.url), 'utf8')
const canvas = readFileSync(new URL('../src/features/canvas/ProjectCanvas.tsx', import.meta.url), 'utf8')
const nodeVisual = readFileSync(new URL('../src/features/canvas/CanvasNodeVisual.tsx', import.meta.url), 'utf8')
const railMode = readFileSync(new URL('../src/state/workRailMode.ts', import.meta.url), 'utf8')
const main = readFileSync(new URL('../src/main.tsx', import.meta.url), 'utf8')
const vnext = readFileSync(new URL('../src/vnext.css', import.meta.url), 'utf8')

function functionBlock(source: string, name: string, nextName: string) {
  const start = source.indexOf(`const ${name}`)
  const end = source.indexOf(`const ${nextName}`, start)
  return source.slice(start, end)
}

describe('v0.7.1 lightweight backend-integrated UI', () => {
  it('keeps one Workspace rail and replaces the second dock with a compact capability popover', () => {
    expect(scene).toContain('<WorkspaceRailVNext')
    expect(scene).toContain('<CapabilityPopover')
    expect(app).not.toContain('<UtilityDock')
    expect(scene).not.toContain('<UtilityDock')
    expect(scene).toContain('vnext-surface-host')
    expect(capability).toContain('快捷能力')
  })

  it('keeps Workspace scene activation on the Workspace identity and locates saved scenes via Scope navigation', () => {
    const changeWorkspace = functionBlock(app, 'changeWorkspace', 'openWorkspaceScene')
    const openScene = functionBlock(app, 'openWorkspaceScene', 'openCurrentScene')
    const locateWorkspace = functionBlock(app, 'locateWorkspace', 'locateNote')
    expect(changeWorkspace).toContain('setWorkspaceId(id)')
    expect(changeWorkspace).not.toContain('setScopeId')
    expect(changeWorkspace).not.toContain('setCamera')
    expect(openScene).toContain('setScopeId(next.scopeId)')
    expect(openScene).toContain('setCamera(next.camera)')
    expect(locateWorkspace).toContain('setCamera')
    expect(locateWorkspace).not.toContain('setScopeId')
  })

  it('uses direct node controls instead of opening selection details in the Work Rail', () => {
    expect(canvas).toContain('onCreateScopeFromSelection')
    expect(canvas).toContain('onDirectProjectViewDrop')
    expect(canvas).not.toContain('onStageTransfer')
    expect(canvas).toContain('<SelectionGroupActions')
    expect(canvas).toContain('selectionComposerPosition')
    expect(nodeVisual).toContain('<Info')
    expect(nodeVisual).not.toContain('CircleHelp')
    expect(scene).toContain('<NodeInfoPopover')
    expect(app).not.toContain('<NodeQuickLook')
    expect(scene).not.toContain('<NodeQuickLook')
    expect(railMode).toContain("return 'workspace'")
    expect(railMode).not.toContain("return 'selection'")
  })

  it('keeps canonical Runtime capability gates and imports the v0.7.1 density layer', () => {
    expect(contracts).toContain("runWorkflow: runtime ? { enabled: true } : unavailable('请先打开一个本地项目')")
    expect(capability).toContain('props.capabilities.importCopy.enabled')
    expect(capability).toContain('props.capabilities.linkReference.reason')
    expect(capability).toContain('props.capabilities.contextManifest.enabled')
    expect(capability).not.toContain('runWorkflow')
    expect(main).toContain("import './vnext.css'")
    expect(vnext).toContain('.app-shell.porcelain-studio-v2')
  })

  it('routes Link References to server-side universal import instead of frontend form generation', () => {
    expect(contracts).toContain('readonly title?: string')
    expect(contracts).not.toContain('createLinkReferenceDocument')
    expect(contracts).not.toContain('readonly purpose: string')
    expect(app).toContain('importResourceUrl(')
    expect(app).not.toContain('dropFiles([file]')
  })
})
