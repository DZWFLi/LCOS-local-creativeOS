import { describe, expect, it } from 'vitest'
import type { ProjectViewRailOrderV0 } from '@local-creative-os/contracts'
import { orderProjectRailViews } from '../src/features/shell/workspaceRailOrder'
import type { ProjectRailViewItem } from '../src/features/shell/WorkspaceRailVNext'

const views: ProjectRailViewItem[] = [
  { id: 'workspace:a', title: 'A', kind: 'collection', workspaceId: 'a', memberCount: 2 },
  { id: 'workspace:b', title: 'B', kind: 'context', workspaceId: 'b', memberCount: 3 },
  { id: 'workspace:c', title: 'C', kind: 'workflow', workspaceId: 'c', memberCount: 1 },
]

describe('project view rail order', () => {
  it('keeps the source order when no committed order exists', () => {
    expect(orderProjectRailViews(views, null).map((view) => view.id)).toEqual(views.map((view) => view.id))
  })

  it('applies mixed cross-category order by committed refs', () => {
    const order: ProjectViewRailOrderV0 = {
      projectId: 'p',
      version: 2,
      updatedAt: '2026-08-12T00:00:00.000Z',
      orderedRefs: [
        { kind: 'workflow', viewId: 'c' },
        { kind: 'collection', viewId: 'a' },
        { kind: 'context', viewId: 'b' },
      ],
    }
    expect(orderProjectRailViews(views, order).map((view) => `${view.kind}:${view.workspaceId}`)).toEqual([
      'workflow:c',
      'collection:a',
      'context:b',
    ])
  })

  it('ignores deleted or kind-mismatched refs and appends unknown views deterministically', () => {
    const order: ProjectViewRailOrderV0 = {
      projectId: 'p',
      version: 1,
      updatedAt: '2026-08-12T00:00:00.000Z',
      orderedRefs: [
        { kind: 'collection', viewId: 'c' }, // kind mismatch（c 是 workflow）
        { kind: 'context', viewId: 'deleted' }, // 已删除
      ],
    }
    const ordered = orderProjectRailViews(views, order)
    expect(ordered).toHaveLength(3)
    expect(ordered.map((view) => view.workspaceId)).toEqual(['a', 'b', 'c'])
  })

  it('keeps context and workflow refs distinct even when they share the same scope id', () => {
    const sameScope: ProjectRailViewItem[] = [
      { id: 'scope:shared', title: 'Context', kind: 'context', scopeId: 'shared', memberCount: 2 },
      { id: 'workflow:shared', title: 'Workflow', kind: 'workflow', scopeId: 'shared', memberCount: 4 },
    ]
    const order: ProjectViewRailOrderV0 = {
      projectId: 'p',
      version: 3,
      updatedAt: '2026-08-13T00:00:00.000Z',
      orderedRefs: [
        { kind: 'workflow', viewId: 'shared' },
        { kind: 'context', viewId: 'shared' },
      ],
    }
    expect(orderProjectRailViews(sameScope, order).map((view) => view.id)).toEqual(['workflow:shared', 'scope:shared'])
  })

})
