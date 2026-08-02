import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { ContextManifestService } from '../src/context-manifest-service.js'
import { SqliteMetadataRepository } from '../src/metadata-repository.js'
import { createMvpSampleSnapshot, MVP_SAMPLE_PROJECT_ID } from '../src/mvp-sample-project.js'

const temporaryDirectories: string[] = []
const repositories: SqliteMetadataRepository[] = []

afterEach(() => {
  for (const repository of repositories.splice(0)) repository.close()
  for (const directory of temporaryDirectories.splice(0)) rmSync(directory, { recursive: true, force: true })
})

describe('ContextManifestService', () => {
  it('builds a deterministic path-free manifest from Project Truth', async () => {
    const sampleRoot = mkdtempSync(join(tmpdir(), 'lcos-manifest-sample-'))
    const databaseRoot = mkdtempSync(join(tmpdir(), 'lcos-manifest-db-'))
    temporaryDirectories.push(sampleRoot, databaseRoot)
    const repository = new SqliteMetadataRepository(join(databaseRoot, 'metadata.sqlite'))
    repositories.push(repository)
    const snapshot = createMvpSampleSnapshot(sampleRoot, '2026-07-29T00:00:00.000Z')
    repository.save(snapshot)
    const service = new ContextManifestService(repository)
    const script = snapshot.artifacts.find((artifact) => artifact.title === 'Script')!

    const first = await service.build(MVP_SAMPLE_PROJECT_ID, { targetArtifactId: String(script.id) })
    const second = await service.build(MVP_SAMPLE_PROJECT_ID, { targetArtifactId: String(script.id) })
    const serialized = JSON.stringify(first)

    expect(first.id).toBe(second.id)
    expect(first.manifestHash).toBe(second.manifestHash)
    expect(first.renderedManifestHash).toBe(second.renderedManifestHash)
    expect(repository.getContextManifest(first.id)).toMatchObject({
      id: first.id,
      manifestHash: first.manifestHash,
      schemaVersion: 0,
    })
    expect(first.target?.title).toBe('Script')
    expect(first.references.map((reference) => reference.title)).toContain('Reference Image')
    expect(first.orderedItems).toContainEqual(expect.objectContaining({
      role: 'context',
      title: 'Brief',
    }))
    expect(first.feedback.some((item) => item.title === 'Feedback Notes')).toBe(true)
    expect(first.lockedElements).toContain('the MVP path focused on project understanding and handoff.')
    expect(first.orderedItems.some((item) => item.role === 'decision')).toBe(true)
    expect(first.renderedMarkdown).toContain('PortaSplit demo script')
    expect(serialized).not.toContain(sampleRoot)
    expect(serialized).not.toContain('observedPath')
  })

  it('freezes explicitly selected Canvas artifacts into context', async () => {
    const sampleRoot = mkdtempSync(join(tmpdir(), 'lcos-manifest-selection-'))
    const databaseRoot = mkdtempSync(join(tmpdir(), 'lcos-manifest-selection-db-'))
    temporaryDirectories.push(sampleRoot, databaseRoot)
    const repository = new SqliteMetadataRepository(join(databaseRoot, 'metadata.sqlite'))
    repositories.push(repository)
    const snapshot = createMvpSampleSnapshot(sampleRoot, '2026-07-29T00:00:00.000Z')
    repository.save(snapshot)
    const brief = snapshot.artifacts.find((artifact) => artifact.title === 'Brief')!

    const manifest = await new ContextManifestService(repository).build(MVP_SAMPLE_PROJECT_ID, {
      contextArtifactIds: [String(brief.id)],
    })

    expect(manifest.orderedItems).toContainEqual(expect.objectContaining({
      role: 'context',
      identity: String(brief.id),
      title: 'Brief',
    }))
  })
})
