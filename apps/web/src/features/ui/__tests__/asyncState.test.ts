import { describe, expect, it, vi } from 'vitest'
import {
  isUsable,
  mapData,
  makeCancelled,
  makeEmpty,
  makeFailed,
  makeLoading,
  makeReady,
  makeUnavailable,
  type AsyncSnapshot,
} from '../asyncState'

/**
 * AsyncSnapshot 六态契约测试（Wave A0-3，grok-bot Donor Map A4）。
 * 环境说明：本项目 vitest 走 node 环境（无 jsdom）；本模块纯函数零依赖，无需任何 stub。
 */

describe('六态构造（A4 冻结顺序：loading / ready / empty / failed / unavailable / cancelled）', () => {
  it('makeLoading：status=loading，不携带 data/error', () => {
    const snapshot = makeLoading()
    expect(snapshot.status).toBe('loading')
    expect(snapshot.data).toBeUndefined()
    expect(snapshot.error).toBeUndefined()
    expect('data' in snapshot).toBe(false)
    expect(snapshot).toEqual({ status: 'loading', at: expect.any(Number) })
  })

  it('makeReady：status=ready 且携带 data，不携带 error', () => {
    const snapshot = makeReady(42)
    expect(snapshot.status).toBe('ready')
    expect(snapshot.data).toBe(42)
    expect('error' in snapshot).toBe(false)
  })

  it('makeEmpty：status=empty（成功但空集，区别于失败）', () => {
    const snapshot = makeEmpty()
    expect(snapshot.status).toBe('empty')
    expect(snapshot.data).toBeUndefined()
    expect(snapshot.error).toBeUndefined()
  })

  it('makeFailed：status=failed，error 承载人类可读原因', () => {
    const snapshot = makeFailed('runtime 响应超时')
    expect(snapshot.status).toBe('failed')
    expect(snapshot.error).toBe('runtime 响应超时')
    expect('data' in snapshot).toBe(false)
  })

  it('makeUnavailable：能力本身不可用（如 runtime 未连接），原因写入 error 字段', () => {
    const snapshot = makeUnavailable('runtime 未连接')
    expect(snapshot.status).toBe('unavailable')
    expect(snapshot.error).toBe('runtime 未连接')
    expect(snapshot.data).toBeUndefined()
  })

  it('makeCancelled：请求已发出但被新请求取代，不是失败', () => {
    const snapshot = makeCancelled()
    expect(snapshot.status).toBe('cancelled')
    expect(snapshot.error).toBeUndefined()
    expect(snapshot.data).toBeUndefined()
  })

  it('每个构造快照都盖 at 时间戳（Date.now，ms）', () => {
    const before = Date.now()
    const ready = makeReady('x')
    const loading = makeLoading()
    expect(ready.at).toBeGreaterThanOrEqual(before)
    expect(loading.at).toBeGreaterThanOrEqual(before)
  })
})

describe('isUsable 判定（只有 ready 且有数据才可直接消费）', () => {
  it('六态逐一判定：仅 ready+data 为 true，empty 亦为 false（空态走空态 UI）', () => {
    expect(isUsable(makeReady('data'))).toBe(true)
    expect(isUsable(makeLoading())).toBe(false)
    expect(isUsable(makeEmpty())).toBe(false)
    expect(isUsable(makeFailed('err'))).toBe(false)
    expect(isUsable(makeUnavailable('runtime 未连接'))).toBe(false)
    expect(isUsable(makeCancelled())).toBe(false)
  })

  it('类型收窄：usable 分支内 data 保证存在可安全访问', () => {
    const snapshot: AsyncSnapshot<string> = makeReady('hello')
    if (isUsable(snapshot)) {
      expect(snapshot.data.length).toBe(5)
    } else {
      throw new Error('ready 快照必须 usable')
    }
  })
})

describe('mapData（functor 语义：只映射 ready 态数据）', () => {
  it('ready 快照映射数据，status 与 at 保持不变', () => {
    const ready = makeReady(2)
    const doubled = mapData(ready, (n) => n * 2)
    expect(doubled.status).toBe('ready')
    expect(doubled.data).toBe(4)
    expect(doubled.at).toBe(ready.at)
  })

  it('非 ready 五态原样返回且映射函数不被调用', () => {
    const fn = vi.fn((n: number) => n + 1)
    expect(mapData(makeLoading(), fn).status).toBe('loading')
    expect(mapData(makeEmpty(), fn).status).toBe('empty')
    expect(mapData(makeFailed('e'), fn).status).toBe('failed')
    expect(mapData(makeUnavailable('runtime 未连接'), fn).status).toBe('unavailable')
    expect(mapData(makeCancelled(), fn).status).toBe('cancelled')
    expect(fn).not.toHaveBeenCalled()
  })

  it('failed 态映射后 error 语义保留（不被映射污染）', () => {
    const mapped = mapData(makeFailed('boom'), (s: string) => s.toUpperCase())
    expect(mapped.status).toBe('failed')
    expect(mapped.error).toBe('boom')
  })
})
