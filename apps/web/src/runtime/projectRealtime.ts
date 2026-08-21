import type { ProjectEventEnvelope, ProjectEventSnapshotV1 } from '@local-creative-os/contracts'

import type { LocalCoreClient } from './localCoreClient'

export type ProjectRealtimeState = 'connecting' | 'synced' | 'recovering' | 'offline'

export interface ProjectRealtimeMessage {
  readonly kind: 'snapshot' | 'event'
  readonly snapshot?: ProjectEventSnapshotV1
  readonly event?: ProjectEventEnvelope
}

type CoordinationMessage =
  | { readonly kind: 'heartbeat'; readonly senderId: string; readonly runtimeId?: string; readonly lastSeenProjectSeq?: number; readonly state: ProjectRealtimeState }
  | { readonly kind: 'snapshot'; readonly senderId: string; readonly snapshot: ProjectEventSnapshotV1 }
  | { readonly kind: 'event'; readonly senderId: string; readonly event: ProjectEventEnvelope }

interface SharedRuntime {
  readonly projectId: string
  readonly client: LocalCoreClient
  readonly listeners: Set<(message: ProjectRealtimeMessage) => void>
  readonly stateListeners: Set<(state: ProjectRealtimeState) => void>
  readonly tabId: string
  controller: AbortController | null
  retryTimer: number | null
  retryAttempt: number
  runtimeId?: string
  lastSeenProjectSeq?: number
  lastSnapshot?: ProjectEventSnapshotV1
  state: ProjectRealtimeState
  channel: BroadcastChannel | null
  role: 'leader' | 'follower' | 'fallback'
  electionTimer: number | null
  heartbeatTimer: number | null
  lastLeaderHeartbeat: number
  electionPending: boolean
  releaseLeadership: (() => void) | null
}

const runtimes = new Map<string, SharedRuntime>()
const HEARTBEAT_MS = 1_000
const LEADER_STALE_MS = 3_500

function notifyState(runtime: SharedRuntime, state: ProjectRealtimeState): void {
  if (runtime.state === state) return
  runtime.state = state
  for (const listener of runtime.stateListeners) listener(state)
}

function publish(runtime: SharedRuntime, message: CoordinationMessage): void {
  runtime.channel?.postMessage(message)
}

function acceptEvent(runtime: SharedRuntime, event: ProjectEventEnvelope): boolean {
  if (runtime.runtimeId !== undefined && event.runtimeId !== runtime.runtimeId) {
    runtime.runtimeId = undefined
    runtime.lastSeenProjectSeq = undefined
    runtime.controller?.abort()
    notifyState(runtime, 'recovering')
    return false
  }
  const lastSeen = runtime.lastSeenProjectSeq
  if (lastSeen !== undefined && event.projectSeq <= lastSeen) return false
  if (lastSeen !== undefined && event.projectSeq !== lastSeen + 1) {
    runtime.controller?.abort()
    notifyState(runtime, 'recovering')
    return false
  }
  runtime.runtimeId = event.runtimeId
  runtime.lastSeenProjectSeq = event.projectSeq
  for (const subscriber of runtime.listeners) subscriber({ kind: 'event', event })
  return true
}

function broadcastHeartbeat(runtime: SharedRuntime): void {
  publish(runtime, {
    kind: 'heartbeat',
    senderId: runtime.tabId,
    runtimeId: runtime.runtimeId,
    lastSeenProjectSeq: runtime.lastSeenProjectSeq,
    state: runtime.state,
  })
}

