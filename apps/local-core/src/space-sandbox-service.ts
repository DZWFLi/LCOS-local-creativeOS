/**
 * /space/ 虚拟命名空间沙箱服务（任务四 P1）。
 *
 * 职责：把项目的文本 artifact 暴露成 nodes/<safeLabel>.md 虚拟路径
 * （列表带 L1 扫描头，读取带 full-read lease 记录）。
 *
 * 边界（huabu 同构纪律）：
 * - 只读。写入只走 CAS 守卫的 curation/text；本服务不提供任何写形态。
 * - allowlist 仅 nodes/**；解析只到 artifact（title→safeLabel），永不落盘。
 * - 只有文本 artifact（text/markdown、text/plain）进入命名空间；
 *   媒体节点走 resource 通道，不伪装成 .md。
 */

import { open } from 'node:fs/promises'

import type { SpaceListResultV0, SpaceListNodeV0, SpaceReadResultV0 } from '@local-creative-os/contracts'

import type { SessionReadSet } from './session-read-set.js'
import type { SqliteMetadataRepository } from './metadata-repository.js'
import { extractAgentNodePreview } from './node-ref.js'
import { nodeSpaceRel, parseSpacePath, SPACE_VFS_PREFIX, SpaceVfsError } from './space-vfs.js'

/** 单次 read 的字符上限（huabu 是 10MB 字节；LCOS 按字符算，200k 足够任何 markdown 节点）。 */
const SPACE_READ_MAX_CHARS = 200_000
/** ls 时读取做 preview 的前缀字符数。 */
const PREVIEW_READ_CHARS = 2_000
const TEXT_MIME = new Set(['text/markdown', 'text/plain'])

/** read 命中不了任何节点时抛出；route 映射 404。 */
export class SpacePathNotFoundError extends Error {
  constructor(rel: string) {
    super(`space path not found: ${rel} (call /space/ls to list current paths)`)
    this.name = 'SpacePathNotFoundError'
  }
}

interface SpaceNodeEntry {
  readonly rel: string
  readonly artifactId: string
  readonly title: string
  readonly revisionId: string
  readonly contentHash: string
  readonly observedPath: string | undefined
  readonly mimeType: string
  readonly viewId: string | undefined
}

export interface SpaceSandboxServiceDeps {
  readonly repository: SqliteMetadataRepository
  readonly sessionReadSet: SessionReadSet
}

async function readTextPrefix(observedPath: string | undefined, maxChars: number): Promise<string> {
  if (observedPath === undefined) return ''
  try {
    const handle = await open(observedPath, 'r')
    try {
      const buffer = Buffer.alloc(maxChars * 4 + 4)
      const { bytesRead } = await handle.read(buffer, 0, buffer.byteLength, 0)
      return buffer.subarray(0, bytesRead).toString('utf8').slice(0, maxChars)
    } finally {
      await handle.close()
    }
  } catch {
    return ''
  }
}

export class SpaceSandboxService {
  constructor(private readonly deps: SpaceSandboxServiceDeps) {}

  /**
   * 构建确定性路径表：artifact 按 id 排序；同 safeLabel 冲突时
   * 后来者追加 `-<artifactId 前 8 位>` 后缀消歧（路径始终可用 /space/ls 重发现）。
   */
  async #entries(projectId: string): Promise<SpaceNodeEntry[]> {
    const graph = this.deps.repository.get(projectId)
    if (graph === undefined) throw new Error('Project not found.')
    const revisionById = new Map(graph.artifactRevisions.map((revision) => [String(revision.id), revision]))
    const fileRecordById = new Map(graph.fileRecords.map((record) => [String(record.id), record]))
    const viewsByArtifact = new Map<string, string>()
    for (const view of [...graph.artifactViews].sort((left, right) => String(left.id).localeCompare(String(right.id), 'en-US'))) {
      const artifactId = String(view.artifactId)
      if (!viewsByArtifact.has(artifactId)) viewsByArtifact.set(artifactId, String(view.id))
    }

    const taken = new Set<string>()
    const entries: SpaceNodeEntry[] = []
    const artifacts = [...graph.artifacts].sort((left, right) => String(left.id).localeCompare(String(right.id), 'en-US'))
    for (const artifact of artifacts) {
      if (artifact.currentRevisionId === undefined) continue
      const revision = revisionById.get(String(artifact.currentRevisionId))
      if (revision === undefined || String(revision.artifactId) !== String(artifact.id)) continue
      const fileRecord = fileRecordById.get(String(revision.fileRecordId))
      if (fileRecord === undefined || !TEXT_MIME.has(fileRecord.mimeType)) continue
      let rel = nodeSpaceRel(artifact.title)
      if (taken.has(rel)) {
        rel = nodeSpaceRel(`${artifact.title}-${String(artifact.id).slice(0, 8)}`)
        if (taken.has(rel)) continue
      }
      taken.add(rel)
      entries.push({
        rel,
        artifactId: String(artifact.id),
        title: artifact.title,
        revisionId: String(revision.id),
        contentHash: String(revision.contentHash),
        observedPath: fileRecord.observedPath,
        mimeType: fileRecord.mimeType,
        viewId: viewsByArtifact.get(String(artifact.id)),
      })
    }
    return entries
  }

  /** 列出命名空间全部节点（含 L1 扫描头：preview + contentHash rev token）。 */
  async list(projectId: string): Promise<SpaceListResultV0> {
    const entries = await this.#entries(projectId)
    const items: SpaceListNodeV0[] = []
    for (const entry of entries) {
      const prefix = await readTextPrefix(entry.observedPath, PREVIEW_READ_CHARS)
      const preview = extractAgentNodePreview({ content: prefix })
      items.push({
        path: `${SPACE_VFS_PREFIX}${entry.rel}`,
        artifactId: entry.artifactId,
        title: entry.title,
        revisionId: entry.revisionId,
        contentHash: entry.contentHash,
        ...(preview === undefined ? {} : { preview }),
      })
    }
    return { items, generatedAt: new Date().toISOString() }
  }

  /**
   * 按虚拟路径读取节点全文。
   * sessionId 存在且未截断 → 记 full-read lease（与 /curation/read readMode=full
   * 同一 SessionReadSet 实例，后续 curation/text 写入即通过 CAS 校验）。
   */
  async read(projectId: string, wirePath: string, sessionId?: string): Promise<SpaceReadResultV0> {
    const rel = parseSpacePath(wirePath)
    const entries = await this.#entries(projectId)
    const entry = entries.find((candidate) => candidate.rel === rel)
    if (entry === undefined) throw new SpacePathNotFoundError(rel)
    const raw = await readTextPrefix(entry.observedPath, SPACE_READ_MAX_CHARS)
    const truncated = raw.length >= SPACE_READ_MAX_CHARS
    if (sessionId !== undefined && !truncated) {
      this.deps.sessionReadSet.recordFullRead({
        sessionId,
        projectId,
        artifactId: entry.artifactId,
        revisionId: entry.revisionId,
        contentHash: entry.contentHash,
      })
    }
    return {
      path: `${SPACE_VFS_PREFIX}${entry.rel}`,
      artifactId: entry.artifactId,
      ...(entry.viewId === undefined ? {} : { viewId: entry.viewId }),
      revisionId: entry.revisionId,
      contentHash: entry.contentHash,
      content: raw,
      truncated,
    }
  }
}

export { SpaceVfsError }
