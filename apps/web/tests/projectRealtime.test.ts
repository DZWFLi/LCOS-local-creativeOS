import { afterEach, describe, expect, it, vi } from 'vitest'

import type { ProjectEventEnvelope, ProjectEventSnapshotV1 } from '@local-creative-os/contracts'

import { realtimeDebugSnapshot, subscribeProjectRealtime } from '../src/runtime/projectRealtime'

describe('Project realtime client', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('shares one physical project stream across multiple surface subscribers', async () => {
    let starts = 0
    let handlers: {
      onSnapshot?: (value: ProjectEventSnapshotV1) => void
      onEvent?: (value: ProjectEventEnvelope) => void
    } = {}
    const client = {
      streamProjectEvents: (_projectId: string, _cursor: unknown, nextHandlers: typeof handlers, signal?: AbortSignal) => {
        starts += 1
        handlers = nextHandlers
        return new Promise<void>((resolve) => signal?.addEventListener('abort', () => resolve(), { once: true }))
      },
    }
    const receivedA: number[] = []
    const receivedB: number[] = []
    const unsubscribeA = subscribeProjectRealtime(client as never, 'project-a', (message) => {
      if (message.event) receivedA.push(message.event.projectSeq)
    })
    const unsubscribeB = subscribeProjectRealtime(client as never, 'project-a', (message) => {
      if (message.event) receivedB.push(message.event.projectSeq)
    })
    expect(starts).toBe(1)
    expect(realtimeDebugSnapshot()['project-a']).toMatchObject({ subscribers: 2, physicalStreams: 1 })
    handlers.onSnapshot?.({ runtimeId: 'runtime-a', projectId: 'project-a', currentSeq: 0, presentations: [], workStates: [] })
    handlers.onEvent?.({ runtimeId: 'runtime-a', projectId: 'project-a', projectSeq: 1, channel: 'presentation', type: 'presentation.changed', timestamp: '', payload: {} })
    expect(receivedA).toEqual([1])
    expect(receivedB).toEqual([1])
    unsubscribeA(); unsubscribeB()
    await Promise.resolve()
    expect(realtimeDebugSnapshot()['project-a']).toBeUndefined()
  })

  it('ignores old events and enters recovery on a sequence gap', () => {
    let handlers: { onSnapshot?: (value: ProjectEventSnapshotV1) => void; onEvent?: (value: ProjectEventEnvelope) => void } = {}
    const states: string[] = []
    const client = { streamProjectEvents: (_p: string, _c: unknown, value: typeof handlers) => { handlers = value; return new Promise<void>(() => undefined) } }
    const unsubscribe = subscribeProjectRealtime(client as never, 'project-gap', () => undefined, (state) => states.push(state))
    handlers.onSnapshot?.({ runtimeId: 'runtime-a', projectId: 'project-gap', currentSeq: 10, presentations: [], workStates: [] })
    handlers.onEvent?.({ runtimeId: 'runtime-a', projectId: 'project-gap', projectSeq: 9, channel: 'run', type: 'run.changed', timestamp: '', payload: {} })
    handlers.onEvent?.({ runtimeId: 'runtime-a', projectId: 'project-gap', projectSeq: 12, channel: 'run', type: 'run.changed', timestamp: '', payload: {} })
    expect(states).toContain('recovering')
    unsubscribe()
  })

  it('uses a cross-tab lock holder as the only physical stream leader', async () => {
    class FakeBroadcastChannel {
      addEventListener(): void {}
      postMessage(): void {}
      close(): void {}
    }
    vi.stubGlobal('window', {
      setInterval,
      clearInterval,
      setTimeout,
      clearTimeout,
    })
    vi.stubGlobal('BroadcastChannel', FakeBroadcastChannel)
    vi.stubGlobal('navigator', {
      locks: {
        request: async (_name: string, _options: unknown, callback: (lock: object) => Promise<void>) => callback({}),
      },
    })
    let starts = 0
    const client = {
      streamProjectEvents: (_projectId: string, _cursor: unknown, _handlers: unknown, signal?: AbortSignal) => {
        starts += 1
        return new Promise<void>((resolve) => signal?.addEventListener('abort', () => resolve(), { once: true }))
      },
    }
    const unsubscribe = subscribeProjectRealtime(client as never, 'project-leader', () => undefined)
    await Promise.resolve()
    expect(starts).toBe(1)
    expect(realtimeDebugSnapshot()['project-leader']).toMatchObject({
      crossTabRole: 'leader',
      coordinated: true,
      physicalStreams: 1,
    })
    unsubscribe()
  })
})
