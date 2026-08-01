import { createHash } from 'node:crypto'
import { mkdir, rename, rm, stat, writeFile } from 'node:fs/promises'
import { basename, extname, join, relative, resolve } from 'node:path'

import type { Artifact, ArtifactRevision, ArtifactView, FileRecord, ProjectId, ScopeId } from '@local-creative-os/domain'

import { SqliteMetadataRepository } from './metadata-repository.js'

const MAX_IMPORT_BYTES = 25 * 1024 * 1024
const SUPPORTED_EXTENSIONS = new Set(['.md', '.txt', '.json', '.yaml', '.yml', '.png', '.jpg', '.jpeg', '.webp'])

export interface ImportCopyInput {
  readonly importRequestId: string
  readonly fileName: string
  readonly contentType: string
  readonly bytes: Buffer
  readonly scopeId: string
  readonly position: { readonly x: number; readonly y: number }
}

export interface ImportCopyResult {
  readonly fileRecord: FileRecord
  readonly artifact: Artifact
  readonly revision: ArtifactRevision
  readonly view: ArtifactView
  readonly reused: boolean
}

export class ImportCopyConflictError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ImportCopyConflictError'
  }
}

function cleanIdPart(value: string): string {
  const cleaned = value.trim().toLocaleLowerCase('en-US').replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '')
  if (cleaned.length === 0) throw new Error('importRequestId is required.')
  return cleaned.slice(0, 80)
}

