/**
 * 线程分支模型（0.5 波）。
 * 语义照抄 grok-bot 的 shared/transcript-threads.ts（MIT），逐函数对齐：
 * resolveBranchRoot（防环 seen set）→ branchReplyCounts → threadDescendants。
 * LCOS 化：入口类型更名为 BranchedEntry；resolveBranchRoot 导出以便直接测试防环契约。
 * 纯函数零依赖。
 */

export interface BranchedEntry {
  readonly id: string
  readonly replyTo?: string
}

/**
 * 沿 replyTo 链向上找分支根：返回该条目所属根的 id；
 * 条目不在任何分支上（无 replyTo / 链上出现环）时返回 undefined；
 * 父节点不在集合里时返回那个缺失的父 id（父节点即根）。
 * 防环：seen set 保证 A↔B 互指时终止。
 */
export function resolveBranchRoot(
  entry: BranchedEntry,
  branchedById: ReadonlyMap<string, BranchedEntry>,
): string | undefined {
  let current = entry
  const seen = new Set([entry.id])
  for (;;) {
    const parentId = current.replyTo
    if (parentId === undefined) return undefined
    const parent = branchedById.get(parentId)
    if (parent === undefined) return parentId
    if (seen.has(parentId)) return undefined
    seen.add(parentId)
    current = parent
  }
}

/** 统计每个分支根下的回复数（根自身不计入）。 */
export function branchReplyCounts(branched: readonly BranchedEntry[]): Map<string, number> {
  const byId = new Map(branched.map((entry) => [entry.id, entry]))
  const counts = new Map<string, number>()
  for (const entry of branched) {
    const root = resolveBranchRoot(entry, byId)
    if (root === undefined) continue
    counts.set(root, (counts.get(root) ?? 0) + 1)
  }
  return counts
}

/** 取某个分支根下的全部后代（不含根本身），保持原数组顺序。 */
export function threadDescendants<T extends BranchedEntry>(
  rootId: string,
  branched: readonly T[],
): T[] {
  const byId = new Map<string, BranchedEntry>(branched.map((entry) => [entry.id, entry]))
  return branched.filter((entry) => resolveBranchRoot(entry, byId) === rootId)
}
