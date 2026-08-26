import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8')
const foundation = source('../src/foundation.css')
const capability = source('../src/features/shell/CapabilityPopover.tsx')

const dismissibleDialogs = [
  '../src/features/create/CreateContentDialog.tsx',
  '../src/features/create/ProjectCreateDialog.tsx',
  '../src/features/create/ScopeCreateDialog.tsx',
  '../src/features/create/LinkReferenceDialog.tsx',
  '../src/features/resources/UniversalImportPanel.tsx',
  '../src/features/resources/ResourceDetailDialog.tsx',
  '../src/features/resources/ObsidianImportDialog.tsx',
  '../src/features/conversations/ConversationContextDialog.tsx',
  '../src/features/project/ProjectToolsDialog.tsx',
  '../src/features/handoff/HandoffDialog.tsx',
  '../src/features/workspace/WorkspaceDialog.tsx',
  '../src/features/workspace/WorkspaceStatesDialog.tsx',
  '../src/features/ui/ConfirmDialog.tsx',
]

describe('dismissible dialog contract', () => {
  it('only dismisses when the pointer starts on the backdrop itself', () => {
    const helper = source('../src/features/ui/dismissibleLayer.ts')
    expect(helper).toContain('event.target !== event.currentTarget')
    expect(helper).toContain('if (disabled')
  })

  it('gives the shared modal backdrop the full viewport hit area', () => {
    expect(foundation).toContain('.modal-backdrop { position:fixed; inset:0;')
    expect(foundation).toContain('z-index: var(--lcos-z-modal-raised)') // z-index token 契约：modal 层 token 替代旧硬编码 210
  })

  it.each(dismissibleDialogs)('%s uses the shared backdrop protocol', (path) => {
    expect(source(path)).toContain('dismissFromBackdrop')
  })

  it('ImmersiveViewer delegates dismissal to the shared @base-ui Drawer backdrop protocol', () => {
    const viewer = source('../src/features/viewer/ImmersiveViewer.tsx')
    expect(viewer).toContain("from '@base-ui/react/drawer'")
    expect(viewer).toContain('onOpenChange={(open) => { if (!open) onClose() }}')
    expect(viewer).toContain('<Drawer.Close')
  })

  it('closes the capability surface from the canvas and labels the visible close action', () => {
    expect(capability).toContain("window.addEventListener('pointerdown', closeFromOutside)")
    expect(capability).toContain('<span>关闭</span>')
  })
})
