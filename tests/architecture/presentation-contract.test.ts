import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = join(__dirname, '../..')
const presentations = readFileSync(join(root, 'packages/contracts/src/presentations.ts'), 'utf8')
const service = readFileSync(join(root, 'apps/local-core/src/presentation-application-service.ts'), 'utf8')
const repository = readFileSync(join(root, 'apps/local-core/src/presentation-repository.ts'), 'utf8')
const draftState = readFileSync(join(root, 'apps/web/src/state/presentationDraftState.ts'), 'utf8')

describe('Presentation contract boundaries (Phase A)', () => {
  it('freezes PresentationViewV0 with presentation-owned fields only', () => {
    expect(presentations).toContain('export interface PresentationViewV0')
    expect(presentations).toContain('schemaVersion: 0')
    expect(presentations).toContain('memberViewIds')
    expect(presentations).toContain('hierarchy: PresentationHierarchyV0')
    expect(presentations).toContain('presentationEdges')
    expect(presentations).toContain('pinnedViewIds')
    expect(presentations).toContain('emphasisByViewId')
    expect(presentations).toContain('version: number')
  })

  it('keeps Presentation version independent from Project graphVersion', () => {
    // Rule: Artifact/Domain Relation/Revision semantic mutation → graphVersion.
    // Presentation membership/hierarchy/positions → presentation.version.
    // A node drag must NEVER bump graphVersion.
    expect(presentations).not.toContain('graphVersion')
    expect(presentations).toContain('version: number')
    expect(presentations).toContain("updatedBy: 'web' | 'agent' | 'core'")
  })

  it('does not leak business ontology into the Presentation contract', () => {
    for (const forbidden of ['Brief', 'StageEntity', 'WorkflowStep', 'Decision', 'OpenLoop', 'Camera', 'hover', 'selection']) {
      expect(presentations, `forbidden ${forbidden}`).not.toContain(forbidden)
    }
  })

  it('routes presentation logic through an Application Service + repository, never raw SQL', () => {
    expect(service).toContain('class PresentationApplicationService')
    expect(service).toContain('private readonly repository: PresentationRepository')
    expect(repository).toContain('export interface PresentationRepository')
    expect(repository).not.toContain('node:sqlite')
    expect(repository).not.toContain('CREATE TABLE')
    expect(service).not.toContain('node:sqlite')
  })

  it('new Presentation code must not depend on legacy behavioral hints as truth', () => {
    for (const legacy of ['understand', 'explore', 'build', 'decide']) {
      expect(service, `service legacy ${legacy}`).not.toContain(legacy)
      expect(repository, `repository legacy ${legacy}`).not.toContain(legacy)
    }
    // Phase B: memory store now mirrors into the persistent PresentationView.
    expect(draftState).toContain('getPresentationBridge')
    expect(draftState).toContain('flushSoon')
  })
})
