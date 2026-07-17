import { createDemoState, DEMO_SCHEMA_VERSION } from '../demo/seed'
import type { ProjectState, StoredDemoState } from '../types/evaluation'

const STORAGE_KEY = 'adframe.demo-state.v1'
const LEGACY_KEYS = {
  versions: 'adframe.script-versions.v2',
  reviews: 'adframe.script-reviews.v2',
  aiDrafts: 'adframe.script-ai-drafts.v2',
  decisions: 'adframe.script-decisions.v1',
} as const

function parse<T>(value: string | null): T | null {
  if (!value) return null
  try { return JSON.parse(value) as T } catch { return null }
}

function envelope(projectId: string, data: ProjectState): StoredDemoState {
  return { schemaVersion: DEMO_SCHEMA_VERSION, projectId, updatedAt: new Date().toISOString(), data }
}

function isProjectState(value: unknown): value is ProjectState {
  if (!value || typeof value !== 'object') return false
  const state = value as Partial<ProjectState>
  return Array.isArray(state.versions) && state.versions.length > 0
    && state.versions.every((version) => Array.isArray(version.segments) && version.segments.length > 0)
    && Array.isArray(state.reviews)
    && Array.isArray(state.aiDrafts)
    && Array.isArray(state.decisions)
    && typeof state.ui?.selectedVersionId === 'string'
    && typeof state.ui?.selectedSegmentId === 'string'
    && ['human', 'ai', 'summary'].includes(state.ui?.activeTab ?? '')
}

export const demoStorage = {
  load(projectId: string): ProjectState {
    const fallback = createDemoState()
    try {
      const stored = parse<StoredDemoState>(localStorage.getItem(STORAGE_KEY))
      if (stored?.schemaVersion === DEMO_SCHEMA_VERSION && stored.projectId === projectId && isProjectState(stored.data)) return stored.data

      const versions = parse<ProjectState['versions']>(localStorage.getItem(LEGACY_KEYS.versions))
      if (!versions?.length || !versions.every((version) => Array.isArray(version.segments) && version.segments.length > 0)) return fallback
      const migrated: ProjectState = {
        versions,
        reviews: parse<ProjectState['reviews']>(localStorage.getItem(LEGACY_KEYS.reviews)) ?? fallback.reviews,
        aiDrafts: parse<ProjectState['aiDrafts']>(localStorage.getItem(LEGACY_KEYS.aiDrafts)) ?? fallback.aiDrafts,
        decisions: parse<ProjectState['decisions']>(localStorage.getItem(LEGACY_KEYS.decisions)) ?? fallback.decisions,
        ui: fallback.ui,
      }
      if (!isProjectState(migrated)) return fallback
      this.save(projectId, migrated)
      Object.values(LEGACY_KEYS).forEach((key) => localStorage.removeItem(key))
      return migrated
    } catch { return fallback }
  },

  save(projectId: string, data: ProjectState): void {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(envelope(projectId, data))) } catch { /* Demo remains usable without persistence. */ }
  },

  reset(projectId: string): ProjectState {
    const data = createDemoState()
    try {
      localStorage.removeItem(STORAGE_KEY)
      Object.values(LEGACY_KEYS).forEach((key) => localStorage.removeItem(key))
    } catch { /* Reset still returns the seed state. */ }
    this.save(projectId, data)
    return data
  },
}
