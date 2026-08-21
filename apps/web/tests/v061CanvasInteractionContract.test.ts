import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const src = (relative: string) => fs.readFileSync(path.join(here, '..', 'src', relative), 'utf8')

const app = src('App.tsx')
const scene = src('features/shell/CanvasSceneHost.tsx')
const canvas = src('features/canvas/ProjectCanvas.tsx')
const spatialCanvas = src('features/spatial/SpatialCanvas.tsx')
const spatialViewport = src('features/spatial/SpatialViewport.tsx')
const spatialInteraction = src('features/spatial/spatialInteractionMachine.ts')
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

  it('keeps zoom transform on the shared SpatialViewport and screen HUD outside it', () => {
    expect(canvas).toContain('worldTestId="canvas-world"')
    expect(spatialCanvas).toContain('<SpatialViewport')
    expect(spatialViewport).toContain('spatialCameraTransform(camera)')
    expect(scene).toContain('data-testid="canvas-hud"')
  })

  it('keeps anchor create menu in the shared screen-space overlay layer', () => {
    expect(canvas).toContain('const spatialOverlays = <>')
    expect(canvas).toContain('data-testid="anchor-create-menu"')
    expect(canvas).toContain('overlays={spatialOverlays}')
    const viewportIndex = spatialCanvas.indexOf('<SpatialViewport')
    const overlayIndex = spatialCanvas.indexOf('<SpatialOverlayLayer>')
    expect(viewportIndex).toBeGreaterThan(-1)
    expect(overlayIndex).toBeGreaterThan(viewportIndex)
  })

  it('supports resize, workspace frame drag and active-scope minimap nodes', () => {
    expect(canvas).toContain('className="resize-handle"')
    expect(canvas).toContain('workspace-frame-header')
    expect(app).toContain('miniMap: {')
    expect(scene).toContain('<CanvasMiniMap {...props.miniMap}/>')
    expect(app).toContain('visibleWorkspaceFrames')
    expect(minimap).toContain('data-camera-rect="true"')
    expect(minimap).toContain('data-minimap-node-id')
    expect(minimap).toContain('data-minimap-scope-id')
    expect(minimap).toContain('cameraSafeViewportBounds(camera, viewportWidth, viewportHeight, safeInsets)')
    expect(minimap).toContain('x: viewportCenter.x - world.x * camera.zoom')
    expect(minimap).toContain('restorationFocusBounds(nodes)')
    expect(minimap).toContain('fitBoundsForReading(contentBounds, viewportWidth, viewportHeight, 72, safeInsets)')
    expect(minimap).toContain('onLocateContent')
    expect(app).toContain('proposeIslandRecoveryLayout(visibleNodes, scopeId')
    expect(app).toContain('预览归拢位置，确认后写入')
  })

  it('keeps right-edge auto-pan symmetric when the work rail is not on the right edge', () => {
    expect(canvas).toContain('dockOccludesLeft')
    expect(canvas).toContain('railOccludesRight')
    expect(canvas).toContain('rail.right >= rect.right - 1')
    expect(canvas).toContain('right: railOccludesRight && rail ? Math.max(rect.left, rail.left - 10) : rect.right')
  })

  it('keeps camera navigation out of project mutation paths', () => {
    const workspaceState = src('state/workspaceState.ts')
    expect(workspaceState).not.toContain('activeWorkspaceId: workspaceId')
    expect(app).not.toContain('const persistedWorkspaces = workspaces.map((workspace) => workspace.id === workspaceId ? { ...workspace, camera')
    expect(app).toContain('activeWorkspaceId: null')
  })

  it('keeps selection actions and the prompt composer in screen space', () => {
    const overlayIndex = canvas.indexOf('const spatialOverlays = <>')
    const toolbarIndex = canvas.indexOf('data-testid="selection-toolbar"', overlayIndex)
    const composerIndex = canvas.indexOf('<SelectionComposer', toolbarIndex)
    expect(overlayIndex).toBeGreaterThan(-1)
    expect(toolbarIndex).toBeGreaterThan(overlayIndex)
    expect(composerIndex).toBeGreaterThan(toolbarIndex)
    expect(canvas).toContain('overlays={spatialOverlays}')
    expect(canvas).not.toContain('camera.zoom > .28')
  })

  it('captures marquee and relation pointers only after the shared drag threshold', () => {
      expect(canvas).toContain('advanceSpatialMarquee(session, { x: event.clientX, y: event.clientY }, 4)')
      expect(spatialInteraction).toContain('Math.hypot(point.x - session.start.x, point.y - session.start.y) > threshold')
      expect(canvas).toContain("if (next.kind === 'marquee' && !wasMoved && next.moved)")
      expect(canvas).toContain('event.currentTarget.setPointerCapture(next.pointerId)')
    expect(canvas).toContain('if (!linkMoved.current && linkPointerId.current !== null)')
    const beginRelation = canvas.slice(canvas.indexOf('const beginRelation'), canvas.indexOf('const beginEdgeReconnect'))
    expect(beginRelation).not.toContain('setPointerCapture')
  })

  it('treats pointer cancellation as rollback rather than a successful commit', () => {
    expect(canvas).toContain('onPointerCancel={({ event }) => finishPointer(event, true)}')
    expect(canvas).toContain('restoreDraggedOriginals(draggedCandidate)')
    expect(canvas).toContain('if (frameResize.current) onFrameBoundsChange?.(frameResize.current.workspaceId, frameResize.current.originalBounds)')
    expect(canvas).toContain('width: Math.max(220, item.originalBounds.width + dx)')
    const cancelBranch = canvas.slice(canvas.indexOf('if (cancelled)'), canvas.indexOf('if (dragFrame.current !== null)', canvas.indexOf('if (cancelled)') + 20))
    expect(cancelBranch).not.toContain("finishPresentationInteraction('node-move')")
  })

  it('selects the real existing relation when duplicate creation is deduplicated', () => {
    expect(canvas).toContain('const existing = edges.find((edge) => edge.from === from && edge.to === to)')
    expect(canvas).toContain('setSelectedEdgeId(existing.id)')
    expect(canvas).not.toContain('setSelectedEdgeId(nextId)\n    setEdges((current) => current.some')
  })

  it('defers double-click and multi-selection collapse until the gesture proves it is not a drag', () => {
    expect(canvas).toContain('doublePressCandidate.current = isDoublePress ? node.id : null')
    expect(canvas).toContain('selectionCollapseCandidate.current = preserveMultiSelection ? node.id : null')
    expect(canvas).toContain('if (!wasDragging && draggedId && doublePressCandidate.current === draggedId)')
    expect(canvas).toContain('else if (!wasDragging && draggedId && selectionCollapseCandidate.current === draggedId)')
      expect(canvas).toContain('doublePressCandidate.current = null')
      expect(canvas).toContain('selectionCollapseCandidate.current = null')
  })

  it('does not let stale Active Context hydration overwrite newer user selection intent', () => {
    expect(app).toContain('const selectionVersionAtRequest = selectionIntentVersionRef.current')
    expect(app).toContain('selectionIntentVersionRef.current === selectionVersionAtRequest')
    expect(app).toContain('!selectionContextIntentRef.current.touched')
    expect(app.match(/selectionIntentVersionRef\.current \+= 1/g)?.length).toBeGreaterThanOrEqual(3)
  })

  it('selects every visible node with Ctrl/Cmd+A only while the canvas owns focus', () => {
    expect(canvas).toContain('testId="canvas" tabIndex={-1}')
    expect(canvas).toContain("if (blankCanvas) event.currentTarget.focus({ preventScroll: true })")
    expect(app).toContain("activeElement?.closest('[data-testid=\"canvas\"]')")
    expect(app).toContain("modifier && key === 'a' && canvasActive")
    expect(app).toContain('selectMarquee(visibleNodes.map((node) => node.id), false)')

    const textGuard = app.indexOf('if (isText) return')
    const selectAll = app.indexOf("modifier && key === 'a' && canvasActive")
    expect(textGuard).toBeGreaterThan(-1)
    expect(selectAll).toBeGreaterThan(textGuard)
  })

  it('routes only real external files through the shared Canvas import drop path', () => {
    expect(spatialCanvas).toContain("event.dataTransfer.types.includes('Files')")
    expect(spatialCanvas).toContain('onFilesDropped && files.length')
    expect(spatialCanvas).toContain('onFilesDropped(files, spatialScreenToWorld')
    expect(canvas).toContain('onFilesDropped={(files, point) => onFilesDropped(files, point.x, point.y)}')
    expect(canvas).toContain('onDragStart={(event) => event.preventDefault()}')
  })

  it('does not introduce React Flow persistence into domain', () => {
    const domain = fs.readFileSync(path.join(here, '..', '..', '..', 'packages', 'domain', 'src', 'index.ts'), 'utf8')
    expect(domain).not.toContain('@xyflow/react')
    expect(app).not.toContain('toObject()')
  })
})
