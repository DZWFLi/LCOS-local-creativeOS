import type { CanvasNode, CanvasScope } from '../../model'

const CONTEXT_GRAPH_TITLE_HINTS = [
  /\bproject\s+brief\b/i,
  /\bbrief\b/i,
  /\bstage\s+outline\b/i,
  /\bcurrent\s+stage\b/i,
  /\bcontext\s+package\b/i,
  /项目简报/,
  /项目背景/,
  /阶段大纲/,
  /阶段梳理/,
  /当前阶段/,
  /关键判断/,
  /关键决策/,
  /上下文包/,
]

function copyUnique(ids: readonly string[]): string[] {
  return [...new Set(ids.filter(Boolean))]
}

/**
 * Context Graph is a specialised project-level overview, not an empty saved set.
 * It always surfaces durable Context entities plus high-signal project context
 * objects that already exist in Project Truth. This is Presentation inference
 * only; it never changes business membership or creates Relations.
 */
export function deriveContextGraphAutoNodeIds(
  nodes: readonly CanvasNode[],
  scopes: readonly CanvasScope[],
  rootScopeId: string,
): string[] {
  const scopeKindById = new Map(scopes.map((scope) => [scope.id, scope.kind] as const))
  return copyUnique(nodes.flatMap((node) => {
    // Context Graph is project-wide. A Project Brief or Decision remains the
    // same entity even when its current Canvas View sits inside a Collection
    // or another navigation Scope. Physical Scope must never gate eligibility.
    const opensKind = node.opensScopeId ? scopeKindById.get(node.opensScopeId) : undefined
    if (node.entityKind === 'context' || opensKind === 'context') return [node.id]
    // Collection is a first-class Project Entity and may be referenced from the
    // project Context Graph without importing/expanding its members.
    if (node.entityKind === 'collection' || opensKind === 'collection') return [node.id]
    if (node.kind === 'decision') return [node.id]

    const searchable = `${node.title}\n${node.subtitle}`
    return CONTEXT_GRAPH_TITLE_HINTS.some((pattern) => pattern.test(searchable)) ? [node.id] : []
  }))
}

export function mergeContextGraphNodeIds(
  explicitIds: readonly string[],
  autoIds: readonly string[],
  contextContainerIds: readonly string[],
): string[] {
  return copyUnique([...explicitIds, ...autoIds, ...contextContainerIds])
}
