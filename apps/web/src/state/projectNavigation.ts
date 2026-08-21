import type { Camera, ProjectNavigationState } from '../model'

const NAV_PREFIX = 'local-creative-os.navigation.v1'

function key(projectId: string): string {
  return `${NAV_PREFIX}.${projectId}`
}

export function loadProjectNavigationState(projectId: string): ProjectNavigationState | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(key(projectId))
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<ProjectNavigationState>
    const camera = parsed.camera
    if (!camera || !Number.isFinite(camera.x) || !Number.isFinite(camera.y) || !Number.isFinite(camera.zoom)) return null
    return { projectId, camera: { x: camera.x, y: camera.y, zoom: camera.zoom }, updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : new Date().toISOString() }
  } catch {
    return null
  }
}

export function saveProjectNavigationState(projectId: string, camera: Camera): void {
  if (typeof window === 'undefined') return
  const state: ProjectNavigationState = { projectId, camera: { ...camera }, updatedAt: new Date().toISOString() }
  window.localStorage.setItem(key(projectId), JSON.stringify(state))
}

export function clearProjectNavigationState(projectId?: string): void {
  if (typeof window === 'undefined') return
  if (projectId) {
    window.localStorage.removeItem(key(projectId))
    return
  }
  Object.keys(window.localStorage).filter((item) => item.startsWith(NAV_PREFIX)).forEach((item) => window.localStorage.removeItem(item))
}
