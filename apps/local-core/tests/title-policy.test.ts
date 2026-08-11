import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { ProjectGraphSnapshot } from '@local-creative-os/contracts'
import { afterEach, describe, expect, it } from 'vitest'
import { SqliteMetadataRepository } from '../src/metadata-repository.js'

const cleanup: string[] = []

function disposableSnapshot(): ProjectGraphSnapshot {
  const now = '2026-08-11T12:00:00.000Z'
  const projectId = 'title-policy-project' as ProjectGraphSnapshot['project']['id']
  return {
    schemaVersion: 28,
    graphVersion: 1 as ProjectGraphSnapshot['graphVersion'],
    project: {
      id: projectId, name: '未命名', rootPath: 'disposable://title-policy',
      graphVersion: 1 as ProjectGraphSnapshot['project']['graphVersion'],
      createdAt: now, updatedAt: now,
    },
    scopes: [{
      id: 'scope-root' as ProjectGraphSnapshot['scopes'][number]['id'],
      projectId, parentScopeId: null, containerViewId: null,
      kind: 'root', name: 'Root', createdAt: now, updatedAt: now,
    }],
    workspaces: [{
      id: 'workspace-main' as ProjectGraphSnapshot['workspaces'][number]['id'],
      projectId, scopeId: 'scope-root' as ProjectGraphSnapshot['workspaces'][number]['scopeId'],
      name: '新工作区', intent: null,
      viewport: { x: 0, y: 0, zoom: 1 }, focusedViewIds: [], visibleLayers: ['core'], updatedAt: now,
      contextPolicy: 'selection-only',
    }],
    artifacts: [{
      id: 'artifact-1' as ProjectGraphSnapshot['artifacts'][number]['id'],
      projectId, title: '新节点', kind: 'text', availability: 'available', createdAt: now, updatedAt: now,
    }],
    artifactViews: [],
    relations: [],
    notes: [],
    artifactRevisions: [],
    fileRecords: [],
    checkpoints: [],
  }
}

afterEach(async () => {
  await Promise.all(cleanup.splice(0).map((path) => rm(path, { recursive: true, force: true, maxRetries: 3 }).catch(() => { /* ignore */ })))
})

describe('Title Policy (Phase A Zero Naming)', () => {
  it('migrates to schemaVersion 24 and defaults title_mode to auto', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'local-core-title-policy-'))
    cleanup.push(directory)
    const repository = new SqliteMetadataRepository(join(directory, 'metadata.sqlite'))
    expect(repository.schemaVersion).toBe(28)
    repository.save(disposableSnapshot())
    expect(repository.getEntityTitleMode('project', 'title-policy-project')).toBe('auto')
    expect(repository.getEntityTitleMode('workspace', 'workspace-main')).toBe('auto')
    expect(repository.getEntityTitleMode('artifact', 'artifact-1')).toBe('auto')
    expect(repository.getEntityTitleMode('scope', 'scope-root')).toBe('auto')
  })

  it('user rename stores manual mode and updates the visible title', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'local-core-title-policy-'))
    cleanup.push(directory)
    const repository = new SqliteMetadataRepository(join(directory, 'metadata.sqlite'))
    repository.save(disposableSnapshot())
    repository.updateEntityTitle('artifact', 'artifact-1', { title: 'EP05 客户修改依据', mode: 'manual', generatedBy: 'user' })
    expect(repository.getArtifact('artifact-1')?.title).toBe('EP05 客户修改依据')
    expect(repository.getEntityTitleMode('artifact', 'artifact-1')).toBe('manual')
  })

  it('workspace and project titles follow the same policy', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'local-core-title-policy-'))
    cleanup.push(directory)
    const repository = new SqliteMetadataRepository(join(directory, 'metadata.sqlite'))
    repository.save(disposableSnapshot())
    repository.updateEntityTitle('workspace', 'workspace-main', { title: '视觉参考', mode: 'manual' })
    repository.updateEntityTitle('project', 'title-policy-project', { title: 'PortaSplit', mode: 'locked' })
    expect(repository.getWorkspace('workspace-main')?.name).toBe('视觉参考')
    expect(repository.getProject('title-policy-project')?.name).toBe('PortaSplit')
    expect(repository.getEntityTitleMode('workspace', 'workspace-main')).toBe('manual')
    expect(repository.getEntityTitleMode('project', 'title-policy-project')).toBe('locked')
  })

  it('rejects empty title and unknown entity ids', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'local-core-title-policy-'))
    cleanup.push(directory)
    const repository = new SqliteMetadataRepository(join(directory, 'metadata.sqlite'))
    repository.save(disposableSnapshot())
    expect(() => repository.updateEntityTitle('artifact', 'artifact-1', { title: '   ', mode: 'manual' })).toThrow(/Title must be/)
    expect(() => repository.updateEntityTitle('artifact', 'missing-artifact', { title: 'X', mode: 'manual' })).toThrow(/not found/)
    expect(repository.getEntityTitleMode('project', 'missing-project')).toBeUndefined()
  })
})



