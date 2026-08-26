/**
 * CommandPalette provider 架构（Wave A-4：grok-bot Donor Map A3 吸收）。
 *
 * 纪律来源（grok-bot A3 原话）：「grok-bot 将 agent/command/message/file/link/routine 统一为
 * 异构 entry，并给 provider 清楚的 loading/ready/empty/failed/unavailable/cancelled 状态。
 * LCOS 当前其实已经开始吸收 provider 化……后续应继续吸收 provider interface、异构结果、
 * fuzzy ranking、cancel/stale request、keyboard-first、action injection、query 零副作用。」
 *
 * 本文件是架构层（纯函数，零 React 依赖，只依赖 A0-3 冻结的 AsyncSnapshot 契约）：
 * - PaletteProvider 接口（id + label + search → 六态快照）
 * - fuzzy 排序 helper（includes + 评分，不过度工程）
 * - stale request 防护（provider 持序号：新查询使旧结果作废 → makeCancelled）
 * - 跨 provider 合并（按 id 去重、五组 IA 分节）
 * 数据源装配在 commandPaletteProviders.ts；六态渲染在 CommandPalette.tsx。
 */

import {
  makeCancelled,
  makeEmpty,
  makeFailed,
  makeReady,
  makeUnavailable,
  type AsyncSnapshot,
} from '../ui/asyncState'

/** 面板条目的分组（LCOS 五组 IA：命令/节点/文件/会话/技能）。 */
export type PaletteGroupId = '命令' | '节点' | '文件' | '会话' | '技能'

/** 分节显示顺序：命令 → 节点 → 文件 → 会话 → 技能。 */
export const PALETTE_GROUP_ORDER: readonly PaletteGroupId[] = ['命令', '节点', '文件', '会话', '技能']

/** 面板条目（grok-bot 语境的异构 entry：命令/节点/文件/会话/技能统一为此形状）。 */
export interface PaletteEntry {
  readonly id: string
  readonly title: string
  readonly hint?: string
  readonly group: PaletteGroupId
  /** 额外检索词（中英文别名）；标题始终参与匹配。 */
  readonly keywords?: string
}

/**
 * 单次 search 的产出：
 * - 同步快照（内存态数据源，render 期直出，静态渲染 / SSR 可断言）；
 * - Promise<快照>（异步数据源，渲染层先按 loading 处理，回到后再消费）。
 */
export type PaletteSearchOutcome =
  | AsyncSnapshot<readonly PaletteEntry[]>
  | Promise<AsyncSnapshot<readonly PaletteEntry[]>>

/**
 * provider 接口（A3：provider interface + 异构结果）。
 * 零副作用承诺（A3 原话「query 零副作用」）：search 不得 mutate 任何外部状态、
 * 不得触发任何动作回调——执行动作全部走 App 注入的 actions 表（按 entry.id 寻址），
 * provider 只做「查询 → 条目集」的投影。
 */
export interface PaletteProvider {
  /** provider 稳定标识（异步快照落库寻址用） */
  readonly id: string
  /** 展示名（六态渲染时该组的标题；通常等于主分组名） */
  readonly label: string
  search(query: string): PaletteSearchOutcome
}

/**
 * 旧同步 provider 兼容面（group + query）：CommandPalette 输入侧就地适配，
 * 存量调用方（既有测试、旧装配代码）零迁移。
 */
export interface SyncPaletteProvider {
  readonly group: PaletteGroupId
  query(term: string): readonly PaletteEntry[]
}

/** 组件输入：新 provider（含带兼容成员的混合实例）与旧同步 provider 都收。 */
export type PaletteProviderInput = PaletteProvider | SyncPaletteProvider

/* ---------------- fuzzy 排序（纯函数，includes + 评分） ---------------- */

/** 相关度评分：标题前缀 3 > 标题包含 2 > 关键词包含 1；不匹配返回 null。空词返回 0（全量）。 */
export function scorePaletteEntry(entry: PaletteEntry, term: string): number | null {
  const needle = term.trim().toLowerCase()
  if (!needle) return 0
  const title = entry.title.toLowerCase()
  if (title.startsWith(needle)) return 3
  if (title.includes(needle)) return 2
  if (entry.keywords !== undefined && entry.keywords.toLowerCase().includes(needle)) return 1
  return null
}

/** 单 provider 单次查询的条目上限：简单列表（无虚拟窗口）下的保护性封顶。 */
const MAX_PROVIDER_ENTRIES = 50

/** fuzzy 排序：按评分降序（同分保持原序，稳定）并封顶。 */
export function rankPaletteEntries(entries: readonly PaletteEntry[], term: string): readonly PaletteEntry[] {
  const scored = entries
    .map((entry, index) => ({ entry, index, score: scorePaletteEntry(entry, term) }))
    .filter((row): row is { entry: PaletteEntry; index: number; score: number } => row.score !== null)
  scored.sort((left, right) => right.score - left.score || left.index - right.index)
  return scored.slice(0, MAX_PROVIDER_ENTRIES).map((row) => row.entry)
}

