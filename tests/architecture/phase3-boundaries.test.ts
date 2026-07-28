import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { extname, join, relative, resolve } from 'node:path'

import type { GraphVersion, ProjectGraphSnapshot } from '@local-creative-os/contracts'
import { afterEach, describe, expect, it } from 'vitest'

import { SqliteMetadataRepository } from '../../apps/local-core/src/metadata-repository'
import { FileObservationService } from '../../apps/local-core/src/file-observation-service'
import { FileRegistryService, TrustedFileSelectionRegistry } from '../../apps/local-core/src/file-registry-service'
import { PreviewCacheService } from '../../apps/local-core/src/preview-cache-service'
import { PreviewWorkerService } from '../../apps/local-core/src/preview-worker-service'
import { RendererRegistry } from '../../apps/local-core/src/renderer-registry'

const REPOSITORY_ROOT = resolve(import.meta.dirname, '../..')
const temporaryDirectories: string[] = []

function sourceFiles(root: string): string[] {
  if (!statSync(root).isDirectory()) return []
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = join(root, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'dist' || entry.name === 'node_modules' || entry.name === 'tests') return []
      return sourceFiles(path)
    }
    return ['.ts', '.tsx', '.js', '.mjs'].includes(extname(entry.name)) ? [path] : []
  })
}

function productionSources(...roots: string[]): Array<{ path: string; text: string }> {
  return roots.flatMap((root) => sourceFiles(resolve(REPOSITORY_ROOT, root)))
    .map((path) => ({ path: relative(REPOSITORY_ROOT, path), text: readFileSync(path, 'utf8') }))
}

function projectSnapshot(): ProjectGraphSnapshot {
  const now = '2026-07-26T00:00:00.000Z'
  const projectId = 'disposable-arch-p3' as ProjectGraphSnapshot['project']['id']
  const scopeId = 'scope-root' as ProjectGraphSnapshot['scopes'][number]['id']
  const artifactId = 'artifact-source' as ProjectGraphSnapshot['artifacts'][number]['id']
  const revisionId = 'revision-initial' as ProjectGraphSnapshot['artifactRevisions'][number]['id']
  const fileRecordId = 'file-source' as ProjectGraphSnapshot['fileRecords'][number]['id']
  return {
    schemaVersion: 5,
    graphVersion: 1 as GraphVersion,
    project: {
      id: projectId,
      name: 'Architecture Fixture',
      rootPath: 'disposable://arch-p3',
      graphVersion: 1 as GraphVersion,
      createdAt: now,
      updatedAt: now,
    },
    scopes: [{
      id: scopeId,
      projectId,
      parentScopeId: null,
      containerViewId: null,
      kind: 'root',
      name: 'Root',
      createdAt: now,
      updatedAt: now,
    }],
    workspaces: [],
    artifacts: [{
      id: artifactId,
      projectId,
      title: 'Source',
      kind: 'markdown',
      availability: 'available',
      currentRevisionId: revisionId,
      createdAt: now,
      updatedAt: now,
    }],
    artifactViews: [{
      id: 'view-source' as ProjectGraphSnapshot['artifactViews'][number]['id'],
      artifactId,
      scopeId,
      revisionId,
      referenceKind: 'primary',
      position: { x: 0, y: 0 },
      size: { width: 200, height: 140 },
      displayMode: 'card',
      collapsed: false,
    }],
    relations: [],
    notes: [],
    fileRecords: [{
      id: fileRecordId,
      projectId,
      observedPath: 'disposable://source',
      observedHash: 'frozen-hash' as ProjectGraphSnapshot['fileRecords'][number]['observedHash'],
      size: 1,
      modifiedAt: now,
      mimeType: 'text/markdown',
      availability: 'current',
      observedAt: now,
    }],
    artifactRevisions: [{
      id: revisionId,
      artifactId,
      fileRecordId,
      contentHash: 'frozen-hash' as ProjectGraphSnapshot['artifactRevisions'][number]['contentHash'],
      source: 'import',
      status: 'current',
      createdAt: now,
    }],
    checkpoints: [],
  }
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true })
  }
})

