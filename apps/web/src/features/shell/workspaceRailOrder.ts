import type { ProjectViewRailOrderV0 } from '@local-creative-os/contracts'
import type { ProjectRailViewItem } from './WorkspaceRailVNext'

/** 项目视图栏纯排序：持久化顺序只引用底层 id（workspaceId / scopeId）。 */
export function orderProjectRailViews(
  views: readonly ProjectRailViewItem[],
  order: ProjectViewRailOrderV0 | null,
): ProjectRailViewItem[] {
  if (order === null || order.orderedRefs.length === 0) return [...views]
  const identity = (kind: ProjectRailViewItem['kind'], viewId: string) => `${kind}:${viewId}`
  const rawId = (view: ProjectRailViewItem) => view.workspaceId ?? view.scopeId ?? view.id
  const byId = new Map(views.map((view) => [identity(view.kind, rawId(view)), view]))
  const ordered: ProjectRailViewItem[] = []
  const seen = new Set<string>()
  for (const ref of order.orderedRefs) {
    const view = byId.get(identity(ref.kind, ref.viewId))
    if (view === undefined || view.kind !== ref.kind) continue
    ordered.push(view)
    seen.add(identity(ref.kind, ref.viewId))
  }
  return [...ordered, ...views.filter((view) => !seen.has(identity(view.kind, rawId(view))))]
}