/* ---------------- 快照装配 ---------------- */

/** 条目集 → 快照：空集语义为 empty（查询成功但无内容，勿当失败），非空为 ready。 */
export function snapshotOfEntries(entries: readonly PaletteEntry[]): AsyncSnapshot<readonly PaletteEntry[]> {
  return entries.length === 0 ? makeEmpty() : makeReady(entries)
}

/** 任意抛出的错误 → 人类可读文案（unknown 安全收敛）。 */
function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/* ---------------- provider 工厂（stale request 防护） ---------------- */

export interface PaletteProviderConfig {
  readonly id: string
  readonly label: string
  /**
   * 纯查询数据源：同步（内存态投影）或异步（bridge RPC 等）皆可。
   * 零副作用承诺：fetch 不得 mutate 任何外部状态、不得触发动作回调。
   */
  readonly fetch: (query: string) => readonly PaletteEntry[] | Promise<readonly PaletteEntry[]>
  /** 能力可用性检查：返回不可用原因（如「runtime 未连接」）则 search 直接 makeUnavailable。 */
  readonly availability?: () => string | null
}

/**
 * provider 工厂：把纯查询 fetch 包成六态快照 search。
 * stale request 防护（A3「cancel/stale request」）：provider 持查询序号（seq），
 * 每次新查询使旧序号作废——旧异步结果回来时折叠为 makeCancelled（渲染层直接丢弃，
 * stale response must not clobber fresh state，见 asyncState.ts 契约注释）。
 */
export function createPaletteProvider(config: PaletteProviderConfig): PaletteProvider {
  let seq = 0
  return {
    id: config.id,
    label: config.label,
    search(query: string): PaletteSearchOutcome {
      const unavailableReason = config.availability?.() ?? null
      if (unavailableReason !== null) return makeUnavailable(unavailableReason)
      const ticket = ++seq
      let fetched: readonly PaletteEntry[] | Promise<readonly PaletteEntry[]>
      try {
        fetched = config.fetch(query)
      } catch (error: unknown) {
        return makeFailed(toErrorMessage(error))
      }
      if (!(fetched instanceof Promise)) return snapshotOfEntries(fetched)
      return fetched.then(
        (entries) => (ticket === seq ? snapshotOfEntries(entries) : makeCancelled()),
        (error: unknown) => (ticket === seq ? makeFailed(toErrorMessage(error)) : makeCancelled()),
      )
    },
  }
}

/**
 * 输入归一：已是新 provider（带 search）直接放行；旧同步 provider（group + query）
 * 就地包成快照 provider（id 派生自 group、label = group）。
 * query 语义原样透传；零副作用承诺同 PaletteProvider（适配层只包快照，不加逻辑）。
 */
export function normalizePaletteProviderInput(input: PaletteProviderInput): PaletteProvider {
  if ('search' in input) return input
  return {
    id: `sync:${input.group}`,
    label: input.group,
    search(query: string): PaletteSearchOutcome {
      try {
        return snapshotOfEntries(input.query(query))
      } catch (error: unknown) {
        return makeFailed(toErrorMessage(error))
      }
    },
  }
}

/* ---------------- 合并（跨 provider 去重 + 五组 IA 分节） ---------------- */

/** 多源合并：跨 provider 按 id 去重（首见优先），按 PALETTE_GROUP_ORDER 分桶平铺。 */
export function mergePaletteEntries(lists: readonly (readonly PaletteEntry[])[]): readonly PaletteEntry[] {
  const seen = new Set<string>()
  const buckets = new Map<PaletteGroupId, PaletteEntry[]>()
  for (const entries of lists) {
    for (const entry of entries) {
      if (seen.has(entry.id)) continue
      seen.add(entry.id)
      const bucket = buckets.get(entry.group)
      if (bucket === undefined) buckets.set(entry.group, [entry])
      else bucket.push(entry)
    }
  }
  return PALETTE_GROUP_ORDER.flatMap((group) => buckets.get(group) ?? [])
}

export interface PaletteSection {
  readonly group: PaletteGroupId
  readonly items: readonly PaletteEntry[]
}

/** 平铺条目 → 非空分节（渲染用；保持 PALETTE_GROUP_ORDER 顺序）。 */
export function groupPaletteEntries(entries: readonly PaletteEntry[]): readonly PaletteSection[] {
  return PALETTE_GROUP_ORDER
    .map((group) => ({ group, items: entries.filter((entry) => entry.group === group) }))
    .filter((section) => section.items.length > 0)
}
