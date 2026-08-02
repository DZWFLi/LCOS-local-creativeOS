import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import type { ProjectGraphSnapshot } from '@local-creative-os/contracts'
import { indexProjectRoot, inspectProjectRoot } from '../src/project-root-indexer.js'

const roots: string[] = []
afterEach(async () => { await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))) })

function emptySnapshot(rootPath: string): ProjectGraphSnapshot {
  const now = '2026-08-02T00:00:00.000Z'
  return {
    schemaVersion: 7, graphVersion: 1 as ProjectGraphSnapshot['graphVersion'],
    project: { id: 'project-dogfood' as ProjectGraphSnapshot['project']['id'], name: 'Dogfood', rootPath, graphVersion: 1 as ProjectGraphSnapshot['graphVersion'], createdAt: now, updatedAt: now },
    scopes: [{ id: 'scope-root' as ProjectGraphSnapshot['scopes'][number]['id'], projectId: 'project-dogfood' as ProjectGraphSnapshot['project']['id'], parentScopeId: null, containerViewId: null, kind: 'root', name: 'Root', createdAt: now, updatedAt: now }],
    workspaces: [], artifacts: [], artifactViews: [], relations: [], notes: [], fileRecords: [], artifactRevisions: [], checkpoints: [],
  }
}

describe('Project root indexer', () => {
  it('summarizes before import and maps nested folders to collection scopes', async () => {
    const root = await mkdtemp(join(tmpdir(), 'lcos-root-index-')); roots.push(root)
    await mkdir(join(root, 'brief')); await mkdir(join(root, '.creative-os'))
    await writeFile(join(root, 'README.md'), '# Project', 'utf8')
    await writeFile(join(root, 'brief', 'spec.docx'), Buffer.from('PK\u0003\u0004docx', 'binary'))
    await writeFile(join(root, '.creative-os', 'internal.json'), '{}', 'utf8')

    const inspection = await inspectProjectRoot(root)
    expect(inspection).toMatchObject({ fileCount: 2, directoryCount: 1, requiresConfirmation: true })
    expect(inspection.skipped.some((item) => item.includes('.creative-os'))).toBe(true)

    const indexed = await indexProjectRoot(emptySnapshot(root))
    expect(indexed.fileRecords).toHaveLength(2)
    expect(indexed.artifacts.some((artifact) => artifact.title === 'spec.docx')).toBe(true)
    const collection = indexed.scopes.find((scope) => scope.kind === 'collection')
    expect(collection?.name).toBe('brief')
    expect(collection?.containerViewId).toBeTruthy()
    expect(indexed.artifactViews.some((view) => view.scopeId === collection?.id && indexed.artifacts.find((artifact) => artifact.id === view.artifactId)?.title === 'spec.docx')).toBe(true)
  })
})
