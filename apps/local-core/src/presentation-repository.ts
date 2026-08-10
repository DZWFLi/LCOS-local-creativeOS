import type { PresentationViewV0 } from '@local-creative-os/contracts'

/**
 * PresentationRepository — Phase A skeleton only.
 *
 * No SQLite table exists yet (deliberately). The interface is frozen so
 * routes/services never reach for raw SQL while the storage decision is open.
 */
export interface PresentationRepository {
  getPresentationView(viewId: string): PresentationViewV0 | undefined
  listPresentationViews(projectId: string, scopeId: string): readonly PresentationViewV0[]
  savePresentationView(view: PresentationViewV0): void
}
