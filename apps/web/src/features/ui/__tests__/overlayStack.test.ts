import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  dismissTop,
  esc,
  handleOutsidePress,
  queryStack,
  register,
  type OverlayRegisterOptions,
} from '../overlayStack'

/**
 * OverlayStack 契约测试（Wave A0-4，grok-bot Donor Map A1/A2 + UX收口 §9.2）。
 * 环境说明：本项目 vitest 走 node 环境（无 jsdom）——outside 命中判定用最小假树模拟
 * Node.contains 语义（与 tests/glyth-motion.test.ts 的「stub 全局」先例同一思路）。
 */

/** 最小 DOM 假树：parent 链 + contains 沿祖先链判定（Node.contains 同语义） */
interface FakeDomNode {
  readonly parent: FakeDomNode | null
  contains(node: unknown): boolean
}

function dom(parent: FakeDomNode | null = null): FakeDomNode {
  const node: FakeDomNode = {
    parent,
    contains(candidate: unknown): boolean {
      let cursor = (candidate ?? null) as FakeDomNode | null
      while (cursor !== null) {
        if (cursor === node) return true
        cursor = cursor.parent
      }
      return false
    },
  }
  return node
}

const cleanups: Array<() => void> = []

/** 注册并登记清理（模块级单例栈跨用例存续，afterEach 必须清空） */
function openLayer(id: string, options: OverlayRegisterOptions): () => void {
  const close = register(id, options)
  cleanups.push(close)
  return close
}

afterEach(() => {
  cleanups.splice(0).forEach((close) => close())
})

describe('register / unregister / 嵌套顺序', () => {
  it('register 入栈：后注册者在栈顶，快照字段齐全', () => {
    openLayer('pop', { kind: 'popover', onEsc: vi.fn(), dismissOnOutside: true })
    openLayer('menu', { kind: 'menu', onEsc: vi.fn(), dismissOnOutside: false })
    const stack = queryStack()
    expect(stack.map((entry) => entry.id)).toEqual(['pop', 'menu'])
    expect(stack[1]?.kind).toBe('menu')
    expect(stack[1]?.dismissOnOutside).toBe(false)
    expect(stack[0]?.hasEsc).toBe(true)
  })

  it('未提供 onEsc/element 的层：hasEsc=false、hasElement=false', () => {
    openLayer('bare', { kind: 'viewer' })
    const entry = queryStack().find((candidate) => candidate.id === 'bare')
    expect(entry?.hasEsc).toBe(false)
    expect(entry?.hasElement).toBe(false)
  })

  it('unregister 只移除目标层且幂等', () => {
    const closeA = openLayer('a', { kind: 'popover' })
    openLayer('b', { kind: 'menu' })
    closeA()
    closeA()
    expect(queryStack().map((entry) => entry.id)).toEqual(['b'])
  })

  it('中间层移除后上下层保序（栈不塌陷错位）', () => {
    openLayer('a', { kind: 'popover' })
    const closeB = openLayer('b', { kind: 'menu' })
    openLayer('c', { kind: 'dialog' })
    closeB()
    expect(queryStack().map((entry) => entry.id)).toEqual(['a', 'c'])
  })

  it('同 id 重复 register：更新并置顶；旧 unregister 句柄失效不误删新条目', () => {
    const staleClose = openLayer('x', { kind: 'popover' })
    const closeX = openLayer('x', { kind: 'menu' })
    const stack = queryStack()
    expect(stack).toHaveLength(1)
    expect(stack[0]?.kind).toBe('menu')
    staleClose()
    expect(queryStack()).toHaveLength(1)
    closeX()
    expect(queryStack()).toHaveLength(0)
  })

  it('queryStack 返回防御性副本：改动快照不影响内部栈', () => {
    openLayer('pop', { kind: 'popover' })
    const snapshot = queryStack()
    expect(snapshot).toHaveLength(1)
    const mutable = [...snapshot]
    mutable.pop()
    expect(mutable).toHaveLength(0)
    expect(queryStack()).toHaveLength(1)
  })
})

describe('esc 裁决（只看栈顶，不向下穿透——§2.1 栈顶层负责）', () => {
  it('esc 触发栈顶 onEsc，不触发下层；栈本身不移除条目（关闭与 unregister 由层负责）', () => {
    const escBottom = vi.fn()
    const escTop = vi.fn()
    openLayer('pop', { kind: 'popover', onEsc: escBottom })
    openLayer('menu', { kind: 'menu', onEsc: escTop })
    expect(esc()).toBe(true)
    expect(escTop).toHaveBeenCalledTimes(1)
    expect(escBottom).not.toHaveBeenCalled()
    expect(queryStack().map((entry) => entry.id)).toEqual(['pop', 'menu'])
  })

  it('栈顶未注册 onEsc：返回 false 且不穿透到下层', () => {
    const escPop = vi.fn()
    openLayer('pop', { kind: 'popover', onEsc: escPop })
    openLayer('viewer', { kind: 'viewer' })
    expect(esc()).toBe(false)
    expect(escPop).not.toHaveBeenCalled()
    expect(queryStack()).toHaveLength(2)
  })

  it('空栈 esc：返回 false', () => {
    expect(esc()).toBe(false)
  })

  it('层的 onEsc 自行 unregister → 栈同步清空（关闭权在层，destructive dialog 可拒绝）', () => {
    let close: () => void = () => {}
    const onEsc = vi.fn(() => close())
    close = openLayer('pop', { kind: 'popover', onEsc })
    esc()
    expect(onEsc).toHaveBeenCalledTimes(1)
    expect(queryStack()).toHaveLength(0)
  })
})

