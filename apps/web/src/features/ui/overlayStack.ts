/**
 * OverlayStack —— 全局浮层栈管理器（Wave A0-4，grok-bot Donor Map §4 幕后工程）。
 *
 * 纪律来源：
 * - grok-bot Donor Map A1/A2（Overlay Stack）：「统一解决 anchor positioning、viewport collision、
 *   outside click、Esc、focus return、keyboard navigation、portal、nested menu、disabled state、aria」；
 *   destructive dialog 契约：「打开后聚焦、Esc、Tab focus trap、关闭恢复 focus、pending 阻止重复提交」。
 *   本模块承担其中的「层级顺序 + Esc / outside 关闭裁决」骨架；anchor positioning / viewport
 *   collision / focus return / portal / aria 由 Base UI 层（LcosPopover 等）承担，接线时配合。
 * - Design Grammar §13：「pointer leave / Esc / outside click 行为统一」。
 * - 游戏 GUI 裁决 §2.1：「Esc 永远处理'我现在不想待在这一层'」。
 * - UX收口 §9.2 Esc 逐层退出原话：「Esc 1→关当前 Popover/Orbit；Esc 2→退出临时 Focus/Lens；
 *   Esc 3→退出 Viewer/子现场；Esc 4→回到上一个 Spatial Scene。不是所有页面都必须四级，
 *   但原则必须统一。」——本栈只保证「一次交互收一层」的原则统一，具体分几级由接线方决定。
 *
 * 设计约束：模块级单例、不依赖 React context——任意层级（含非 React 宿主）都能注册/查询；
 * 本模块只做「裁决与通知」，不持有层的 open 状态：层的关闭动作由其 onEsc 回调实现，
 * 并由层负责调用 unregister（destructive dialog 可在 pending 态于回调内拒绝关闭）。
 *
 * 接线批次：Wave A-3 chrome 重建时由接线任务引入（本文件不接线，App.tsx 禁动）。
 */

/**
 * 浮层种类（对应 §9.2 层级心智：popover/menu/orbit=第 1 级，lens=第 2 级，
 * viewer=第 3 级，dialog=模态对话——destructive dialog 契约见 A2）。
 */
export type OverlayKind = 'popover' | 'menu' | 'dialog' | 'orbit' | 'lens' | 'viewer'

/**
 * 命中判定所需的最小 DOM 结构（Node.contains 语义）。
 * 真实环境传 HTMLElement（原生满足此结构）；测试可用最小假树实现同一契约。
 */
export interface OverlayDomNode {
  contains(node: unknown): boolean
}

/** 层的 DOM 引用：静态节点，或 getter（React ref 场景：注册时节点可能尚未挂载） */
export type OverlayElementRef = OverlayDomNode | (() => OverlayDomNode | null) | null

/** register 选项 */
export interface OverlayRegisterOptions {
  /** 层种类（供快照/调试与后续接线分型处理） */
  readonly kind: OverlayKind
  /**
   * 层的 DOM 根节点（或 getter），用于 outside 命中判定。未提供视为「无 DOM 保护」——
   * 任何点击目标都不属于该层内部（模态 dialog 请务必连同 backdrop 一起传入）。
   */
  readonly element?: OverlayElementRef
  /**
   * 「请关闭本层」回调：esc() / dismissTop() / handleOutsidePress() 的裁决都经由它通知层。
   * 层的实现负责收尾（关 UI、恢复 focus、调用 unregister）。可不注册（该层不响应 Esc 裁决）。
   * destructive dialog 可在 pending 态于回调内拒绝关闭（A2 契约：pending 阻止重复提交）。
   */
  readonly onEsc?: () => void
  /** outside press 是否允许关闭本层（模态 dialog 应为 false）；默认 false */
  readonly dismissOnOutside?: boolean
}

/** queryStack() 快照条目（只读；回调与 DOM 引用不进快照，避免泄漏闭包） */
export interface OverlayStackEntry {
  readonly id: string
  readonly kind: OverlayKind
  readonly dismissOnOutside: boolean
  /** 注册时是否提供了 onEsc */
  readonly hasEsc: boolean
  /** 注册时是否提供了 DOM 引用 */
  readonly hasElement: boolean
}