describe('Phase 3 architecture boundaries', () => {
  it('ARCH-P3-001 FileRecord is a distinct entity from Artifact', () => {
    const snapshot = projectSnapshot()
    expect(snapshot.artifacts[0]).not.toHaveProperty('observedPath')
    expect(snapshot.fileRecords[0]).not.toHaveProperty('currentRevisionId')
    expect(snapshot.artifactRevisions[0]?.fileRecordId).toBe(snapshot.fileRecords[0]?.id)
  })

  it('ARCH-P3-002 deleting ArtifactView preserves Artifact and Revision', () => {
    const directory = mkdtempSync(join(tmpdir(), 'arch-p3-'))
    temporaryDirectories.push(directory)
    const repository = new SqliteMetadataRepository(join(directory, 'metadata.sqlite'))
    repository.save(projectSnapshot())

    repository.deleteArtifactView('view-source')
    const restored = repository.get('disposable-arch-p3')
    repository.close()

    expect(restored?.artifactViews).toHaveLength(0)
    expect(restored?.artifacts.map((artifact) => artifact.id)).toEqual(['artifact-source'])
    expect(restored?.artifactRevisions.map((revision) => revision.id)).toEqual(['revision-initial'])
    expect(restored?.fileRecords.map((fileRecord) => fileRecord.id)).toEqual(['file-source'])
  })

  it('ARCH-P3-003 source registration creates an Initial Revision', () => {
    const snapshot = projectSnapshot()
    const artifact = snapshot.artifacts[0]
    const revision = snapshot.artifactRevisions[0]
    expect(artifact?.currentRevisionId).toBe(revision?.id)
    expect(revision?.source).toBe('import')
    expect(revision?.status).toBe('current')
    expect(revision?.fileRecordId).toBe(snapshot.fileRecords[0]?.id)
  })
  it('ARCH-P3-004 deleting Preview cache preserves Project Truth', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'arch-p3-preview-'))
    temporaryDirectories.push(directory)
    const sourcePath = join(directory, 'source.md')
    writeFileSync(sourcePath, '# source\n', 'utf8')
    const repository = new SqliteMetadataRepository(join(directory, 'metadata.sqlite'), { disposableOnly: true })
    const snapshot = projectSnapshot()
    repository.save({
      ...snapshot,
      project: { ...snapshot.project, rootPath: directory },
      artifacts: [],
      artifactViews: [],
      artifactRevisions: [],
      fileRecords: [],
    })
    const selections = new TrustedFileSelectionRegistry()
    const registered = await new FileRegistryService(repository, selections).registerSource(
      snapshot.project.id,
      { selectionId: selections.registerTrustedPath(sourcePath).id },
    )
    const before = repository.get(String(snapshot.project.id))
    const preview = await new PreviewCacheService(repository, { cacheRoot: join(directory, 'cache') })
      .publishReadyPreview(registered.revision.id, 'thumbnail', Buffer.from('preview'))

    await new PreviewCacheService(repository, { cacheRoot: join(directory, 'cache') }).deleteCacheFile(preview)
    repository.deletePreviewRecords(String(snapshot.project.id))
    const after = repository.get(String(snapshot.project.id))
    repository.close()

    expect(existsSync(preview.cachePath)).toBe(false)
    expect(after).toEqual(before)
  })

  it('ARCH-P3-005 browser production clients expose no arbitrary-path register/preview API', () => {
    const browserRuntime = productionSources('apps/web/src/runtime')
    const forbidden = browserRuntime.filter(({ text }) =>
      /\/preview\?path\b/i.test(text)
      || /\/register(?:-file|\/file)?[^'"\n]*\bpath\b/i.test(text)
      || /\b(?:registerFile|requestPreview)\s*\(\s*(?:absolutePath|path)\b/.test(text),
    )
    expect(forbidden.map(({ path }) => path)).toEqual([])
  })

  it('ARCH-P3-006 external observation does not automatically create Revision', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'arch-p3-observation-'))
    temporaryDirectories.push(directory)
    const sourcePath = join(directory, 'source.md')
    writeFileSync(sourcePath, '# original\n', 'utf8')
    const repository = new SqliteMetadataRepository(join(directory, 'metadata.sqlite'), { disposableOnly: true })
    const snapshot = projectSnapshot()
    repository.save({
      ...snapshot,
      project: { ...snapshot.project, rootPath: directory },
      artifacts: [],
      artifactViews: [],
      artifactRevisions: [],
      fileRecords: [],
    })
    const selections = new TrustedFileSelectionRegistry()
    const registered = await new FileRegistryService(repository, selections).registerSource(
      snapshot.project.id,
      { selectionId: selections.registerTrustedPath(sourcePath).id },
    )
    const beforeRevisionIds = repository.getArtifactRevisions(String(registered.artifact.id)).map((revision) => revision.id)
    writeFileSync(sourcePath, '# externally changed\n', 'utf8')

    const result = await new FileObservationService(repository).refresh(registered.fileRecord.id)
    const afterRevisionIds = repository.getArtifactRevisions(String(registered.artifact.id)).map((revision) => revision.id)
    repository.close()

    expect(result.fileRecord.availability).toBe('stale')
    expect(result.revisionCreated).toBe(false)
    expect(afterRevisionIds).toEqual(beforeRevisionIds)
  })
  it('ARCH-P3-007 Preview jobs do not change semanticGraphVersion', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'arch-p3-preview-version-'))
    temporaryDirectories.push(directory)
    const sourcePath = join(directory, 'source.md')
    writeFileSync(sourcePath, '# source\n', 'utf8')
    const repository = new SqliteMetadataRepository(join(directory, 'metadata.sqlite'), { disposableOnly: true })
    const snapshot = projectSnapshot()
    repository.save({ ...snapshot, project: { ...snapshot.project, rootPath: directory }, artifacts: [], artifactViews: [], artifactRevisions: [], fileRecords: [] })
    const selections = new TrustedFileSelectionRegistry()
    const registered = await new FileRegistryService(repository, selections).registerSource(snapshot.project.id, { selectionId: selections.registerTrustedPath(sourcePath).id })
    const beforeGraphVersion = repository.get(String(snapshot.project.id))?.graphVersion

    await new PreviewCacheService(repository, { cacheRoot: join(directory, 'cache') })
      .publishReadyPreview(registered.revision.id, 'thumbnail', Buffer.from('preview'))
    const afterGraphVersion = repository.get(String(snapshot.project.id))?.graphVersion
    repository.close()

    expect(afterGraphVersion).toBe(beforeGraphVersion)
  })
  it('ARCH-P3-008 identical source hash, renderer/version, and profile reuse cache', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'arch-p3-preview-reuse-'))
    temporaryDirectories.push(directory)
    const sourcePath = join(directory, 'source.md')
    writeFileSync(sourcePath, '# source\n', 'utf8')
    const repository = new SqliteMetadataRepository(join(directory, 'metadata.sqlite'), { disposableOnly: true })
    const snapshot = projectSnapshot()
    repository.save({ ...snapshot, project: { ...snapshot.project, rootPath: directory }, artifacts: [], artifactViews: [], artifactRevisions: [], fileRecords: [] })
    const selections = new TrustedFileSelectionRegistry()
    const registered = await new FileRegistryService(repository, selections).registerSource(snapshot.project.id, { selectionId: selections.registerTrustedPath(sourcePath).id })
    const service = new PreviewCacheService(repository, { cacheRoot: join(directory, 'cache') })

    const first = await service.publishReadyPreview(registered.revision.id, 'thumbnail', Buffer.from('one'))
    const second = await service.publishReadyPreview(registered.revision.id, 'thumbnail', Buffer.from('two'))
    repository.close()

    expect(second.cacheKey).toBe(first.cacheKey)
    expect(second.id).toBe(first.id)
  })

  it('ARCH-P3-009 renderer version changes produce a cache miss', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'arch-p3-preview-miss-'))
    temporaryDirectories.push(directory)
    const sourcePath = join(directory, 'source.md')
    writeFileSync(sourcePath, '# source\n', 'utf8')
    const repository = new SqliteMetadataRepository(join(directory, 'metadata.sqlite'), { disposableOnly: true })
    const snapshot = projectSnapshot()
    repository.save({ ...snapshot, project: { ...snapshot.project, rootPath: directory }, artifacts: [], artifactViews: [], artifactRevisions: [], fileRecords: [] })
    const selections = new TrustedFileSelectionRegistry()
    const registered = await new FileRegistryService(repository, selections).registerSource(snapshot.project.id, { selectionId: selections.registerTrustedPath(sourcePath).id })
    const cacheRoot = join(directory, 'cache')
    const first = await new PreviewCacheService(repository, {
      cacheRoot,
      rendererRegistry: new RendererRegistry([{ id: 'markdown', version: '1', supportedMimeTypes: ['text/markdown'], previewProfiles: ['thumbnail'], outputMimeType: 'text/plain' }]),
    }).publishReadyPreview(registered.revision.id, 'thumbnail', Buffer.from('one'))
    const second = await new PreviewCacheService(repository, {
      cacheRoot,
      rendererRegistry: new RendererRegistry([{ id: 'markdown', version: '2', supportedMimeTypes: ['text/markdown'], previewProfiles: ['thumbnail'], outputMimeType: 'text/plain' }]),
    }).publishReadyPreview(registered.revision.id, 'thumbnail', Buffer.from('two'))
    repository.close()

    expect(second.cacheKey).not.toBe(first.cacheKey)
  })
  it('ARCH-P3-010 worker crash or cancellation cannot publish ready PreviewRecord', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'arch-p3-preview-abort-'))
    temporaryDirectories.push(directory)
    const sourcePath = join(directory, 'source.md')
    writeFileSync(sourcePath, '# source\n', 'utf8')
    const repository = new SqliteMetadataRepository(join(directory, 'metadata.sqlite'), { disposableOnly: true })
    const snapshot = projectSnapshot()
    repository.save({ ...snapshot, project: { ...snapshot.project, rootPath: directory }, artifacts: [], artifactViews: [], artifactRevisions: [], fileRecords: [] })
    const selections = new TrustedFileSelectionRegistry()
    const registered = await new FileRegistryService(repository, selections).registerSource(snapshot.project.id, { selectionId: selections.registerTrustedPath(sourcePath).id })
    const controller = new AbortController()
    controller.abort()

    await expect(new PreviewWorkerService(repository, {
      cacheService: new PreviewCacheService(repository, { cacheRoot: join(directory, 'cache') }),
    }).generate({
      projectId: snapshot.project.id,
      revisionId: registered.revision.id,
      previewProfile: 'thumbnail',
      signal: controller.signal,
    })).rejects.toThrow()
    const records = repository.getPreviewRecords(String(snapshot.project.id))
    repository.close()

    expect(records.some((record) => record.status === 'ready')).toBe(false)
  })
  it('ARCH-P3-011 unsupported formats cannot report successful Preview', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'arch-p3-preview-unsupported-'))
    temporaryDirectories.push(directory)
    const sourcePath = join(directory, 'source.bin')
    writeFileSync(sourcePath, 'binary-ish', 'utf8')
    const repository = new SqliteMetadataRepository(join(directory, 'metadata.sqlite'), { disposableOnly: true })
    const snapshot = projectSnapshot()
    repository.save({ ...snapshot, project: { ...snapshot.project, rootPath: directory }, artifacts: [], artifactViews: [], artifactRevisions: [], fileRecords: [] })
    const selections = new TrustedFileSelectionRegistry()
    const registered = await new FileRegistryService(repository, selections).registerSource(snapshot.project.id, { selectionId: selections.registerTrustedPath(sourcePath).id })

    const record = await new PreviewCacheService(repository, { cacheRoot: join(directory, 'cache') })
      .publishReadyPreview(registered.revision.id, 'thumbnail', Buffer.from('ignored'))
    repository.close()

    expect(record.status).toBe('unsupported')
    expect(record.status).not.toBe('ready')
  })

  it('ARCH-P3-012 ReactFlow.toObject is absent from production persistence paths', () => {
    const persistenceSources = productionSources(
      'apps/web/src/runtime',
      'apps/web/src/state',
      'apps/local-core/src',
      'packages/contracts/src',
      'packages/domain/src',
    )
    const offenders = persistenceSources.filter(({ text }) => /\.toObject\s*\(/.test(text))
    expect(offenders.map(({ path }) => path)).toEqual([])
  })

  it('ARCH-P3-013 Domain does not import @xyflow/react', () => {
    const domainSources = productionSources('packages/domain/src')
    const offenders = domainSources.filter(({ text }) =>
      /(?:from\s*|import\s*\()['"]@xyflow\/react['"]/.test(text),
    )
    expect(offenders.map(({ path }) => path)).toEqual([])
  })

  it('ARCH-P3-014 production code does not import research-only source trees', () => {
    const formalSources = productionSources('apps', 'packages', 'scripts')
    const forbiddenImport = /(?:from\s*|import\s*\(|require\s*\()['"][^'"]*(?:research-only|LCOS-open-source-research|OS项目文档)[^'"]*['"]/i
    const offenders = formalSources.filter(({ text }) => forbiddenImport.test(text))
    expect(offenders.map(({ path }) => path)).toEqual([])
  })
})
