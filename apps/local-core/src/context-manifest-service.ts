import { createHash } from 'node:crypto'
import { open } from 'node:fs/promises'

import type {
  BuildContextManifestV0Input,
  ContextManifestArtifactRefV0,
  ContextManifestFeedbackV0,
  ContextManifestOrderedItemV0,
  ContextManifestV0,
  ProjectGraphSnapshot,
} from '@local-creative-os/contracts'
import type {
  Artifact,
  ArtifactId,
  ArtifactRevision,
  ArtifactRevisionId,
  ContextManifestId,
  FileRecord,
  ProjectId,
} from '@local-creative-os/domain'

import { SqliteMetadataRepository } from './metadata-repository.js'

const BUILDER_VERSION = '0.1.0'
const MAX_ITEM_CHARACTERS = 32_000
const MAX_TOTAL_CHARACTERS = 128_000
const TEXT_MIME_TYPES = new Set(['text/markdown', 'text/plain'])

function hash(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex')
}

function byIdentity<Value extends { readonly id: unknown }>(left: Value, right: Value): number {
  return String(left.id).localeCompare(String(right.id), 'en-US')
}

function artifactRef(
  artifact: Artifact,
  revision: ArtifactRevision,
  fileRecord: FileRecord,
): ContextManifestArtifactRefV0 {
  return {
    artifactId: String(artifact.id),
    revisionId: String(revision.id),
    title: artifact.title,
    kind: artifact.kind,
    mimeType: fileRecord.mimeType,
    contentHash: String(revision.contentHash),
    availability: artifact.availability,
  }
}

async function readTextExcerpt(fileRecord: FileRecord): Promise<{ readonly content?: string; readonly truncated: boolean }> {
  if (!TEXT_MIME_TYPES.has(fileRecord.mimeType) || fileRecord.availability === 'missing' || fileRecord.availability === 'unreadable') {
    return { truncated: false }
  }
  const file = await open(fileRecord.observedPath, 'r')
  try {
    const buffer = Buffer.alloc(MAX_ITEM_CHARACTERS * 4 + 4)
    const { bytesRead } = await file.read(buffer, 0, buffer.byteLength, 0)
    const value = buffer.subarray(0, bytesRead).toString('utf8')
    if (value.length <= MAX_ITEM_CHARACTERS) return { content: value, truncated: false }
    return { content: value.slice(0, MAX_ITEM_CHARACTERS), truncated: true }
  } finally {
    await file.close()
  }
}

function extractLockedElements(values: readonly string[]): string[] {
  const results = new Set<string>()
  for (const value of values) {
    for (const line of value.split(/\r?\n/)) {
      const match = /^\s*(?:[-*]\s*)?(?:keep|locked|保留|锁定)(?:\s*[:：-]\s*|\s+)(.+)$/i.exec(line)
      if (match?.[1]) results.add(match[1].trim())
    }
  }
  return [...results].sort((left, right) => left.localeCompare(right, 'en-US'))
}

type CanonicalContextManifestV0 = Omit<
  ContextManifestV0,
  'id' | 'createdAt' | 'manifestHash' | 'renderedManifestHash' | 'renderedMarkdown'
>

function renderMarkdown(input: CanonicalContextManifestV0): string {
  const target = input.target
  const sections = [
    `# LCOS Context Manifest`,
    ``,
    `- Schema: v${input.schemaVersion}`,
    `- Builder: ${input.builderVersion}`,
    `- Project: ${input.project.name} (${input.project.id})`,
    `- Graph Version: ${input.project.graphVersion}`,
    `- Requested Output: ${input.requestedOutput}`,
    `- Target: ${target ? `${target.title} (${target.artifactId})` : 'None'}`,
    ``,
  ]
  for (const item of input.orderedItems) {
    sections.push(`## ${item.role.toUpperCase()} · ${item.title}`, ``, `Identity: ${item.identity}`)
    if (item.contentHash) sections.push(`Content Hash: ${item.contentHash}`)
    if (item.content) sections.push(``, item.content)
    sections.push(``)
  }
  if (input.lockedElements.length) {
    sections.push(`## LOCKED ELEMENTS`, ``, ...input.lockedElements.map((value) => `- ${value}`), ``)
  }
  if (input.truncationMetadata.truncatedItemIds.length) {
    sections.push(`## TRUNCATION`, ``, ...input.truncationMetadata.truncatedItemIds.map((value) => `- ${value}`), ``)
  }
  return `${sections.join('\n').trim()}\n`
}

