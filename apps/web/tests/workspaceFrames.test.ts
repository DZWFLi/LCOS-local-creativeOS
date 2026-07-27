import { describe, expect, it } from 'vitest'
import type { CanvasNode, Workspace } from '../src/model'
import { buildWorkspaceFrame, moveWorkspaceMembers, workspaceMemberIds } from '../src/state/workspaceFrames'

const workspace: Workspace = {
  id: 'ws-a', label: 'A', intent: 'explore', scopeId: 'scope-root', camera: { x: 999, y: 999, zoom: .3 },
  visibleLayers: ['core', 'process'], focusedViewIds: ['a', 'b'], contextPolicy: 'workspace-related', createdAt: '0', updatedAt: '0',
}
const nodes: CanvasNode[] = [
  { id: 'a', kind: 'working', title: 'A', subtitle: '', x: 100, y: 120, width: 200, height: 140, scopeId: 'scope-root', workspaceIds: ['ws-a'] },
  { id: 'b', kind: 'source', title: 'B', subtitle: '', x: 360, y: 320, width: 180, height: 120, scopeId: 'scope-root', workspaceIds: ['ws-a'] },
  { id: 'c', kind: 'source', title: 'C', subtitle: '', x: 900, y: 900, width: 180, height: 120, scopeId: 'scope-root' },
]

describe('v0.6.1 workspace frame', () => {
  it('derives members from the canvas view model, not camera', () => {
    expect(workspaceMemberIds(workspace, nodes, 'scope-root')).toEqual(['a', 'b'])
    const frame = buildWorkspaceFrame(workspace, nodes, 'ws-a', 'scope-root')
    expect(frame).not.toBeNull()
    if (!frame) throw new Error('Expected workspace frame')
    expect(frame.memberViewIds).toEqual(['a', 'b'])
    expect(frame.bounds.x).toBeLessThan(100)
    expect(frame.bounds.x + frame.bounds.width).toBeGreaterThan(540)
    expect(frame.active).toBe(true)
  })

  it('group move only changes member positions', () => {
    const moved = moveWorkspaceMembers(nodes, ['a', 'b'], 50, -20)
    expect(moved.find((node) => node.id === 'a')).toMatchObject({ x: 150, y: 100, workspaceIds: ['ws-a'] })
    expect(moved.find((node) => node.id === 'b')).toMatchObject({ x: 410, y: 300 })
    expect(moved.find((node) => node.id === 'c')).toMatchObject({ x: 900, y: 900 })
  })
})
