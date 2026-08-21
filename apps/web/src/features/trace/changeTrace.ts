import type { ArtifactRevisionProvenance } from '../../runtime/projectionAdapters'

/**
 * Phase 2 §5.7：Change Trace 投影。
 * 只做确定性联接（revision/provenance/run 字段），不提取任何隐藏推理链。
 */
export interface ChangeTraceEntry {
  readonly revisionId: string
  readonly at?: string
  readonly actor: 'user' | 'agent' | 'capture' | 'system'
  readonly action: string
  readonly reasonSummary?: string
  readonly sourceRefs: readonly string[]
  readonly runId?: string
}

export function buildChangeTrace(
  revisions: readonly ArtifactRevisionProvenance[],
): ChangeTraceEntry[] {
  return revisions
    .slice()
    .sort((left, right) => String(left.createdAt ?? '').localeCompare(String(right.createdAt ?? '')))
    .map((revision) => {
      const actor: ChangeTraceEntry['actor'] = revision.runId !== undefined
        ? 'agent'
        : revision.provider !== undefined
          ? 'system'
          : revision.draft
            ? 'agent'
            : 'user'
      const sourceRefs = revision.provider === undefined ? [] : [revision.provider]
      return {
        revisionId: revision.id,
        ...(revision.createdAt === undefined ? {} : { at: revision.createdAt }),
        actor,
        action: revision.label,
        ...(revision.prompt === undefined ? {} : { reasonSummary: revision.prompt }),
        sourceRefs,
        ...(revision.runId === undefined ? {} : { runId: revision.runId }),
      }
    })
}
