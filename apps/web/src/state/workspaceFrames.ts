import type { CanvasNode, Workspace, WorkspaceFrameVM } from '../model'

const FRAME_PADDING = 34
const HEADER_HEIGHT = 34

export function workspaceMemberIds(workspace: Workspace, nodes: CanvasNode[], scopeId: string): string[] {
  const inScope = nodes.filter((node) => (node.scopeId ?? 'scope-root') === scopeId)
  const explicit = inScope.filter((node) => node.workspaceIds?.includes(workspace.id)).map((node) => node.id)
  if (explicit.length) return explicit
  const focused = new Set(workspace.focusedViewIds)
  return inScope.filter((node) => focused.has(node.id)).map((node) => node.id)
}

export function buildWorkspaceFrame(workspace: Workspace, nodes: CanvasNode[], activeWorkspaceId: string | null, scopeId: string): WorkspaceFrameVM | null {
  if (workspace.scopeId !== scopeId) return null
  const memberViewIds = workspaceMemberIds(workspace, nodes, scopeId)
  const members = memberViewIds.map((id) => nodes.find((node) => node.id === id)).filter((node): node is CanvasNode => Boolean(node))
  if (!members.length) return null
  const left = Math.min(...members.map((node) => node.x))
  const top = Math.min(...members.map((node) => node.y))
  const right = Math.max(...members.map((node) => node.x + node.width))
  const bottom = Math.max(...members.map((node) => node.y + node.height))
  const derived = {
    x: left - FRAME_PADDING,
    y: top - FRAME_PADDING - HEADER_HEIGHT,
    width: right - left + FRAME_PADDING * 2,
    height: bottom - top + FRAME_PADDING * 2 + HEADER_HEIGHT,
  }
  return {
    workspaceId: workspace.id,
    label: workspace.label,
    scopeId,
    memberViewIds,
    bounds: workspace.frameBounds ?? derived,
    active: activeWorkspaceId === workspace.id,
  }
}

export function buildWorkspaceFrames(workspaces: Workspace[], nodes: CanvasNode[], activeWorkspaceId: string | null, scopeId: string): WorkspaceFrameVM[] {
  return workspaces.map((workspace) => buildWorkspaceFrame(workspace, nodes, activeWorkspaceId, scopeId)).filter((frame): frame is WorkspaceFrameVM => Boolean(frame))
}

export function moveWorkspaceMembers(nodes: CanvasNode[], memberViewIds: string[], dx: number, dy: number): CanvasNode[] {
  const ids = new Set(memberViewIds)
  return nodes.map((node) => ids.has(node.id) ? { ...node, x: node.x + dx, y: node.y + dy } : node)
}
