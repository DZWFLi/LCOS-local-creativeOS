import type { HandoffRecord } from '@local-creative-os/domain'
import type { SessionHandoffProjection } from './surfaceContracts'

/**
 * HandoffRecord（Core truth）→ Context History 投影。
 * 只翻译为用户可读的「谁交接给谁 + 留下什么」，不复制任何前端副本。
 */
export function handoffToProjection(handoff: HandoffRecord): SessionHandoffProjection {
  const facts: string[] = []
  if (handoff.decisions.length > 0) facts.push(`${handoff.decisions.length} 决定`)
  if (handoff.openQuestions.length > 0) facts.push(`${handoff.openQuestions.length} 未决`)
  if (handoff.artifactRefs.length > 0) facts.push(`${handoff.artifactRefs.length} 产物`)
  const date = handoff.createdAt.slice(0, 10).replaceAll('-', '/')
  return {
    id: handoff.id,
    from: handoff.fromProvider ?? 'Agent',
    to: handoff.toProvider ?? '项目',
    label: handoff.title,
    meta: `${[...facts, date].join(' · ')}`,
  }
}