interface OverlayLayer {
  readonly id: string
  readonly kind: OverlayKind
  readonly element: OverlayElementRef
  readonly onEsc?: () => void
  readonly dismissOnOutside: boolean
}

/** 模块级单例栈：index 0 = 栈底（最先注册），末位 = 栈顶（当前最上层） */
const layers: OverlayLayer[] = []

function resolveElement(ref: OverlayElementRef): OverlayDomNode | null {
  return typeof ref === 'function' ? ref() : ref
}

function containsTarget(ref: OverlayElementRef, target: unknown): boolean {
  const element = resolveElement(ref)
  return element !== null && element.contains(target)
}

/**
 * 注册一个浮层到栈顶，返回 unregister（幂等）。
 * 同 id 重复注册视为「更新并置顶」：旧条目先被移除，旧 unregister 句柄随即失效、
 * 不会误删新条目——防同 id 双开导致栈错乱。
 */
export function register(id: string, options: OverlayRegisterOptions): () => void {
  const layer: OverlayLayer = {
    id,
    kind: options.kind,
    element: options.element ?? null,
    onEsc: options.onEsc,
    dismissOnOutside: options.dismissOnOutside ?? false,
  }
  const existing = layers.findIndex((entry) => entry.id === id)
  if (existing >= 0) layers.splice(existing, 1)
  layers.push(layer)
  return () => {
    const index = layers.indexOf(layer)
    if (index >= 0) layers.splice(index, 1)
  }
}

/**
 * 强制只关最上层（一次一层）：从栈中移除栈顶条目并调用其 onEsc 让层同步收尾。
 * 用于程序化收口（如路由切换清场、全局「关闭浮层」入口逐层调用）。
 * @returns 被关闭层的 id；栈空返回 null
 */
export function dismissTop(): string | null {
  const top = layers[layers.length - 1]
  if (top === undefined) return null
  layers.pop()
  top.onEsc?.()
  return top.id
}

/**
 * Esc 裁决：触发栈顶层的 onEsc（游戏裁决 §2.1「Esc 永远处理'我现在不想待在这一层'」）。
 * 只看栈顶、不向下穿透：栈顶未注册 onEsc → 返回 false（该 Esc 由更内层 DOM 逻辑消化，
 * 如 dialog 内的 Tab focus trap / 输入框）。栈本身不移除条目——关闭与 unregister 由层的
 * onEsc 实现负责（层可拒绝关闭，如 destructive dialog pending 态）。
 * @returns 是否有栈顶 onEsc 被触发
 */
export function esc(): boolean {
  const top = layers[layers.length - 1]
  if (top === undefined || top.onEsc === undefined) return false
  top.onEsc()
  return true
}

/**
 * outside press 裁决（Design Grammar §13：与 Esc 行为统一收口）。
 * 规则：target 不在任何已注册层 DOM 内 → 只关「最上层的 dismissOnOutside=true」一层
 * （一次交互只收一层，§9.2 逐层退出原则；模态层 dismissOnOutside=false 自身永不被
 * outside 关闭）。target 落在任一层 DOM 内（含下层）→ 视为浮层世界内部交互，
 * 本管理器不裁决。
 * @param target 事件目标（Event.target）；DOM 语义下 node.contains(null) === false，
 *               故 null 目标按「层外」处理
 * @returns 被关闭层的 id；无层被关闭返回 null
 */
export function handleOutsidePress(target: unknown): string | null {
  if (layers.some((layer) => containsTarget(layer.element, target))) return null
  for (let index = layers.length - 1; index >= 0; index -= 1) {
    const layer = layers[index]
    if (!layer.dismissOnOutside) continue
    layers.splice(index, 1)
    layer.onEsc?.()
    return layer.id
  }
  return null
}

/**
 * 只读快照（供测试/调试）：栈底→栈顶顺序；每次返回新数组，改动快照不影响内部栈。
 */
export function queryStack(): readonly OverlayStackEntry[] {
  return layers.map((layer) => ({
    id: layer.id,
    kind: layer.kind,
    dismissOnOutside: layer.dismissOnOutside,
    hasEsc: layer.onEsc !== undefined,
    hasElement: layer.element !== null,
  }))
}
