import type { PresentationViewV0 } from '@local-creative-os/contracts'

import type { PresentationRepository } from './presentation-repository.js'

/**
 * PresentationApplicationService — Phase A skeleton.
 *
 * Presentation owns membership / position / hierarchy / display relation /
 * manual anchor / emphasis / renderer ONLY. It never owns business truth.
 * Routes must not orchestrate presentation logic inline.
 */
export class PresentationApplicationService {
  constructor(private readonly repository: PresentationRepository) {}

  get(viewId: string): PresentationViewV0 | undefined {
    return this.repository.getPresentationView(viewId)
  }

  list(projectId: string, scopeId: string): readonly PresentationViewV0[] {
    return this.repository.listPresentationViews(projectId, scopeId)
  }

  save(view: PresentationViewV0): void {
    this.repository.savePresentationView(view)
  }
}