export class ContextManifestService {
  constructor(readonly repository: SqliteMetadataRepository) {}

  async build(projectId: ProjectId, input: BuildContextManifestV0Input = {}): Promise<ContextManifestV0> {
    const graph = this.repository.get(String(projectId))
    if (graph === undefined) throw new Error('Project not found.')
    const artifactById = new Map(graph.artifacts.map((artifact) => [String(artifact.id), artifact]))
    const revisionById = new Map(graph.artifactRevisions.map((revision) => [String(revision.id), revision]))
    const fileRecordById = new Map(graph.fileRecords.map((record) => [String(record.id), record]))
    const target = this.#selectTarget(graph, input.targetArtifactId)
    const targetRevision = target?.currentRevisionId === undefined ? undefined : revisionById.get(String(target.currentRevisionId))
    const targetFile = targetRevision === undefined ? undefined : fileRecordById.get(String(targetRevision.fileRecordId))
    const targetRef = target && targetRevision && targetFile ? artifactRef(target, targetRevision, targetFile) : null

    const related = [...graph.relations].sort(byIdentity)
    const referenceArtifacts = related
      .filter((relation) => relation.kind === 'reference' && relation.sourceEntityType === 'artifact')
      .map((relation) => artifactById.get(String(relation.sourceEntityId)))
      .filter((artifact): artifact is Artifact => artifact !== undefined)
    const feedbackArtifacts = related
      .filter((relation) => relation.kind === 'feedback' && relation.sourceEntityType === 'artifact')
      .map((relation) => artifactById.get(String(relation.sourceEntityId)))
      .filter((artifact): artifact is Artifact => artifact !== undefined)
    const explicitContextArtifacts = [...new Set(input.contextArtifactIds ?? [])]
      .filter((artifactId) => artifactId !== String(target?.id))
      .map((artifactId) => {
        const artifact = artifactById.get(artifactId)
        if (artifact === undefined) throw new Error(`Context Artifact not found: ${artifactId}`)
        return artifact
      })
    const targetScopeIds = new Set(
      graph.artifactViews
        .filter((view) => String(view.artifactId) === String(target?.id))
        .map((view) => String(view.scopeId)),
    )
    const scopeById = new Map(graph.scopes.map((scope) => [String(scope.id), scope]))
    const neighborhoodScopeIds = new Set(targetScopeIds)
    for (const scopeId of targetScopeIds) {
      const parentScopeId = scopeById.get(scopeId)?.parentScopeId
      if (parentScopeId === null || parentScopeId === undefined) continue
      neighborhoodScopeIds.add(String(parentScopeId))
      for (const scope of graph.scopes) {
        if (String(scope.parentScopeId) === String(parentScopeId)) neighborhoodScopeIds.add(String(scope.id))
      }
    }
    const siblingContextArtifacts = input.contextArtifactIds === undefined || input.contextArtifactIds.length === 0
      ? [...new Set(
          graph.artifactViews
            .filter((view) => neighborhoodScopeIds.has(String(view.scopeId)) && String(view.artifactId) !== String(target?.id))
            .map((view) => String(view.artifactId)),
        )]
          .map((artifactId) => artifactById.get(artifactId))
          .filter((artifact): artifact is Artifact => artifact !== undefined)
          .sort(byIdentity)
          .slice(0, 12)
      : []

    const truncatedItemIds: string[] = []
    const orderedItems: ContextManifestOrderedItemV0[] = []
    const feedback: ContextManifestFeedbackV0[] = []
    const lockedSource: string[] = []
    let remainingCharacters = MAX_TOTAL_CHARACTERS

    const appendArtifact = async (artifact: Artifact, role: ContextManifestOrderedItemV0['role']): Promise<ContextManifestArtifactRefV0 | null> => {
      if (artifact.currentRevisionId === undefined) return null
      const revision = revisionById.get(String(artifact.currentRevisionId))
      if (revision === undefined) return null
      const fileRecord = fileRecordById.get(String(revision.fileRecordId))
      if (fileRecord === undefined) return null
      let excerpt: { readonly content?: string; readonly truncated: boolean } = { truncated: false }
      try {
        excerpt = await readTextExcerpt(fileRecord)
      } catch {
        excerpt = { content: '[unreadable]', truncated: false }
      }
      if (excerpt.truncated) truncatedItemIds.push(String(artifact.id))
      if (excerpt.content) lockedSource.push(excerpt.content)
      const boundedContent = excerpt.content?.slice(0, Math.max(0, remainingCharacters))
      if (excerpt.content !== boundedContent) truncatedItemIds.push(String(artifact.id))
      remainingCharacters -= boundedContent?.length ?? 0
      orderedItems.push({
        role,
        identity: String(artifact.id),
        title: artifact.title,
        contentHash: String(revision.contentHash),
        ...(boundedContent === undefined ? {} : { content: `<untrusted-context identity="${String(artifact.id)}">\n${boundedContent}\n</untrusted-context>` }),
      })
      return artifactRef(artifact, revision, fileRecord)
    }

    if (target) await appendArtifact(target, 'target')
    const references = (await Promise.all(referenceArtifacts.sort(byIdentity).map((artifact) => appendArtifact(artifact, 'reference'))))
      .filter((value): value is ContextManifestArtifactRefV0 => value !== null)
    for (const artifact of feedbackArtifacts.sort(byIdentity)) {
      await appendArtifact(artifact, 'feedback')
      const item = orderedItems.at(-1)
      feedback.push({
        sourceArtifactId: String(artifact.id),
        title: artifact.title,
        body: item?.content ?? '',
        state: 'open',
      })
    }
    const alreadyIncluded = new Set([
      String(target?.id ?? ''),
      ...referenceArtifacts.map((artifact) => String(artifact.id)),
      ...feedbackArtifacts.map((artifact) => String(artifact.id)),
    ])
    for (const artifact of explicitContextArtifacts.sort(byIdentity)) {
      if (alreadyIncluded.has(String(artifact.id))) continue
      await appendArtifact(artifact, 'context')
      alreadyIncluded.add(String(artifact.id))
    }
    for (const artifact of siblingContextArtifacts.sort(byIdentity)) {
      if (alreadyIncluded.has(String(artifact.id))) continue
      await appendArtifact(artifact, 'context')
      alreadyIncluded.add(String(artifact.id))
    }
    for (const note of [...graph.notes].sort(byIdentity)) {
      lockedSource.push(note.body)
      feedback.push({
        sourceNoteId: String(note.id),
        title: `Note ${String(note.id)}`,
        body: note.body,
        state: 'open',
      })
      orderedItems.push({ role: 'context', identity: String(note.id), title: `Note ${String(note.id)}`, content: note.body })
    }
    for (const checkpoint of [...graph.checkpoints].sort(byIdentity)) {
      orderedItems.push({
        role: 'decision',
        identity: String(checkpoint.id),
        title: checkpoint.label,
        content: JSON.stringify(checkpoint.snapshotJson),
      })
    }

    const base: CanonicalContextManifestV0 = {
      schemaVersion: 0,
      builderVersion: BUILDER_VERSION,
      project: {
        id: String(graph.project.id),
        name: graph.project.name,
        graphVersion: Number(graph.graphVersion),
      },
      target: targetRef,
      currentRevision: targetRef,
      feedback,
      lockedElements: extractLockedElements(lockedSource),
      references,
      requestedOutput: input.requestedOutput?.trim() || 'Markdown Script Revision',
      orderedItems,
      ...(input.resourceRefs !== undefined && input.resourceRefs.length > 0 ? { resourceRefs: input.resourceRefs } : {}),
      truncationMetadata: {
        maxItemCharacters: MAX_ITEM_CHARACTERS,
        truncatedItemIds,
      },
    }
    const canonicalJson = JSON.stringify(base)
    const manifestHash = hash(canonicalJson)
    const manifestId = `context-manifest-${manifestHash}` as ContextManifestId
    const persisted = this.repository.createContextManifest({
      id: manifestId,
      projectId,
      schemaVersion: 0,
      ...(targetRef === null ? {} : {
        targetArtifactId: targetRef.artifactId as ArtifactId,
        targetRevisionId: targetRef.revisionId as ArtifactRevisionId,
      }),
      canonicalJson,
      manifestHash,
      createdAt: new Date().toISOString(),
    })
    const renderedMarkdown = renderMarkdown(base)
    return {
      id: persisted.id,
      createdAt: persisted.createdAt,
      manifestHash,
      ...base,
      renderedManifestHash: hash(renderedMarkdown),
      renderedMarkdown,
    }
  }

  #selectTarget(graph: ProjectGraphSnapshot, requestedId?: string): Artifact | undefined {
    if (requestedId) {
      const requested = graph.artifacts.find((artifact) => String(artifact.id) === requestedId)
      if (requested === undefined) throw new Error('Target Artifact not found.')
      return requested
    }
    return undefined
  }
}
