import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = join(__dirname, '../..')
const curation = readFileSync(join(root, 'packages/contracts/src/curation.ts'), 'utf8')

describe('Curation contract boundaries (Phase A)', () => {
  it('freezes CurationNodeV0 / CurationReadResultV0 query shapes', () => {
    expect(curation).toContain('export interface CurationNodeV0')
    expect(curation).toContain('export interface CurationReadResultV0')
    expect(curation).toContain('stableRef: string')
    expect(curation).toContain('title: string')
    expect(curation).toContain('contentKind: CurationContentKindV0')
    expect(curation).toContain('boundedText: string')
    expect(curation).toContain('sourceRefs: readonly CurationSourceRefV0[]')
    expect(curation).toContain('currentRevisionId?: string')
    expect(curation).toContain('totalMatches: number')
    expect(curation).toContain('truncated: boolean')
  })

  it('does not leak repository table shapes', () => {
    for (const table of ['artifact_views', 'file_records', 'resource_descriptors', 'conversation_messages', 'conversation_sections']) {
      expect(curation, `table ${table}`).not.toContain(table)
    }
  })

  it('does not introduce a second business ontology', () => {
    for (const forbidden of ['Brief', 'Stage', 'Decision', 'WorkflowStep', 'OpenLoop', 'memory_nodes', 'memory_edges']) {
      expect(curation, `forbidden ${forbidden}`).not.toContain(forbidden)
    }
  })

  it('carries evidence handles and bounded text instead of raw payloads', () => {
    expect(curation).toContain('revisionId?: string')
    expect(curation).toContain('contentHash?: string')
    expect(curation).toContain("kind: 'artifact' | 'resource' | 'conversation' | 'file'")
    expect(curation).toContain('boundedText')
  })
})
