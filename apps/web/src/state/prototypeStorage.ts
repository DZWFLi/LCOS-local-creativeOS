import type { CanvasEdge, CanvasNode, CanvasScope, PersistedPrototypeState, ProjectPackage, WorkRailPreferences, Workspace } from '../model'

const STORAGE_PREFIX = 'local-creative-os.prototype.v9'
const LEGACY_STORAGE_KEY = 'local-creative-os.prototype.v8'
const PROJECT_CATALOG_KEY = 'local-creative-os.projects.v1'

function withoutEphemeralUrls(nodes: CanvasNode[]): CanvasNode[] {
  return nodes.map(({ previewUrl: _previewUrl, ...node }) => node)
}

function stateKey(projectId: string): string {
  return `${STORAGE_PREFIX}.${projectId}`
}

function normalize(projectId: string, parsed: Partial<PersistedPrototypeState>): PersistedPrototypeState | null {
  if (!Array.isArray(parsed.nodes) || !Array.isArray(parsed.edges) || !Array.isArray(parsed.workspaces) || !Array.isArray(parsed.scopes)) return null
  const workspaces = parsed.workspaces.filter((item): item is Workspace => Boolean(item?.id && item?.label && item?.camera && item?.scopeId))
  const scopes = parsed.scopes.filter((item): item is CanvasScope => Boolean(item?.id && item?.label && item?.camera))
  if (!workspaces.length || !scopes.length) return null
  const activeWorkspaceId = workspaces.some((item) => item.id === parsed.activeWorkspaceId) ? String(parsed.activeWorkspaceId) : workspaces[0].id
  const activeScopeId = scopes.some((item) => item.id === parsed.activeScopeId) ? String(parsed.activeScopeId) : scopes[0].id
  const workRail: WorkRailPreferences = parsed.workRail ?? { pinned: true, collapsed: false, width: 350 }
  return {
    version: 9,
    projectId,
    nodes: parsed.nodes as CanvasNode[],
    edges: parsed.edges as CanvasEdge[],
    workspaces,
    scopes,
    activeWorkspaceId,
    activeScopeId,
    workRail,
  }
}

export function loadPrototypeState(projectId: string): PersistedPrototypeState | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(stateKey(projectId))
    if (raw) return normalize(projectId, JSON.parse(raw) as Partial<PersistedPrototypeState>)
    if (projectId === 'project-portasplit') {
      const legacy = window.localStorage.getItem(LEGACY_STORAGE_KEY)
      if (legacy) return normalize(projectId, JSON.parse(legacy) as Partial<PersistedPrototypeState>)
    }
    return null
  } catch {
    return null
  }
}

export function savePrototypeState(projectId: string, state: PersistedPrototypeState): void {
  if (typeof window === 'undefined') return
  const safeState: PersistedPrototypeState = { ...state, version: 9, projectId, nodes: withoutEphemeralUrls(state.nodes) }
  window.localStorage.setItem(stateKey(projectId), JSON.stringify(safeState))
}

export function clearPrototypeState(projectId?: string): void {
  if (typeof window === 'undefined') return
  if (projectId) window.localStorage.removeItem(stateKey(projectId))
  else {
    Object.keys(window.localStorage).filter((key) => key.startsWith(STORAGE_PREFIX) || key === LEGACY_STORAGE_KEY).forEach((key) => window.localStorage.removeItem(key))
  }
}

export function loadProjectCatalog(fallback: ProjectPackage[]): ProjectPackage[] {
  if (typeof window === 'undefined') return fallback
  try {
    const raw = window.localStorage.getItem(PROJECT_CATALOG_KEY)
    if (!raw) return fallback
    const parsed = JSON.parse(raw) as ProjectPackage[]
    const valid = parsed.filter((item) => item?.id && item?.label && item?.localPath)
    const byId = new Map([...fallback, ...valid].map((item) => [item.id, item]))
    return [...byId.values()]
  } catch {
    return fallback
  }
}

export function saveProjectCatalog(projects: ProjectPackage[]): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(PROJECT_CATALOG_KEY, JSON.stringify(projects))
}
