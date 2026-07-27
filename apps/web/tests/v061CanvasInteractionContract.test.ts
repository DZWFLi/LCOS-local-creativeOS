import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const src = (relative: string) => fs.readFileSync(path.join(here, '..', 'src', relative), 'utf8')

const app = src('App.tsx')
const canvas = src('features/canvas/ProjectCanvas.tsx')
const minimap = src('features/canvas/CanvasMiniMap.tsx')
const navigation = src('state/projectNavigation.ts')
const model = src('model.ts')

describe('v0.6.1 canvas interaction architecture', () => {
  it('separates camera persistence from project prototype persistence', () => {
    expect(app).toContain('saveProjectNavigationState(activeProjectId, camera)')
    expect(app).toContain('activeWorkspaceId: null')
    expect(navigation).toContain('local-creative-os.navigation.v1')
    expect(model).toContain('ProjectNavigationState')
  })

  it('keeps zoom transform on CanvasWorld and screen HUD outside it', () => {
    expect(canvas).toContain('data-testid="canvas-world"')
    expect(canvas).toContain('scale(${camera.zoom})')
    expect(app).toContain('className="canvas-hud"')
  })

  it('supports resize, workspace frame drag and project-wide minimap nodes', () => {
    expect(canvas).toContain('className="resize-handle"')
    expect(canvas).toContain('workspace-frame-header')
    expect(app).toContain('<CanvasMiniMap nodes={nodes}')
    expect(minimap).toContain('data-camera-rect="true"')
    expect(minimap).toContain('data-minimap-node-id')
  })

  it('does not introduce React Flow persistence into domain', () => {
    const domain = fs.readFileSync(path.join(here, '..', '..', '..', 'packages', 'domain', 'src', 'index.ts'), 'utf8')
    expect(domain).not.toContain('@xyflow/react')
    expect(app).not.toContain('toObject()')
  })
})
