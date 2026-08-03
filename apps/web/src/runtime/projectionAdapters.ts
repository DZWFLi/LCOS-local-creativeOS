import type { RunStatus } from '../model'

export interface ArtifactRevisionProvenance {
  readonly id: string
  readonly label: string
  readonly createdAt?: string
  readonly parentRevisionId?: string
  readonly runId?: string
  readonly prompt?: string
  readonly provider?: string
  readonly current: boolean
  readonly draft: boolean
}

export interface WorkspaceStateSummary {
  readonly id: string
  readonly name: string
  readonly createdAt?: string
  readonly runId?: string
  readonly memberCount?: number
  readonly revisionCount?: number
}

export interface ProcessProjectionItem {
  readonly id: string
  readonly title: string
  readonly summary: string
  readonly status?: RunStatus
  readonly createdAt?: string
  readonly runId?: string
  readonly provider?: string
  readonly contextViewIds: readonly string[]
  readonly targetViewIds: readonly string[]
  readonly outputViewIds: readonly string[]
}

export interface SessionSummaryProjectionItem {
  readonly id: string
  readonly title: string
  readonly summary: string
  readonly runIds: readonly string[]
  readonly handoffRef?: string
  readonly createdAt?: string
}

type JsonRecord = Record<string, unknown>

function asRecord(value: unknown): JsonRecord | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as JsonRecord : null
}

function readString(record: JsonRecord | null, keys: readonly string[]): string | undefined {
  if (!record) return undefined
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
    if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  }
  return undefined
}

function readNumber(record: JsonRecord | null, keys: readonly string[]): number | undefined {
  if (!record) return undefined
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'number' && Number.isFinite(value)) return value
  }
  return undefined
}

function nested(record: JsonRecord | null, keys: readonly string[]): JsonRecord | null {
  if (!record) return null
  for (const key of keys) {
    const value = asRecord(record[key])
    if (value) return value
  }
  return null
}

function readStringArray(record: JsonRecord | null, keys: readonly string[]): string[] {
  if (!record) return []
  for (const key of keys) {
    const value = record[key]
    if (!Array.isArray(value)) continue
    return value.flatMap((item) => {
      if (typeof item === 'string' || typeof item === 'number') return [String(item)]
      const itemRecord = asRecord(item)
      const id = readString(itemRecord, ['viewId', 'artifactViewId', 'id'])
      return id ? [id] : []
    })
  }
  return []
}

function arrayFrom(value: unknown, keys: readonly string[]): readonly unknown[] {
  if (Array.isArray(value)) return value
  const record = asRecord(value)
  if (!record) return []
  for (const key of keys) {
    const candidate = record[key]
    if (Array.isArray(candidate)) return candidate
  }
  return []
}

function normalizeRunStatus(value?: string): RunStatus | undefined {
  const status = value?.toLowerCase().replaceAll('-', '_')
  if (!status) return undefined
  if (status === 'planned' || status === 'created' || status === 'queued' || status === 'assigned') return 'queued'
  if (status === 'running' || status === 'in_progress') return 'running'
  if (status === 'waiting_input' || status === 'waiting') return 'waiting_input'
  if (status === 'review' || status === 'awaiting_review') return 'review'
  if (status === 'completed' || status === 'accepted' || status === 'done') return 'completed'
  if (status === 'failed' || status === 'cancelled' || status === 'timeout' || status === 'recovery_required') return 'failed'
  return undefined
}

export function parseArtifactRevisions(detailValue: unknown, listValue: unknown, fallbackRevisionId?: string): ArtifactRevisionProvenance[] {
  const detail = asRecord(detailValue)
  const artifact = nested(detail, ['artifact', 'item']) ?? detail
  const currentRevisionId = readString(artifact, ['currentRevisionId', 'current_revision_id', 'revisionId']) ?? fallbackRevisionId
  const detailRevisions = arrayFrom(detailValue, ['revisions', 'artifactRevisions', 'items'])
  const listedRevisions = arrayFrom(listValue, ['revisions', 'artifactRevisions', 'items'])
  const raw = listedRevisions.length ? listedRevisions : detailRevisions
  const parsed: ArtifactRevisionProvenance[] = raw.flatMap((value, index) => {
    const revision = asRecord(value)
    if (!revision) return []
    const provenance = nested(revision, ['provenance', 'source', 'origin'])
    const run = nested(revision, ['run', 'sourceRun']) ?? nested(provenance, ['run', 'sourceRun'])
    const id = readString(revision, ['id', 'revisionId', 'revision_id'])
    if (!id) return []
    const prompt = readString(revision, ['prompt', 'instruction', 'command'])
      ?? readString(provenance, ['prompt', 'instruction', 'command'])
      ?? readString(run, ['prompt', 'instruction', 'command'])
    const provider = readString(revision, ['provider', 'requestedProvider', 'executedBy'])
      ?? readString(provenance, ['provider', 'requestedProvider', 'executedBy'])
      ?? readString(run, ['provider', 'requestedProvider', 'executedBy'])
    const runId = readString(revision, ['runId', 'run_id', 'sourceRunId'])
      ?? readString(provenance, ['runId', 'run_id', 'sourceRunId'])
      ?? readString(run, ['id', 'runId', 'run_id'])
    const status = readString(revision, ['status', 'state'])?.toLowerCase()
    return [{
      id,
      label: readString(revision, ['label', 'versionLabel', 'version']) ?? `V${index + 1}`,
      createdAt: readString(revision, ['createdAt', 'created_at', 'timestamp']),
      parentRevisionId: readString(revision, ['parentRevisionId', 'parent_revision_id', 'baseRevisionId']),
      runId,
      prompt,
      provider,
      current: id === currentRevisionId || status === 'current',
      draft: status === 'draft' || status === 'working' || status === 'staging',
    } satisfies ArtifactRevisionProvenance]
  })
  if (!parsed.length && fallbackRevisionId) {
    parsed.push({ id: fallbackRevisionId, label: 'Current', current: true, draft: false })
  }
  return parsed.toSorted((left, right) => {
    const time = String(right.createdAt ?? '').localeCompare(String(left.createdAt ?? ''))
    return time || right.label.localeCompare(left.label, 'zh-CN', { numeric: true })
  })
}