function startPhysicalStream(runtime: SharedRuntime): void {
  if (runtime.controller !== null || runtime.listeners.size === 0 || runtime.role === 'follower') return
  const controller = new AbortController()
  runtime.controller = controller
  notifyState(runtime, runtime.lastSeenProjectSeq === undefined ? 'connecting' : 'recovering')
  void runtime.client.streamProjectEvents(runtime.projectId, {
    runtimeId: runtime.runtimeId,
    lastSeenProjectSeq: runtime.lastSeenProjectSeq,
  }, {
    onSnapshot: (snapshot) => {
      runtime.runtimeId = snapshot.runtimeId
      runtime.lastSeenProjectSeq = snapshot.currentSeq
      runtime.lastSnapshot = snapshot
      runtime.retryAttempt = 0
      for (const subscriber of runtime.listeners) subscriber({ kind: 'snapshot', snapshot })
      publish(runtime, { kind: 'snapshot', senderId: runtime.tabId, snapshot })
      notifyState(runtime, 'synced')
      broadcastHeartbeat(runtime)
    },
    onReplay: (replay) => {
      runtime.runtimeId = replay.runtimeId
      for (const event of replay.events) {
        if (acceptEvent(runtime, event)) publish(runtime, { kind: 'event', senderId: runtime.tabId, event })
      }
      runtime.lastSeenProjectSeq = Math.max(runtime.lastSeenProjectSeq ?? 0, replay.currentSeq)
      runtime.retryAttempt = 0
      notifyState(runtime, 'synced')
      broadcastHeartbeat(runtime)
    },
    onEvent: (event) => {
      if (acceptEvent(runtime, event)) publish(runtime, { kind: 'event', senderId: runtime.tabId, event })
      notifyState(runtime, 'synced')
      broadcastHeartbeat(runtime)
    },
  }, controller.signal).catch(() => undefined).finally(() => {
    if (runtime.controller !== controller) return
    runtime.controller = null
    if (controller.signal.aborted && (runtime.listeners.size === 0 || runtime.role === 'follower')) return
    notifyState(runtime, 'recovering')
    const jitter = 0.8 + Math.random() * 0.4
    const delay = Math.min(30_000, 250 * (2 ** runtime.retryAttempt++)) * jitter
    runtime.retryTimer = window.setTimeout(() => {
      runtime.retryTimer = null
      startPhysicalStream(runtime)
    }, delay)
  })
}

function becomeLeader(runtime: SharedRuntime): void {
  runtime.role = 'leader'
  runtime.lastLeaderHeartbeat = Date.now()
  if (runtime.heartbeatTimer !== null) window.clearInterval(runtime.heartbeatTimer)
  runtime.heartbeatTimer = window.setInterval(() => broadcastHeartbeat(runtime), HEARTBEAT_MS)
  broadcastHeartbeat(runtime)
  startPhysicalStream(runtime)
}

function tryBecomeLeader(runtime: SharedRuntime): void {
  if (runtime.electionPending || runtime.listeners.size === 0 || runtime.role === 'leader') return
  if (typeof navigator === 'undefined' || navigator.locks === undefined) {
    runtime.role = 'fallback'
    startPhysicalStream(runtime)
    return
  }
  runtime.electionPending = true
  void navigator.locks.request(`lcos-project-realtime:${runtime.projectId}`, { ifAvailable: true, mode: 'exclusive' }, async (lock) => {
    runtime.electionPending = false
    if (lock === null || runtime.listeners.size === 0) return
    becomeLeader(runtime)
    await new Promise<void>((resolve) => { runtime.releaseLeadership = resolve })
    runtime.releaseLeadership = null
  }).catch(() => {
    runtime.electionPending = false
    runtime.role = 'fallback'
    startPhysicalStream(runtime)
  })
}

