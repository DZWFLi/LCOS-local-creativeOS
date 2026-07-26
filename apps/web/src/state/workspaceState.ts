import type { Camera, NodeLayer, Workspace, WorkspaceIntent } from '../model'

export function createWorkspaceRecord(input: { id: string; label: string; intent: WorkspaceIntent; camera: Camera; visibleLayers: NodeLayer[]; now: string; scopeId?: string; focusedViewIds?: string[] }): Workspace {
  return {
    id: input.id,
    label: input.label.trim(),
    intent: input.intent,
    scopeId: input.scopeId ?? 'scope-root',
    camera: { ...input.camera },
    visibleLayers: [...input.visibleLayers],
    focusedViewIds: [...(input.focusedViewIds ?? [])],
    contextPolicy: 'workspace-related',
    createdAt: input.now,
    updatedAt: input.now,
  }
}

export function updateWorkspaceRecord(workspaces: Workspace[], id: string, patch: Partial<Pick<Workspace, 'label' | 'intent' | 'scopeId' | 'camera' | 'visibleLayers' | 'focusedViewIds' | 'contextPolicy'>>, now: string): Workspace[] {
  return workspaces.map((workspace) => workspace.id === id ? {
    ...workspace,
    ...patch,
    label: patch.label?.trim() || workspace.label,
    camera: patch.camera ? { ...patch.camera } : workspace.camera,
    visibleLayers: patch.visibleLayers ? [...patch.visibleLayers] : workspace.visibleLayers,
    focusedViewIds: patch.focusedViewIds ? [...patch.focusedViewIds] : workspace.focusedViewIds,
    updatedAt: now,
  } : workspace)
}

export function duplicateWorkspaceRecord(workspaces: Workspace[], id: string, nextId: string, now: string): { workspaces: Workspace[]; duplicate?: Workspace } {
  const index = workspaces.findIndex((workspace) => workspace.id === id)
  if (index < 0) return { workspaces }
  const source = workspaces[index]
  const duplicate: Workspace = {
    ...source,
    id: nextId,
    label: `${source.label} 副本`,
    camera: { ...source.camera, x: source.camera.x + 24, y: source.camera.y + 24 },
    visibleLayers: [...source.visibleLayers],
    focusedViewIds: [...source.focusedViewIds],
    createdAt: now,
    updatedAt: now,
  }
  return { workspaces: [...workspaces.slice(0, index + 1), duplicate, ...workspaces.slice(index + 1)], duplicate }
}

export function moveWorkspaceRecord(workspaces: Workspace[], id: string, direction: -1 | 1): Workspace[] {
  const index = workspaces.findIndex((workspace) => workspace.id === id)
  const target = index + direction
  if (index < 0 || target < 0 || target >= workspaces.length) return workspaces
  const next = [...workspaces]
  ;[next[index], next[target]] = [next[target], next[index]]
  return next
}

export function removeWorkspaceRecord(workspaces: Workspace[], id: string): Workspace[] {
  if (workspaces.length <= 1) return workspaces
  return workspaces.filter((workspace) => workspace.id !== id)
}

export function toggleWorkspaceLayer(workspaces: Workspace[], id: string, layer: NodeLayer, now: string): Workspace[] {
  return workspaces.map((workspace) => {
    if (workspace.id !== id) return workspace
    const has = workspace.visibleLayers.includes(layer)
    const visibleLayers = has ? workspace.visibleLayers.filter((item) => item !== layer) : [...workspace.visibleLayers, layer]
    if (!visibleLayers.length) return workspace
    return { ...workspace, visibleLayers, updatedAt: now }
  })
}
