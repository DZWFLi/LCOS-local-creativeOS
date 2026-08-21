import { initialAiDrafts, initialDecisions, initialScriptReviews, scriptProject } from '../data/scriptProject'
import type { ProjectState } from '../types/evaluation'

export const DEMO_SCHEMA_VERSION = 1

export const DEMO_START = {
  selectedVersionId: 'script-v2',
  selectedSegmentId: 'product-setup',
  activeTab: 'human' as const,
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

export function createDemoState(): ProjectState {
  return {
    versions: clone(scriptProject.versions),
    reviews: clone(initialScriptReviews),
    aiDrafts: clone(initialAiDrafts),
    decisions: clone(initialDecisions),
    ui: { ...DEMO_START },
  }
}
