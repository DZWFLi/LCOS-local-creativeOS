import { createHash, randomUUID } from 'node:crypto'
import { mkdir, stat, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'

import type {
  Artifact,
  ArtifactRevision,
  ArtifactView,
  ContentHash,
  FileRecord,
  ProjectId,
  ScopeId,
  WorkspaceId,
} from '@local-creative-os/domain'

import type { SqliteMetadataRepository } from './metadata-repository.js'

export interface CreateTextArtifactInput {
  readonly title?: string
  readonly body: string
  readonly scopeId: string
  readonly workspaceId?: string
  readonly x?: number
  readonly y?: number
}

export interface CreateTextArtifactResult {
  readonly artifactId: string
  readonly revisionId: string
  readonly viewId: string
  readonly fileRecordId: string
  readonly title: string
}

/**
 * DZ-RUN-16：文本归一为轻量 Text Artifact（受管 Markdown，带 Revision），
 * 可自然进入 Context / 被 revise，不再是无身份的本地 Note 节点。
 */
export async function createTextArtifact(
  repository: SqliteMetadataRepository,
  projectId: ProjectId,
  input: CreateTextArtifactInput,
): Promise<CreateTextArtifactResult> {
  const project = repository.getProject(String(projectId))
  if (project === undefined) throw new Error('Project not found.')
  const now = new Date().toISOString()
  const id = `text-${randomUUID()}`
  const title = input.title?.trim() || input.body.split(/\r?\n/)[0]?.trim().slice(0, 80) || '文本'
  const notesDir = resolve(project.rootPath, '.creative-os', 'notes')
  await mkdir(notesDir, { recursive: true })
  const filePath = join(notesDir, `${id}.md`)
  await writeFile(filePath, input.body, 'utf8')
  const info = await stat(filePath)
  const contentHash = createHash('sha256').update(input.body, 'utf8').digest('hex') as ContentHash

  const fileRecord: FileRecord = {
    id: `file-${id}` as FileRecord['id'],
    projectId,
    observedPath: filePath,
    observedHash: contentHash,
    size: info.size,
    modifiedAt: info.mtime.toISOString(),
    mimeType: 'text/markdown',
    availability: 'current',
    observedAt: now,
  }
  const revisionId = `revision-${id}` as ArtifactRevision['id']
  const artifactId = `artifact-${id}` as Artifact['id']
  const artifact: Artifact = {
    id: artifactId,
    projectId,
    title,
    kind: 'markdown',
    managed: true,
    availability: 'available',
    currentRevisionId: revisionId,
    createdAt: now,
    updatedAt: now,
  }
  const revision: ArtifactRevision = {
    id: revisionId,
    artifactId,
    fileRecordId: fileRecord.id,
    contentHash,
    source: 'import',
    status: 'current',
    createdAt: now,
  }
  repository.registerSource(fileRecord, artifact, revision)

  const viewId = `view-${id}` as ArtifactView['id']
  const view: ArtifactView = {
    id: viewId,
    artifactId,
    scopeId: input.scopeId as ScopeId,
    revisionId,
    referenceKind: 'primary',
    position: { x: input.x ?? 120, y: input.y ?? 120 },
    size: { width: 260, height: 170 },
    displayMode: 'card',
    collapsed: false,
  }
  repository.upsertArtifactView(view)
  if (input.workspaceId !== undefined) {
    repository.addWorkspaceMembers(input.workspaceId as WorkspaceId, [viewId], 'user', now)
  }
  return {
    artifactId: String(artifactId),
    revisionId: String(revisionId),
    viewId: String(viewId),
    fileRecordId: String(fileRecord.id),
    title,
  }
}
