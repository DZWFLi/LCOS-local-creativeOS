import { createHash } from 'node:crypto'
import { existsSync, mkdtempSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import type { PersistedContextManifestV0 } from '@local-creative-os/contracts'
import type { ArtifactViewId, ProjectId, Run, RuntimeDispatch, WorkspaceId } from '@local-creative-os/domain'

import { LcosprojService } from '../src/lcosproj-service.js'
import { SqliteMetadataRepository } from '../src/metadata-repository.js'
import { createMvpSampleSnapshot } from '../src/mvp-sample-project.js'

const roots: string[] = []
const repositories: SqliteMetadataRepository[] = []
const now = '2026-08-03T13:00:00.000Z'

afterEach(() => {
  for (const repository of repositories.splice(0)) repository.close()
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

function richRepository(dbPath: string, projectRoot: string): { repository: SqliteMetadataRepository; projectId: ProjectId } {
  const repository = new SqliteMetadataRepository(dbPath)
  repositories.push(repository)
  const snapshot = createMvpSampleSnapshot(projectRoot, now)
  repository.save(snapshot)
  const projectId = snapshot.project.id
  const workspaceId = snapshot.workspaces[0]!.id as WorkspaceId
  const viewId = snapshot.artifactViews[0]!.id as ArtifactViewId
  repository.addWorkspaceMembers(workspaceId, [viewId], 'user', now)

  const canonicalJson = JSON.stringify({ schemaVersion: 0, project: { id: String(projectId) }, lockedElements: [] })
  const manifestHash = createHash('sha256').update(canonicalJson).digest('hex')
  repository.createContextManifest({
    id: 'manifest-lcos' as PersistedContextManifestV0['id'],
    projectId,
    schemaVersion: 0,
    canonicalJson,
    manifestHash,
    createdAt: now,
  })
  const run: Run = {
    id: 'run-lcos-one' as Run['id'],
    projectId,
    workspaceId,
    contextManifestId: 'manifest-lcos' as PersistedContextManifestV0['id'],
    provider: 'workbuddy',
    requestedProvider: 'workbuddy',
    outputIntent: 'analyze',
    returnGroupId: 'return-group-lcos',
    status: 'completed',
    instruction: '分析脚本。',
    createdAt: now,
    updatedAt: now,
  }
  repository.createRunWithDispatch(run, {
    id: 'dispatch-lcos' as RuntimeDispatch['id'],
    runId: run.id,
    provider: 'workbuddy',
    idempotencyKey: String(run.id),
    status: 'bound',
    attemptCount: 1,
    createdAt: now,
    updatedAt: now,
  })
  repository.createRunEvent({
    id: 'event-lcos' as Run['id'],
    runId: run.id,
    type: 'run.completed',
    payload: { projectId: String(projectId) },
    occurredAt: now,
  })
  repository.createSessionSummary({
    id: 'session-lcos',
    projectId,
    title: '收口',
    summary: '方向已定',
    runIds: [run.id],
    createdAt: now,
    updatedAt: now,
  })
  return { repository, projectId }
}

describe('LcosprojService (P1: export/open/rebind)', () => {
  it('exports full project truth and re-imports it losslessly', async () => {
    const sourceDb = mkdtempSync(join(tmpdir(), 'lcos-lcosproj-src-'))
    const projectRoot = mkdtempSync(join(tmpdir(), 'lcos-lcosproj-root-'))
    const targetDir = mkdtempSync(join(tmpdir(), 'lcos-lcosproj-out-'))
    roots.push(sourceDb, projectRoot, targetDir)
    const { repository, projectId } = richRepository(join(sourceDb, 'source.sqlite'), projectRoot)
    const targetFile = join(targetDir, '项目.lcosproj')

    const exported = await new LcosprojService(repository).exportProject(projectId, targetFile)
    expect(existsSync(targetFile)).toBe(true)
    expect(exported.projectId).toBe(String(projectId))
    expect(exported.tables.artifacts).toBe(4)
    expect(exported.tables.runs).toBe(1)

    const inspected = new LcosprojService(repository).inspect(targetFile)
    expect(inspected.projectId).toBe(String(projectId))
    expect(inspected.schemaVersion).toBe(12)

    const targetDb = mkdtempSync(join(tmpdir(), 'lcos-lcosproj-import-'))
    roots.push(targetDb)
    const importedRepository = new SqliteMetadataRepository(join(targetDb, 'imported.sqlite'))
    repositories.push(importedRepository)
    const opened = await new LcosprojService(importedRepository).open(targetFile)
    expect(opened.project.id).toBe(String(projectId))
    expect(opened.tables.artifacts).toBe(4)
    expect(importedRepository.getProjectRuns(projectId)).toHaveLength(1)
    expect(importedRepository.getRunEvents('run-lcos-one' as Run['id'])).toHaveLength(1)
    expect(importedRepository.listProjectWorkspaceMemberships(projectId)).toHaveLength(1)
    expect(importedRepository.listSessionSummaries(projectId)).toHaveLength(1)
  })

  it('rebinds relative locators after the project directory moves, with hash verification', async () => {
    const sourceDb = mkdtempSync(join(tmpdir(), 'lcos-lcosproj-src2-'))
    const projectRoot = mkdtempSync(join(tmpdir(), 'lcos-lcosproj-root2-'))
    const targetDir = mkdtempSync(join(tmpdir(), 'lcos-lcosproj-out2-'))
    roots.push(sourceDb, projectRoot, targetDir)
    const { repository, projectId } = richRepository(join(sourceDb, 'source.sqlite'), projectRoot)
    const targetFile = join(targetDir, '项目.lcosproj')
    await new LcosprojService(repository).exportProject(projectId, targetFile)

    const movedRoot = `${projectRoot}-moved`
    renameSync(projectRoot, movedRoot)
    roots.push(movedRoot)
    const originalRecord = repository.getFileRecords(String(projectId))[0]!
    const movedFile = originalRecord.observedPath.replace(projectRoot, movedRoot)
    writeFileSync(`${movedFile}.extra`, 'x', 'utf8')

    const targetDb = mkdtempSync(join(tmpdir(), 'lcos-lcosproj-import2-'))
    roots.push(targetDb)
    const importedRepository = new SqliteMetadataRepository(join(targetDb, 'imported.sqlite'))
    repositories.push(importedRepository)
    const opened = await new LcosprojService(importedRepository).open(targetFile, movedRoot)
    expect(opened.rebound).toBeDefined()
    expect(opened.rebound!.fileRecords).toBeGreaterThan(0)
    expect(opened.rebound!.current).toBeGreaterThan(0)
    expect(opened.rebound!.missing).toBe(0)
    const reboundRecord = importedRepository.getFileRecord(String(originalRecord.id))
    expect(reboundRecord?.observedPath.startsWith(movedRoot)).toBe(true)
    expect(reboundRecord?.availability).toBe('current')
  })

  it('marks missing files after rebind when they were deleted', async () => {
    const sourceDb = mkdtempSync(join(tmpdir(), 'lcos-lcosproj-src3-'))
    const projectRoot = mkdtempSync(join(tmpdir(), 'lcos-lcosproj-root3-'))
    const targetDir = mkdtempSync(join(tmpdir(), 'lcos-lcosproj-out3-'))
    roots.push(sourceDb, projectRoot, targetDir)
    const { repository, projectId } = richRepository(join(sourceDb, 'source.sqlite'), projectRoot)
    const targetFile = join(targetDir, '项目.lcosproj')
    await new LcosprojService(repository).exportProject(projectId, targetFile)
    const movedRoot = `${projectRoot}-moved`
    renameSync(projectRoot, movedRoot)
    roots.push(movedRoot)
    const originalRecord = repository.getFileRecords(String(projectId))[0]!
    const movedFile = originalRecord.observedPath.replace(projectRoot, movedRoot)
    rmSync(movedFile, { force: true })

    const targetDb = mkdtempSync(join(tmpdir(), 'lcos-lcosproj-import3-'))
    roots.push(targetDb)
    const importedRepository = new SqliteMetadataRepository(join(targetDb, 'imported.sqlite'))
    repositories.push(importedRepository)
    const opened = await new LcosprojService(importedRepository).open(targetFile, movedRoot)
    expect(opened.rebound!.missing).toBeGreaterThan(0)
    expect(importedRepository.getFileRecord(String(originalRecord.id))?.availability).toBe('missing')
  })
})
