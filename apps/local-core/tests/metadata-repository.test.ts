import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import type { ProjectGraphSnapshot } from '@local-creative-os/contracts'
import { afterEach, describe, expect, it } from 'vitest'

import { SqliteMetadataRepository } from '../src/metadata-repository.js'

const cleanup: string[] = []

function snapshot(): ProjectGraphSnapshot {
  const now = '2026-07-23T12:00:00.000Z'
  const projectId = 'disposable-portasplit' as ProjectGraphSnapshot['project']['id']
  const workspaceId = 'workspace-main' as ProjectGraphSnapshot['workspaces'][number]['id']
  const firstArtifactId = 'artifact-brief' as ProjectGraphSnapshot['artifacts'][number]['id']
  const secondArtifactId = 'artifact-board' as ProjectGraphSnapshot['artifacts'][number]['id']
  const firstViewId = 'view-brief' as ProjectGraphSnapshot['artifactViews'][number]['id']
  const secondViewId = 'view-board' as ProjectGraphSnapshot['artifactViews'][number]['id']
  return {
    schemaVersion: 1,
    project: { id: projectId, name: 'PortaSplit', rootPath: 'disposable://portasplit', createdAt: now, updatedAt: now },
    workspaces: [{
      id: workspaceId, projectId, name: 'Main', intent: 'build',
      viewport: { x: 12, y: 34, zoom: 0.9 }, focusedNodeIds: [], visibleLayers: ['core'], updatedAt: now,
    }],
    artifacts: [
      { id: firstArtifactId, projectId, title: 'Brief', kind: 'markdown', localPath: 'disposable://brief', availability: 'available', createdAt: now, updatedAt: now },
      { id: secondArtifactId, projectId, title: 'Board', kind: 'image', localPath: 'disposable://board', availability: 'available', createdAt: now, updatedAt: now },
    ],
    artifactViews: [
      { id: firstViewId, artifactId: firstArtifactId, workspaceId, referenceKind: 'primary', position: { x: 10, y: 20 }, size: { width: 200, height: 140 }, displayMode: 'card', collapsed: false },
      { id: secondViewId, artifactId: secondArtifactId, workspaceId, referenceKind: 'primary', position: { x: 310, y: 20 }, size: { width: 240, height: 160 }, displayMode: 'thumbnail', collapsed: false },
    ],
    relations: [{
      id: 'relation-1' as ProjectGraphSnapshot['relations'][number]['id'],
      projectId, workspaceId, sourceArtifactViewId: firstViewId, targetArtifactViewId: secondViewId,
      kind: 'informs', createdAt: now, updatedAt: now,
    }],
  }
}

afterEach(async () => {
  await Promise.all(cleanup.splice(0).map((path) => rm(path, { recursive: true, force: true })))
})

describe('SqliteMetadataRepository', () => {
  it('migrates, saves metadata, and restores it after reopening', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'local-core-phase2-lite-'))
    cleanup.push(directory)
    const path = join(directory, 'metadata.sqlite')
    const first = new SqliteMetadataRepository(path)
    first.save(snapshot())
    expect(first.schemaVersion).toBe(1)
    first.close()

    const reopened = new SqliteMetadataRepository(path)
    const restored = reopened.get('disposable-portasplit')
    reopened.close()
    expect(restored).toEqual({
      ...snapshot(),
      artifacts: [...snapshot().artifacts].sort((left, right) => String(left.id).localeCompare(String(right.id))),
      artifactViews: [...snapshot().artifactViews].sort((left, right) => String(left.id).localeCompare(String(right.id))),
    })
  })

  it('deletes a view without deleting its artifact', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'local-core-phase2-lite-'))
    cleanup.push(directory)
    const repository = new SqliteMetadataRepository(join(directory, 'metadata.sqlite'))
    repository.save(snapshot())
    repository.deleteArtifactView('view-brief')
    const restored = repository.get('disposable-portasplit')
    expect(restored?.artifactViews).toHaveLength(1)
    expect(restored?.artifacts).toHaveLength(2)
    expect(restored?.relations).toHaveLength(0)
    repository.close()
  })

  it('rejects non-disposable projects', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'local-core-phase2-lite-'))
    cleanup.push(directory)
    const repository = new SqliteMetadataRepository(join(directory, 'metadata.sqlite'))
    const value = snapshot()
    expect(() => repository.save({
      ...value,
      project: { ...value.project, id: 'real-project' as typeof value.project.id },
    })).toThrow('only accepts disposable')
    repository.close()
  })
})