function safeFileName(value: string): string {
  const base = basename(value).replace(/[<>:"/\\|?*\u0000-\u001f]+/g, '_').trim()
  return base.length === 0 ? 'imported-file' : base.slice(0, 120)
}

function mimeTypeFor(extension: string, provided: string): string {
  if (extension === '.md') return 'text/markdown'
  if (extension === '.txt') return 'text/plain'
  if (extension === '.json') return 'application/json'
  if (extension === '.yaml' || extension === '.yml') return 'application/yaml'
  if (extension === '.png') return 'image/png'
  if (extension === '.jpg' || extension === '.jpeg') return 'image/jpeg'
  if (extension === '.webp') return 'image/webp'
  return provided || 'application/octet-stream'
}

function artifactKindFor(extension: string): Artifact['kind'] {
  if (extension === '.md' || extension === '.txt') return 'markdown'
  if (extension === '.json' || extension === '.yaml' || extension === '.yml') return 'other'
  if (['.png', '.jpg', '.jpeg', '.webp'].includes(extension)) return 'image'
  return 'other'
}

function hashBytes(bytes: Buffer): FileRecord['observedHash'] {
  return createHash('sha256').update(bytes).digest('hex') as FileRecord['observedHash']
}

function importIdentity(projectId: ProjectId, requestId: string): string {
  return createHash('sha256').update(String(projectId)).update('\0').update(requestId).digest('hex').slice(0, 24)
}

function isInsideDirectory(root: string, candidate: string): boolean {
  const fromRoot = relative(root, candidate)
  return fromRoot === '' || (!fromRoot.startsWith('..') && !fromRoot.match(/^[a-z]:/i))
}

export class ImportCopyService {
  constructor(readonly repository: SqliteMetadataRepository) {}

  async importCopy(projectId: ProjectId, input: ImportCopyInput): Promise<ImportCopyResult> {
    const project = this.repository.getProject(String(projectId))
    if (project === undefined) throw new Error('Project not found.')
    if (input.bytes.byteLength === 0) throw new Error('Imported file is empty.')
    if (input.bytes.byteLength > MAX_IMPORT_BYTES) throw new Error('Imported file exceeds the 25 MiB MVP limit.')
    const requestId = cleanIdPart(input.importRequestId)
    const extension = extname(input.fileName).toLocaleLowerCase('en-US')
    if (!SUPPORTED_EXTENSIONS.has(extension)) throw new Error(`Unsupported import type: ${extension || 'unknown'}.`)
    const identity = importIdentity(projectId, requestId)
    const observedHash = hashBytes(input.bytes)
    const importedTitle = safeFileName(input.fileName)

    const ids = {
      fileRecordId: `import-file-${identity}` as FileRecord['id'],
      artifactId: `import-artifact-${identity}` as Artifact['id'],
      revisionId: `import-revision-${identity}` as ArtifactRevision['id'],
      viewId: `import-view-${identity}` as ArtifactView['id'],
    }
    const existingView = this.repository.getArtifactView(String(ids.viewId))
    const existingArtifact = this.repository.getArtifact(String(ids.artifactId))
    const existingRevision = this.repository.getArtifactRevision(String(ids.revisionId))
    const existingFileRecord = this.repository.getFileRecord(String(ids.fileRecordId))
    if (existingView !== undefined && existingArtifact !== undefined && existingRevision !== undefined && existingFileRecord !== undefined) {
      const compatibleReplay = String(existingArtifact.projectId) === String(projectId)
        && String(existingFileRecord.projectId) === String(projectId)
        && existingArtifact.title === importedTitle
        && String(existingRevision.contentHash) === String(observedHash)
        && String(existingView.scopeId) === String(input.scopeId)
      if (!compatibleReplay) {
        throw new ImportCopyConflictError('importRequestId was already used with different import content or placement.')
      }
      return {
        fileRecord: existingFileRecord,
        artifact: existingArtifact,
        revision: existingRevision,
        view: existingView,
        reused: true,
      }
    }

    const importsRoot = resolve(project.rootPath, 'imports')
    await mkdir(importsRoot, { recursive: true })
    const finalName = `${requestId}-${safeFileName(input.fileName)}`
    const finalPath = resolve(join(importsRoot, finalName))
    if (!isInsideDirectory(importsRoot, finalPath)) throw new Error('Import destination escaped project imports directory.')
    const tempPath = `${finalPath}.tmp`
    let published = false
    try {
      await writeFile(tempPath, input.bytes, { flag: 'w' })
      await rename(tempPath, finalPath)
      published = true
    } catch (error: unknown) {
      await rm(tempPath, { force: true })
      throw error
    }
    const fileStat = await stat(finalPath)
    const now = new Date().toISOString()
    const fileRecord: FileRecord = {
      id: ids.fileRecordId,
      projectId,
      observedPath: finalPath,
      observedHash,
      size: fileStat.size,
      modifiedAt: fileStat.mtime.toISOString(),
      mimeType: mimeTypeFor(extension, input.contentType),
      availability: 'current',
      observedAt: now,
    }
    const artifact: Artifact = {
      id: ids.artifactId,
      projectId,
      title: importedTitle,
      kind: artifactKindFor(extension),
      availability: 'available',
      currentRevisionId: ids.revisionId,
      createdAt: now,
      updatedAt: now,
    }
    const revision: ArtifactRevision = {
      id: ids.revisionId,
      artifactId: ids.artifactId,
      fileRecordId: ids.fileRecordId,
      contentHash: observedHash,
      source: 'import',
      status: 'current',
      createdAt: now,
    }
    const view: ArtifactView = {
      id: ids.viewId,
      artifactId: ids.artifactId,
      scopeId: input.scopeId as ScopeId,
      revisionId: ids.revisionId,
      referenceKind: 'primary',
      position: input.position,
      size: artifact.kind === 'image' ? { width: 220, height: 320 } : { width: 220, height: 150 },
      displayMode: artifact.kind === 'image' ? 'thumbnail' : 'card',
      collapsed: false,
    }

    try {
      this.repository.registerImportedSource(fileRecord, artifact, revision, view)
    } catch (error: unknown) {
      if (published) await rm(finalPath, { force: true })
      await rm(tempPath, { force: true })
      throw error
    }
    return { fileRecord, artifact, revision, view, reused: false }
  }
}
