import type { CanvasNode, TargetContextInference, Workspace } from '../model'

function unique(ids: string[]): string[] {
  return Array.from(new Set(ids))
}

export function canBeTarget(node: CanvasNode): boolean {
  if (node.contextOnly) return false
  if (typeof node.editable === 'boolean') return node.editable
  return node.kind === 'working' || node.kind === 'generated'
}

function isContextCandidate(node: CanvasNode): boolean {
  return node.kind === 'source' || node.kind === 'context' || node.kind === 'decision' || node.contextOnly === true
}

export function inferTargetContext(
  nodes: CanvasNode[],
  selectedIds: string[],
  workspace: Workspace,
  scopeId: string,
  pinnedContextIds: string[] = [],
): TargetContextInference {
  const inScope = nodes.filter((node) => (node.scopeId ?? 'scope-root') === scopeId)
  const selected = selectedIds.map((id) => nodes.find((node) => node.id === id)).filter((node): node is CanvasNode => Boolean(node))
  const editable = selected.filter(canBeTarget)
  const workspaceFocused = workspace.focusedViewIds.map((id) => nodes.find((node) => node.id === id)).filter((node): node is CanvasNode => Boolean(node))
  const current = inScope.find((node) => node.current) ?? inScope.find((node) => node.kind === 'working') ?? nodes.find((node) => node.current)

  if (editable.length === 1) {
    return {
      targetIds: [editable[0].id],
      contextIds: unique([
        ...selected.filter((node) => node.id !== editable[0].id).map((node) => node.id),
        ...pinnedContextIds,
        ...workspaceFocused.filter(isContextCandidate).map((node) => node.id),
      ]).filter((id) => id !== editable[0].id),
      ambiguousTargetIds: [],
      reason: '所选内容中只有一个可编辑主文件',
    }
  }

  if (editable.length > 1) {
    return {
      targetIds: [],
      contextIds: unique([
        ...selected.filter((node) => !editable.some((item) => item.id === node.id)).map((node) => node.id),
        ...pinnedContextIds,
      ]),
      ambiguousTargetIds: editable.map((node) => node.id),
      reason: '选择中包含多个可编辑文件，需要确认主要修改目标',
    }
  }

  const contextIds = unique([
    ...selected.map((node) => node.id),
    ...pinnedContextIds,
    ...workspaceFocused.filter(isContextCandidate).map((node) => node.id),
  ])

  return {
    targetIds: current ? [current.id] : [],
    contextIds: current ? contextIds.filter((id) => id !== current.id) : contextIds,
    ambiguousTargetIds: [],
    reason: selected.length ? '所选内容作为参考，当前工作稿作为修改目标' : '使用当前工作稿和工作视角相关资料',
  }
}

export function setPrimaryTarget(inference: TargetContextInference, targetId: string, selectedIds: string[]): TargetContextInference {
  return {
    ...inference,
    targetIds: [targetId],
    ambiguousTargetIds: [],
    contextIds: unique([...inference.contextIds, ...selectedIds.filter((id) => id !== targetId)]),
    reason: '用户已确认主要修改目标',
  }
}

export function moveBetweenTargetAndContext(inference: TargetContextInference, nodeId: string, destination: 'target' | 'context', nodes: CanvasNode[] = []): TargetContextInference {
  if (destination === 'target') {
    const node = nodes.find((item) => item.id === nodeId)
    if (node && !canBeTarget(node)) return { ...inference, reason: '该对象只能作为参考资料，不能作为修改目标' }
    return {
      ...inference,
      targetIds: [nodeId],
      ambiguousTargetIds: [],
      contextIds: unique([...inference.contextIds, ...inference.targetIds.filter((id) => id !== nodeId)]).filter((id) => id !== nodeId),
      reason: '用户调整了修改目标',
    }
  }
  const nextTargets = inference.targetIds.filter((id) => id !== nodeId)
  return {
    ...inference,
    targetIds: nextTargets,
    contextIds: unique([...inference.contextIds, nodeId]),
    reason: '用户将对象调整为参考资料',
  }
}