export function parseWorkspaceStates(value: unknown): WorkspaceStateSummary[] {
  return arrayFrom(value, ['states', 'workspaceStates', 'items']).flatMap((item, index) => {
    const record = asRecord(item)
    if (!record) return []
    const id = readString(record, ['id', 'stateId', 'workspaceStateId'])
    if (!id) return []
    return [{
      id,
      name: readString(record, ['name', 'label', 'title']) ?? `工作现场 ${index + 1}`,
      createdAt: readString(record, ['createdAt', 'created_at', 'timestamp']),
      runId: readString(record, ['runId', 'run_id', 'sourceRunId']),
      memberCount: readNumber(record, ['memberCount', 'membersCount']),
      revisionCount: readNumber(record, ['revisionCount', 'revisionsCount']),
    } satisfies WorkspaceStateSummary]
  }).toSorted((left, right) => String(right.createdAt ?? '').localeCompare(String(left.createdAt ?? '')))
}

export function parseProcessProjection(value: unknown): ProcessProjectionItem[] {
  return arrayFrom(value, ['items', 'events', 'processes', 'projection']).flatMap((item, index) => {
    const record = asRecord(item)
    if (!record) return []
    const run = nested(record, ['run', 'sourceRun'])
    const id = readString(record, ['id', 'eventId', 'projectionId', 'runId']) ?? readString(run, ['id', 'runId'])
    if (!id) return []
    const runId = readString(record, ['runId', 'run_id', 'sourceRunId']) ?? readString(run, ['id', 'runId']) ?? id
    const summary = readString(record, ['summary', 'prompt', 'instruction', 'description', 'message'])
      ?? readString(run, ['summary', 'prompt', 'instruction', 'description'])
      ?? '执行记录'
    const kind = readString(record, ['kind', 'type', 'eventType']) ?? 'Run'
    const statusText = readString(record, ['status', 'state', 'phase']) ?? readString(run, ['status', 'state', 'phase'])
    return [{
      id: `projection-${id}`,
      title: readString(record, ['title', 'name', 'label']) ?? `${kind} · ${runId}`,
      summary,
      status: normalizeRunStatus(statusText),
      createdAt: readString(record, ['createdAt', 'created_at', 'timestamp']) ?? readString(run, ['createdAt', 'created_at']),
      runId,
      provider: readString(record, ['provider', 'requestedProvider', 'executedBy']) ?? readString(run, ['provider', 'requestedProvider']),
      contextViewIds: readStringArray(record, ['contextViewIds', 'contextIds', 'inputViewIds', 'inputs']),
      targetViewIds: readStringArray(record, ['targetViewIds', 'editTargetViewIds', 'targetIds', 'targets']),
      outputViewIds: readStringArray(record, ['outputViewIds', 'resultViewIds', 'outputs']),
    } satisfies ProcessProjectionItem]
  })
}

export function parseSessionSummaries(value: unknown): SessionSummaryProjectionItem[] {
  return arrayFrom(value, ['summaries', 'sessionSummaries', 'items']).flatMap((item) => {
    const record = asRecord(item)
    if (!record) return []
    const id = readString(record, ['id', 'summaryId', 'sessionSummaryId'])
    if (!id) return []
    return [{
      id: `session-summary-${id}`,
      title: readString(record, ['title', 'name', 'label']) ?? 'Session Summary',
      summary: readString(record, ['summary', 'description', 'content']) ?? '该 Session 没有可显示的摘要。',
      runIds: readStringArray(record, ['runIds', 'run_ids', 'runs']),
      handoffRef: readString(record, ['handoffRef', 'handoff_ref']),
      createdAt: readString(record, ['createdAt', 'created_at', 'updatedAt', 'updated_at']),
    } satisfies SessionSummaryProjectionItem]
  }).toSorted((left, right) => String(left.createdAt ?? '').localeCompare(String(right.createdAt ?? '')))
}

export function summarizeRevisionCompare(value: unknown): string {
  const record = asRecord(value)
  if (!record) return '对比已生成。'
  const summary = readString(record, ['summary', 'description', 'message'])
  if (summary) return summary
  const added = readNumber(record, ['addedLines', 'additions', 'added'])
  const removed = readNumber(record, ['removedLines', 'deletions', 'removed'])
  const changed = readNumber(record, ['changedLines', 'changes', 'changed'])
  const parts = [
    added === undefined ? null : `新增 ${added}`,
    removed === undefined ? null : `删除 ${removed}`,
    changed === undefined ? null : `变更 ${changed}`,
  ].filter((item): item is string => Boolean(item))
  return parts.length ? parts.join(' · ') : '对比已生成；当前接口返回的是结构化差异。'
}