describe('dismissTop（强制只关最上层，一次一层）', () => {
  it('只关栈顶：移除条目并通知其 onEsc；下层原样保留', () => {
    const escPop = vi.fn()
    const escDialog = vi.fn()
    openLayer('pop', { kind: 'popover', onEsc: escPop })
    openLayer('dialog', { kind: 'dialog', onEsc: escDialog })
    expect(dismissTop()).toBe('dialog')
    expect(escDialog).toHaveBeenCalledTimes(1)
    expect(escPop).not.toHaveBeenCalled()
    expect(queryStack().map((entry) => entry.id)).toEqual(['pop'])
  })

  it('栈顶无 onEsc 仍会被强制移除（dismissTop 不依赖回调）', () => {
    openLayer('pop', { kind: 'popover', onEsc: vi.fn() })
    openLayer('bare', { kind: 'orbit' })
    expect(dismissTop()).toBe('bare')
    expect(queryStack().map((entry) => entry.id)).toEqual(['pop'])
  })

  it('空栈 dismissTop：返回 null', () => {
    expect(dismissTop()).toBeNull()
  })
})

describe('handleOutsidePress（outside 命中判定——DG §13 与 Esc 行为统一收口）', () => {
  it('target 在栈顶层 DOM 子树内 → 不关', () => {
    const popRoot = dom()
    const popChild = dom(popRoot)
    const onEsc = vi.fn()
    openLayer('pop', { kind: 'popover', element: popRoot, onEsc, dismissOnOutside: true })
    expect(handleOutsidePress(popChild)).toBeNull()
    expect(onEsc).not.toHaveBeenCalled()
    expect(queryStack()).toHaveLength(1)
  })

  it('target 在下层 DOM 内（点击属于浮层世界内部）→ 任何层都不关', () => {
    const popRoot = dom()
    const popChild = dom(popRoot)
    const escPop = vi.fn()
    const escViewer = vi.fn()
    openLayer('pop', { kind: 'popover', element: popRoot, onEsc: escPop, dismissOnOutside: true })
    openLayer('viewer', { kind: 'viewer', element: dom(), onEsc: escViewer, dismissOnOutside: true })
    expect(handleOutsidePress(popChild)).toBeNull()
    expect(escPop).not.toHaveBeenCalled()
    expect(escViewer).not.toHaveBeenCalled()
    expect(queryStack()).toHaveLength(2)
  })

  it('target 在所有层 DOM 之外 → 只关最上层的 dismissOnOutside 层（一次交互一层）', () => {
    const escPop = vi.fn()
    const escMenu = vi.fn()
    openLayer('pop', { kind: 'popover', element: dom(), onEsc: escPop, dismissOnOutside: true })
    openLayer('menu', { kind: 'menu', element: dom(), onEsc: escMenu, dismissOnOutside: true })
    expect(handleOutsidePress(dom())).toBe('menu')
    expect(escMenu).toHaveBeenCalledTimes(1)
    expect(escPop).not.toHaveBeenCalled()
    expect(queryStack().map((entry) => entry.id)).toEqual(['pop'])
  })

  it('最上层为模态层（dismissOnOutside=false）→ outside 永不关它，只关其下最近的可关层', () => {
    const escDialog = vi.fn()
    const escPop = vi.fn()
    openLayer('pop', { kind: 'popover', element: dom(), onEsc: escPop, dismissOnOutside: true })
    openLayer('dialog', { kind: 'dialog', element: dom(), onEsc: escDialog, dismissOnOutside: false })
    expect(handleOutsidePress(dom())).toBe('pop')
    expect(escDialog).not.toHaveBeenCalled()
    expect(escPop).toHaveBeenCalledTimes(1)
    expect(queryStack().map((entry) => entry.id)).toEqual(['dialog'])
  })

  it('全部层 dismissOnOutside=false → outside 不关任何层', () => {
    const onEsc = vi.fn()
    openLayer('dialog', { kind: 'dialog', element: dom(), onEsc, dismissOnOutside: false })
    expect(handleOutsidePress(dom())).toBeNull()
    expect(onEsc).not.toHaveBeenCalled()
    expect(queryStack()).toHaveLength(1)
  })

  it('未提供 element 的层视为无 DOM 保护：任意目标都算层外', () => {
    const onEsc = vi.fn()
    openLayer('pop', { kind: 'popover', onEsc, dismissOnOutside: true })
    expect(handleOutsidePress(dom())).toBe('pop')
    expect(onEsc).toHaveBeenCalledTimes(1)
  })

  it('element 支持 getter（React ref 延迟挂载）：getter 返回节点后命中判定生效', () => {
    let node: FakeDomNode | null = null
    const onEsc = vi.fn()
    openLayer('pop', { kind: 'popover', element: () => node, onEsc, dismissOnOutside: true })
    expect(handleOutsidePress(dom())).toBe('pop')
    expect(onEsc).toHaveBeenCalledTimes(1)
    const closeAgain = openLayer('pop2', { kind: 'popover', element: () => node, onEsc, dismissOnOutside: true })
    node = dom()
    const child = dom(node)
    expect(handleOutsidePress(child)).toBeNull()
    expect(queryStack()).toHaveLength(1)
    closeAgain()
  })

  it('target=null 按 DOM 语义（contains(null)=false）视为层外', () => {
    const onEsc = vi.fn()
    openLayer('pop', { kind: 'popover', element: dom(), onEsc, dismissOnOutside: true })
    expect(handleOutsidePress(null)).toBe('pop')
  })
})
