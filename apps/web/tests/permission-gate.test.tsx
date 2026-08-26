import { readFileSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { evaluateRunPermission } from '../src/features/workflow/permissionGate'
import { PermissionConfirmCard } from '../src/features/workflow/PermissionConfirmCard'

const readSource = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8').replaceAll('\r\n', '\n')
const noop = (): void => {}

describe('权限门纯函数 evaluateRunPermission（第一梯队 ⑥）', () => {
  it('读意图 analyze → 白名单静默放行（读操作零打扰）', () => {
    expect(evaluateRunPermission({ outputIntent: 'analyze', instruction: '总结这份文档', contextTitles: ['需求文档'] }))
      .toEqual({ kind: 'allow' })
  })

  it('写意图 create → confirm：title 固定，items=涉及对象清单', () => {
    const decision = evaluateRunPermission({ outputIntent: 'create', instruction: '基于参考生成大纲', contextTitles: ['需求文档', '访谈记录'] })
    expect(decision.kind).toBe('confirm')
    if (decision.kind !== 'confirm') return
    expect(decision.title).toBe('Agent 将执行写操作')
    expect(decision.items).toEqual(['需求文档', '访谈记录'])
  })

  it('写意图 revise → confirm（修改目标同样是写操作）', () => {
    const decision = evaluateRunPermission({ outputIntent: 'revise', instruction: '改写第二段', contextTitles: ['草稿 v2'] })
    expect(decision.kind).toBe('confirm')
    if (decision.kind !== 'confirm') return
    expect(decision.items).toEqual(['草稿 v2'])
  })

  it('空/空白 contextTitles → 兜底「当前项目」；未知意图 fail-closed 也走 confirm', () => {
    expect(evaluateRunPermission({ outputIntent: 'create', instruction: '新建看板', contextTitles: [] }))
      .toEqual({ kind: 'confirm', title: 'Agent 将执行写操作', items: ['当前项目'] })
    expect(evaluateRunPermission({ outputIntent: 'create', instruction: '新建看板', contextTitles: ['   ', ''] }).kind).toBe('confirm')
    expect(evaluateRunPermission({ outputIntent: 'sync', instruction: 'x', contextTitles: ['A'] }).kind).toBe('confirm')
  })

  it('纯函数零依赖（无 import，不耦合运行时）', () => {
    expect(readSource('../src/features/workflow/permissionGate.ts')).not.toMatch(/^\s*import\s/m)
  })
})

describe('权限确认卡 PermissionConfirmCard（renderToStaticMarkup）', () => {
  it('渲染 title + 对象清单 + 说明文案 + 取消/确认执行两键', () => {
    const markup = renderToStaticMarkup(<PermissionConfirmCard title="Agent 将执行写操作" items={['需求文档', '访谈记录']} onConfirm={noop} onCancel={noop} />)
    expect(markup).toContain('Agent 将执行写操作')
    expect(markup).toContain('需求文档')
    expect(markup).toContain('访谈记录')
    expect(markup).toContain('确认后 Agent 开始执行；取消则本次任务不发起。')
    expect(markup).toContain('取消')
    expect(markup).toContain('确认执行')
    // 空清单由判定层兜底为「当前项目」，卡片如实渲染兜底项
    const fallback = renderToStaticMarkup(<PermissionConfirmCard title="Agent 将执行写操作" items={['当前项目']} onConfirm={noop} onCancel={noop} />)
    expect(fallback).toContain('当前项目')
  })

  it('复用 ConfirmDialog 浮层协议：backdrop dismiss + role=dialog，不另造浮层体系', () => {
    const card = readSource('../src/features/workflow/PermissionConfirmCard.tsx')
    expect(card).toContain('dismissFromBackdrop')
    expect(card).toContain('role="dialog"')
    expect(card).toContain('aria-modal="true"')
  })
})

describe('App 接线契约（源码断言：startRunFrom 统一过门）', () => {
  const app = readSource('../src/App.tsx')

  it('startRunFrom 发送前调 evaluateRunPermission：allow 直发原链（读静默）', () => {
    const gateStart = app.indexOf('const startRunFrom = useCallback')
    expect(gateStart).toBeGreaterThan(-1)
    const gateEnd = app.indexOf('}, [executeRunFrom, nodes])', gateStart)
    const gateBody = app.slice(gateStart, gateEnd)
    expect(gateBody).toContain('evaluateRunPermission({ outputIntent: intent, instruction: command')
    expect(gateBody).toContain("if (permission.kind === 'allow')")
    expect(gateBody).toContain('return executeRunFrom(')
  })

  it('取消路径不发起：cancel 处理器只 resolve(undefined)，不触碰发送链', () => {
    const cancelStart = app.indexOf('const cancelPendingPermissionRun = useCallback')
    expect(cancelStart).toBeGreaterThan(-1)
    const cancelEnd = app.indexOf('}, [pendingPermissionRun, setNotice])', cancelStart)
    const cancelBody = app.slice(cancelStart, cancelEnd)
    expect(cancelBody).toContain('pending.resolve(undefined)')
    expect(cancelBody).toContain('已取消，未发起任务')
    expect(cancelBody).not.toContain('executeRunFrom')
    expect(cancelBody).not.toContain('createRuntimeRun')
  })

  it('确认后才进入原发送链：confirm 处理器调 executeRunFrom；createRuntimeRun 只存在于 executeRunFrom 内', () => {
    const confirmStart = app.indexOf('const confirmPendingPermissionRun = useCallback')
    expect(confirmStart).toBeGreaterThan(-1)
    const confirmEnd = app.indexOf('}, [executeRunFrom, pendingPermissionRun])', confirmStart)
    const confirmBody = app.slice(confirmStart, confirmEnd)
    expect(confirmBody).toContain('executeRunFrom(')
    expect(confirmBody).not.toContain('createRuntimeRun')
    // createRuntimeRun 在 App.tsx 中仅出现一次（原发送链内部），发送链外零直接调用
    expect(app.split('createRuntimeRun(').length - 1).toBe(1)
  })

  it('确认卡挂载在 extraDialogs，pending 非 null 才渲染（useState open + pending payload 模式）', () => {
    expect(app).toContain('{pendingPermissionRun !== null ? <PermissionConfirmCard')
    expect(app).toContain('onConfirm={confirmPendingPermissionRun}')
    expect(app).toContain('onCancel={cancelPendingPermissionRun}')
  })
})

describe('同族破坏性操作补确认：SurfaceDock 并回清空现场', () => {
  it('并回按钮先经 ConfirmDialog 确认（确认文案含「并回主画布并清空当前现场？」）', () => {
    const dock = readSource('../src/features/shell/SurfaceDock.tsx')
    expect(dock).toContain('setConfirmMergeOpen(true)')
    expect(dock).toContain('并回主画布并清空当前现场？')
    expect(dock).not.toContain('onClick={onMergeWorkbench}')
  })
})