function startCoordination(runtime: SharedRuntime): void {
  if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') {
    runtime.role = 'fallback'
    startPhysicalStream(runtime)
    return
  }
  runtime.channel = new BroadcastChannel(`lcos-project-realtime:${runtime.projectId}`)
  runtime.channel.addEventListener('message', (raw: MessageEvent<CoordinationMessage>) => {
    const message = raw.data
    if (message.senderId === runtime.tabId) return
    if (message.kind === 'heartbeat') {
      runtime.lastLeaderHeartbeat = Date.now()
      if (runtime.role !== 'leader') {
        runtime.role = 'follower'
        runtime.controller?.abort()
        runtime.runtimeId = message.runtimeId
        runtime.lastSeenProjectSeq = message.lastSeenProjectSeq
        notifyState(runtime, message.state)
      }
      return
    }
    if (runtime.role === 'leader') return
    runtime.lastLeaderHeartbeat = Date.now()
    runtime.role = 'follower'
    if (message.kind === 'snapshot') {
      runtime.runtimeId = message.snapshot.runtimeId
      runtime.lastSeenProjectSeq = message.snapshot.currentSeq
      runtime.lastSnapshot = message.snapshot
      for (const subscriber of runtime.listeners) subscriber({ kind: 'snapshot', snapshot: message.snapshot })
      notifyState(runtime, 'synced')
    } else {
      acceptEvent(runtime, message.event)
      notifyState(runtime, 'synced')
    }
  })
  runtime.electionTimer = window.setInterval(() => {
    if (runtime.role === 'leader' || runtime.listeners.size === 0) return
    if (Date.now() - runtime.lastLeaderHeartbeat >= LEADER_STALE_MS) tryBecomeLeader(runtime)
  }, HEARTBEAT_MS)
  tryBecomeLeader(runtime)
}

function stopRuntime(runtime: SharedRuntime): void {
  runtime.controller?.abort()
  if (runtime.retryTimer !== null) window.clearTimeout(runtime.retryTimer)
  if (runtime.electionTimer !== null) window.clearInterval(runtime.electionTimer)
  if (runtime.heartbeatTimer !== null) window.clearInterval(runtime.heartbeatTimer)
  runtime.releaseLeadership?.()
  runtime.channel?.close()
}

export function subscribeProjectRealtime(
  client: LocalCoreClient,
  projectId: string,
  listener: (message: ProjectRealtimeMessage) => void,
  onState?: (state: ProjectRealtimeState) => void,
): () => void {
  let runtime = runtimes.get(projectId)
  if (runtime === undefined) {
    runtime = {
      projectId,
      client,
      listeners: new Set(),
      stateListeners: new Set(),
      tabId: crypto.randomUUID(),
      controller: null,
      retryTimer: null,
      retryAttempt: 0,
      state: 'connecting',
      channel: null,
      role: 'follower',
      electionTimer: null,
      heartbeatTimer: null,
      lastLeaderHeartbeat: 0,
      electionPending: false,
      releaseLeadership: null,
    }
    runtimes.set(projectId, runtime)
  }
  runtime.listeners.add(listener)
  if (onState !== undefined) runtime.stateListeners.add(onState)
  if (runtime.channel === null && runtime.controller === null) startCoordination(runtime)

  return () => {
    runtime!.listeners.delete(listener)
    if (onState !== undefined) runtime!.stateListeners.delete(onState)
    if (runtime!.listeners.size > 0) return
    stopRuntime(runtime!)
    runtimes.delete(projectId)
  }
}

export function realtimeDebugSnapshot(): Record<string, unknown> {
  return Object.fromEntries([...runtimes.entries()].map(([projectId, runtime]) => [projectId, {
    projectId,
    runtimeId: runtime.runtimeId ?? null,
    lastSeenProjectSeq: runtime.lastSeenProjectSeq ?? null,
    connectionState: runtime.state,
    subscribers: runtime.listeners.size,
    physicalStreams: runtime.controller === null ? 0 : 1,
    reconnectCount: runtime.retryAttempt,
    crossTabRole: runtime.role,
    coordinated: runtime.channel !== null,
  }]))
}

if (typeof window !== 'undefined' && import.meta.env.DEV) {
  Object.defineProperty(window, '__LCOS_REALTIME_DEBUG__', { configurable: true, get: realtimeDebugSnapshot })
}
