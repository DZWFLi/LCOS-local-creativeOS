import { createHash } from 'node:crypto'
import { mkdtempSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'

import { afterEach, describe, expect, it } from 'vitest'

import type {
  ArtifactReturn,
  Run,
  RuntimeBinding,
  RuntimeDispatch,
} from '@local-creative-os/domain'
import type { PersistedContextManifestV0 } from '@local-creative-os/contracts'

import { SqliteMetadataRepository } from '../src/metadata-repository.js'
import { createMvpSampleSnapshot } from '../src/mvp-sample-project.js'

const temporaryDirectories: string[] = []
const repositories: SqliteMetadataRepository[] = []
const now = '2026-07-29T06:00:00.000Z'

afterEach(() => {
  for (const repository of repositories.splice(0)) repository.close()
  for (const directory of temporaryDirectories.splice(0)) rmSync(directory, { recursive: true, force: true })
})

function createRepository() {
  const root = mkdtempSync(join(tmpdir(), 'lcos-runtime-v6-'))
  const projectRoot = mkdtempSync(join(tmpdir(), 'lcos-runtime-project-'))
  temporaryDirectories.push(root, projectRoot)
  const path = join(root, 'metadata.sqlite')
  const repository = new SqliteMetadataRepository(path)
  repositories.push(repository)
  const snapshot = createMvpSampleSnapshot(projectRoot, now)
  repository.save(snapshot)
  return { path, projectRoot, repository, snapshot }
}

function manifestFor(snapshot: ReturnType<typeof createMvpSampleSnapshot>): PersistedContextManifestV0 {
  const canonicalJson = JSON.stringify({
    schemaVersion: 0,
    project: { id: snapshot.project.id, name: snapshot.project.name },
    target: {
      artifactId: snapshot.artifacts[1]?.id,
      revisionId: snapshot.artifactRevisions[1]?.id,
    },
    instruction: 'Revise the Markdown script.',
    acceptanceCriteria: ['Create a new Markdown file.'],
  })
  const manifestHash = createHash('sha256').update(canonicalJson, 'utf8').digest('hex')
  return {
    id: `manifest-${manifestHash}` as PersistedContextManifestV0['id'],
    projectId: snapshot.project.id,
    schemaVersion: 0,
    targetArtifactId: snapshot.artifacts[1]!.id,
    targetRevisionId: snapshot.artifactRevisions[1]!.id,
    canonicalJson,
    manifestHash,
    createdAt: now,
  }
}

function runFor(
  snapshot: ReturnType<typeof createMvpSampleSnapshot>,
  manifest: PersistedContextManifestV0,
  id = 'run-a',
  retryOfRunId?: Run['retryOfRunId'],
): Run {
  return {
    id: id as Run['id'],
    projectId: snapshot.project.id,
    workspaceId: snapshot.workspaces[0]!.id,
    targetArtifactId: snapshot.artifacts[1]!.id,
    targetRevisionId: snapshot.artifactRevisions[1]!.id,
    contextManifestId: manifest.id,
    ...(retryOfRunId === undefined ? {} : { retryOfRunId }),
    provider: 'workbuddy',
    requestedProvider: 'workbuddy',
    outputIntent: 'revise',
    returnGroupId: `return-group-${id}`,
    status: 'created',
    instruction: 'Revise the Markdown script.',
    createdAt: now,
    updatedAt: now,
  }
}

function dispatchFor(run: Run, id = `dispatch-${String(run.id)}`): RuntimeDispatch {
  return {
    id: id as RuntimeDispatch['id'],
    runId: run.id,
    provider: 'workbuddy',
    idempotencyKey: String(run.id),
    status: 'planned',
    attemptCount: 0,
    createdAt: now,
    updatedAt: now,
  }
}

describe('Runtime Schema v6', () => {
  it('creates all five canonical runtime tables in a fresh database', () => {
    const { path, repository } = createRepository()
    expect(repository.schemaVersion).toBe(14)
    repository.close()
    repositories.splice(repositories.indexOf(repository), 1)
    const database = new DatabaseSync(path)
    const version = database.prepare('PRAGMA user_version').get() as { user_version: number }
    const tables = (database.prepare(`
      SELECT name FROM sqlite_master
      WHERE type = 'table'
      AND name IN ('context_manifests','runs','runtime_dispatches','runtime_bindings','artifact_returns')
      ORDER BY name
    `).all() as Array<{ name: string }>).map((row) => row.name)
    database.close()
    expect(version.user_version).toBe(14)
    expect(tables).toEqual([
      'artifact_returns',
      'context_manifests',
      'runs',
      'runtime_bindings',
      'runtime_dispatches',
    ])
  })

  it('upgrades v5 to v6, preserves data, and creates a backup', () => {
    const root = mkdtempSync(join(tmpdir(), 'lcos-runtime-v5-'))
    temporaryDirectories.push(root)
    const path = join(root, 'metadata.sqlite')
    const legacy = new DatabaseSync(path)
    legacy.exec(`
      CREATE TABLE projects (
        id TEXT PRIMARY KEY, name TEXT NOT NULL, root_path TEXT NOT NULL,
        graph_version INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
      INSERT INTO projects VALUES ('project-v5', 'V5', 'disposable://v5', 1, '${now}', '${now}');
      PRAGMA user_version = 5;
    `)
    legacy.close()

    const migrated = new SqliteMetadataRepository(path)
    repositories.push(migrated)
    expect(migrated.schemaVersion).toBe(14)
    expect(migrated.getProject('project-v5')?.name).toBe('V5')
    expect(statSync(`${path}.v5.bak`).size).toBeGreaterThan(0)
  })

  it('persists and restores Manifest, Run, Dispatch, Binding, and Return', () => {
    const { path, projectRoot, repository, snapshot } = createRepository()
    const manifest = repository.createContextManifest(manifestFor(snapshot))
    const run = runFor(snapshot, manifest)
    const dispatch = dispatchFor(run)
    repository.createRunWithDispatch(run, dispatch)
    const binding: RuntimeBinding = {
      id: 'binding-a' as RuntimeBinding['id'],
      runId: run.id,
      provider: 'workbuddy',
      externalTaskId: 'task-a',
      externalSessionId: 'session-a',
      providerStatus: 'review',
      lastSyncedAt: now,
      finalizePending: false,
      createdAt: now,
      updatedAt: now,
    }
    repository.createRuntimeBinding(binding)
    const artifactReturn: ArtifactReturn = {
      id: 'return-a' as ArtifactReturn['id'],
      runId: run.id,
      targetArtifactId: run.targetArtifactId,
      baseRevisionId: run.targetRevisionId,
      returnedFileId: snapshot.fileRecords[1]!.id,
      contentHash: snapshot.fileRecords[1]!.observedHash,
      canonicalPath: join(projectRoot, 'outputs', 'script-draft-run-a.md'),
      action: 'created',
      status: 'pending_review',
      createdAt: now,
      updatedAt: now,
    }
    repository.createArtifactReturn(artifactReturn)
    repository.close()
    repositories.splice(repositories.indexOf(repository), 1)

    const recovered = new SqliteMetadataRepository(path)
    repositories.push(recovered)
    expect(recovered.getContextManifest(manifest.id)).toEqual(manifest)
    expect(recovered.getRun(run.id)).toEqual(run)
    expect(recovered.getRuntimeDispatch(run.id)).toEqual(dispatch)
    expect(recovered.getRuntimeBinding(run.id)).toEqual(binding)
    expect(recovered.getArtifactReturn(artifactReturn.id)).toEqual(artifactReturn)
  })

  it('enforces ContextManifest immutability and rejects unsafe canonical content', () => {
    const { repository, snapshot } = createRepository()
    const manifest = repository.createContextManifest(manifestFor(snapshot))
    expect(repository.createContextManifest({ ...manifest, createdAt: 'later' })).toEqual(manifest)
    expect(() => repository.createContextManifest({
      ...manifest,
      canonicalJson: JSON.stringify({ absolutePath: 'C:\\secret\\file.md' }),
    })).toThrow('hash does not match')
    const unsafeJson = JSON.stringify({ provider: 'workbuddy' })
    expect(() => repository.createContextManifest({
      ...manifest,
      id: 'unsafe-manifest' as PersistedContextManifestV0['id'],
      canonicalJson: unsafeJson,
      manifestHash: createHash('sha256').update(unsafeJson).digest('hex'),
    })).toThrow('cannot contain provider')
  })

  it('enforces foreign keys and retryOfRunId self-reference', () => {
    const { repository, snapshot } = createRepository()
    const manifest = repository.createContextManifest(manifestFor(snapshot))
    const missingParent = runFor(snapshot, manifest, 'run-missing-parent', 'missing-run' as Run['id'])
    expect(() => repository.createRunWithDispatch(missingParent, dispatchFor(missingParent))).toThrow()
    expect(repository.getRun(missingParent.id)).toBeUndefined()
    expect(repository.getRuntimeDispatch(missingParent.id)).toBeUndefined()

    const runA = runFor(snapshot, manifest, 'run-a')
    repository.createRunWithDispatch(runA, dispatchFor(runA))
    const runB = runFor(snapshot, manifest, 'run-b', runA.id)
    repository.createRunWithDispatch(runB, dispatchFor(runB))
    expect(repository.getRun(runB.id)?.retryOfRunId).toBe(runA.id)
  })

  it('rejects Provider statuses in canonical Run and keeps providerStatus in Binding', () => {
    const { path, repository, snapshot } = createRepository()
    const manifest = repository.createContextManifest(manifestFor(snapshot))
    const invalidRun = { ...runFor(snapshot, manifest), status: 'review' } as unknown as Run
    expect(() => repository.createRunWithDispatch(invalidRun, dispatchFor(invalidRun))).toThrow()

    const run = runFor(snapshot, manifest, 'run-valid')
    repository.createRunWithDispatch(run, dispatchFor(run))
    repository.createRuntimeBinding({
      id: 'binding-review' as RuntimeBinding['id'],
      runId: run.id,
      provider: 'workbuddy',
      externalTaskId: 'task-review',
      providerStatus: 'review',
      finalizePending: false,
      createdAt: now,
      updatedAt: now,
    })
    expect(repository.getRun(run.id)?.status).toBe('created')
    expect(repository.getRuntimeBinding(run.id)?.providerStatus).toBe('review')

    repository.close()
    repositories.splice(repositories.indexOf(repository), 1)
    const database = new DatabaseSync(path)
    const runColumns = (database.prepare('PRAGMA table_info(runs)').all() as Array<{ name: string }>).map((row) => row.name)
    database.close()
    expect(runColumns).not.toContain('provider_status')
  })

  it('enforces Dispatch, Binding, and ArtifactReturn unique identities', () => {
    const { path, projectRoot, repository, snapshot } = createRepository()
    const manifest = repository.createContextManifest(manifestFor(snapshot))
    const runA = runFor(snapshot, manifest, 'run-a')
    const runB = runFor(snapshot, manifest, 'run-b')
    repository.createRunWithDispatch(runA, dispatchFor(runA))
    repository.createRunWithDispatch(runB, dispatchFor(runB))
    repository.createRuntimeBinding({
      id: 'binding-a' as RuntimeBinding['id'],
      runId: runA.id,
      provider: 'workbuddy',
      externalTaskId: 'task-shared',
      finalizePending: false,
      createdAt: now,
      updatedAt: now,
    })
    expect(() => repository.createRuntimeBinding({
      id: 'binding-b' as RuntimeBinding['id'],
      runId: runB.id,
      provider: 'workbuddy',
      externalTaskId: 'task-shared',
      finalizePending: false,
      createdAt: now,
      updatedAt: now,
    })).toThrow()

    const returned: ArtifactReturn = {
      id: 'return-a' as ArtifactReturn['id'],
      runId: runA.id,
      targetArtifactId: runA.targetArtifactId,
      baseRevisionId: runA.targetRevisionId,
      returnedFileId: snapshot.fileRecords[1]!.id,
      contentHash: snapshot.fileRecords[1]!.observedHash,
      canonicalPath: join(projectRoot, 'outputs', 'draft.md'),
      action: 'created',
      status: 'pending_review',
      createdAt: now,
      updatedAt: now,
    }
    repository.createArtifactReturn(returned)
    expect(() => repository.createArtifactReturn({
      ...returned,
      id: 'return-b' as ArtifactReturn['id'],
    })).toThrow()

    repository.close()
    repositories.splice(repositories.indexOf(repository), 1)
    const database = new DatabaseSync(path)
    expect(() => database.prepare(`
      INSERT INTO runtime_dispatches (
        id, run_id, provider, idempotency_key, status, attempt_count, created_at, updated_at
      ) VALUES ('dispatch-duplicate', 'run-b', 'workbuddy', 'run-a', 'planned', 0, ?, ?)
    `).run(now, now)).toThrow()
    database.close()
  })
})
