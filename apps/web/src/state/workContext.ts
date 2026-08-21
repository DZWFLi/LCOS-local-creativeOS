import type { CanvasNode, TargetContextInference, Workspace } from '../model'

function unique(ids: string[]): string[] {
  return Array.from(new Set(ids))
}

export function canBeTarget(node: CanvasNode): boolean {
  if (node.contextOnly || node.disabled || node.editable === false) return false
  // Targetability is a mechanical capability, not a legacy NodeKind guess.
  // Runtime artifacts do not always project an explicit `editable` flag, so
  // managed artifact + concrete revision is the deterministic fallback used by
  // the rest of the editor as well.
  if (node.editable === true) return true
  return node.managed === true && Boolean(node.artifactId && node.revisionId) && !node.historical
}

function isContextCandidate(node: CanvasNode): boolean {
  // Explicit selection / focus determines relevance. Business semantics belong
  // to the Agent/Skill; the UI only excludes disabled objects.
  return !node.disabled
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
  const current = inScope.find((node) => node.current && canBeTarget(node)) ?? nodes.find((node) => node.current && canBeTarget(node))

  if (editable.length === 1) {
    return {
      targetIds: [editable[0].id],
      contextIds: unique([
        ...selected.filter((node) => node.id !== editable[0].id).map((node) => node.id),
        ...pinnedContextIds,
        ...workspaceFocused.filter(isContextCandidate).map((node) => node.id),
      ]).filter((id) => id !== editable[0].id),
      ambiguousTargetIds: [],
      reason: '所选内容中只有一个明确可编辑对象',
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
      reason: '选择中包含多个可编辑对象，需要确认主要修改目标',
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
    reason: current ? (selected.length ? '所选内容作为参考，当前可编辑对象作为修改目标' : '使用当前可编辑对象与工作视角相关资料') : '当前没有明确修改目标，所选内容仅作为上下文',
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
