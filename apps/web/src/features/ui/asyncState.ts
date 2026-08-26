/**
 * AsyncSnapshot —— LCOS 异步六态契约（Wave A0-3，grok-bot Donor Map §4 幕后工程）。
 *
 * 纪律来源（grok-bot Donor Map A4 Async State Contract 原话）：
 * 「推荐统一心智：loading / ready / empty / failed / unavailable / cancelled。
 *   尤其适合 Session connect、Agent resume、Assembly Warehouse、External Resource、
 *   Search provider、Artifact metadata、Preview、Runtime availability。」
 *
 * 六态语义（冻结，渲染层只看 status 一个字段即可决定 UI 心智）：
 * - loading     请求已发出、结果未回（骨架 / 进度态）；
 * - ready       成功且拿到可消费数据（data 必须存在）；
 * - empty       请求成功但结果为空集——查询本身没问题，勿当失败处理；
 * - failed      请求已发出但失败（error 为人类可读原因）；
 * - unavailable 能力本身不可用（如 runtime 未连接）——不是这次请求失败，
 *               而是这个能力当前不存在（原因写入 error 字段）；
 * - cancelled   请求已发出但被新请求取代——典型为竞态：旧响应直接丢弃，勿回写 UI。
 *
 * 纯函数零依赖：本文件不 import 任何模块，可在任意层（React / 非 React / 测试）直接使用。
 * 接线批次：Wave A-3 chrome 重建时由接线任务引入（本文件不接线，App.tsx 禁动）。
 */

/** 异步六态（grok-bot A4 冻结顺序：loading / ready / empty / failed / unavailable / cancelled） */
export type AsyncStatus = 'loading' | 'ready' | 'empty' | 'failed' | 'unavailable' | 'cancelled'

/**
 * 异步能力的统一快照形状：渲染层永远只消费这一个形状，不为每个能力各造轮子。
 * data 仅在 ready 态携带；error 在 failed / unavailable 态承载原因；at 为快照时间戳（ms）。
 */
export interface AsyncSnapshot<T> {
  /** 六态之一，决定 UI 心智（骨架 / 内容 / 空态 / 错误 / 能力不可用 / 已废弃） */
  readonly status: AsyncStatus
  /** ready 态携带的数据；其余态恒为 undefined */
  readonly data?: T
  /** failed 态为错误描述；unavailable 态为不可用原因（如「runtime 未连接」）；其余态恒为 undefined */
  readonly error?: string
  /** 快照生成时间戳（Date.now()，ms）；供新鲜度判断与调试 */
  readonly at?: number
}

/**
 * 构造 loading 快照：请求已发出、结果未回。
 * UI 心智：骨架 / 进度指示；禁止把旧数据当新数据渲染（除非显式做 stale-while-revalidate）。
 */
export function makeLoading(): AsyncSnapshot<never> {
  return { status: 'loading', at: Date.now() }
}

/**
 * 构造 ready 快照：成功且拿到可消费数据。
 * 约定：data 为 undefined 的 ready 视为「未携带数据」（isUsable 为 false）——
 * 空结果请用 makeEmpty()，不要用 makeReady(undefined)。
 */
export function makeReady<T>(data: T): AsyncSnapshot<T> {
  return { status: 'ready', data, at: Date.now() }
}

/**
 * 构造 empty 快照：请求成功但结果为空集。
 * 语义边界：empty ≠ failed——查询本身没问题，UI 应展示空态引导而非错误提示。
 */
export function makeEmpty(): AsyncSnapshot<never> {
  return { status: 'empty', at: Date.now() }
}

/**
 * 构造 failed 快照：请求已发出但失败。
 * @param error 人类可读的失败原因（透传给 UI 的错误文案）
 */
export function makeFailed(error: string): AsyncSnapshot<never> {
  return { status: 'failed', error, at: Date.now() }
}

/**
 * 构造 unavailable 快照：能力本身不可用（grok-bot A4 原话语境：如 runtime 未连接）。
 * 语义边界：unavailable ≠ failed——不是这一次请求失败，而是这个能力当前不存在；
 * UI 心智应为「能力级提示 / 引导连接」，而非重试当前操作。
 * @param reason 不可用原因（写入 error 字段，如「runtime 未连接」）
 */
export function makeUnavailable(reason: string): AsyncSnapshot<never> {
  return { status: 'unavailable', error: reason, at: Date.now() }
}

/**
 * 构造 cancelled 快照：请求已发出但被新请求取代。
 * 语义边界：cancelled ≠ failed——旧请求没有错，只是过期；典型竞态处理是
 * 直接丢弃旧响应、勿回写 UI（stale response must not clobber fresh state）。
 */
export function makeCancelled(): AsyncSnapshot<never> {
  return { status: 'cancelled', at: Date.now() }
}

/**
 * 判定快照是否可直接消费数据：status === 'ready' 且 data !== undefined。
 * empty / loading / failed / unavailable / cancelled 一律返回 false
 * （empty 属「成功但无内容」，走空态 UI 而非数据渲染）。
 * 类型收窄：为 true 时 snapshot.data 保证存在（T 非 undefined）。
 */
export function isUsable<T>(snapshot: AsyncSnapshot<T>): snapshot is AsyncSnapshot<T> & { readonly data: T } {
  return snapshot.status === 'ready' && snapshot.data !== undefined
}

/**
 * 对 ready 快照的数据做纯映射（functor 语义），其余五态原样返回（含 at 不变）。
 * 典型用途：把仓库原始数据投影成视图模型，而不关心六态分支。
 * @param snapshot 任意状态的快照
 * @param fn 数据映射函数；仅当快照 usable 时才会被调用
 */
export function mapData<T, U>(snapshot: AsyncSnapshot<T>, fn: (data: T) => U): AsyncSnapshot<U> {
  // 该分支 data 必为 undefined：T→U 的差异只体现在 data 字段，断言安全
  if (snapshot.status !== 'ready' || snapshot.data === undefined) {
    return snapshot as unknown as AsyncSnapshot<U>
  }
  return { ...snapshot, data: fn(snapshot.data) }
}
