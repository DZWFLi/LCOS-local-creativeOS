import { readFileSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ProjectHandoffPackV1, ProjectReceiverBindingV1 } from '@local-creative-os/contracts'
import type { LocalCoreClient, RuntimeCall } from '../src/runtime/localCoreClient'
import { createLocalCoreClient } from '../src/runtime/localCoreClient'
import { applyHandoffPrefixToInstruction, buildHandoffInstructionPrefix, handoffSurfaceKindFromSurfaceId, receiverSiteMismatch, resolveHandoffPrefix } from '../src/features/shell/receiverHandoff'
import { ReceiverHandoffConfirmCard, switchReceiverConversation } from '../src/features/shell/ReceiverSwitcher'

const noop = (): void => {}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

function packFixture(overrides: Partial<ProjectHandoffPackV1> = {}): ProjectHandoffPackV1 {
  return {
    schemaVersion: 1,
    projectId: 'project-1',
    fromConversationId: 'cc-1',
    toConversationId: 'cc-2',
    surface: { kind: 'main', surfaceId: 'workspace-main' },
    selectionEntityIds: ['view-brief', 'view-board'],
    createdAt: '2026-08-25T12:00:00.000Z',
    consumedAt: null,
    ...overrides,
  }
}

function okCall<T>(value: T): RuntimeCall<T> {
  return { result: { ok: true, value }, origin: 'runtime', latencyMs: 1, requestedAt: '2026-08-25T12:00:00.000Z' }
}

function failCall<T>(message: string): RuntimeCall<T> {
  return {
    result: { ok: false, error: { code: 'CONFLICT', message, retryable: false, origin: 'runtime' } },
    origin: 'runtime', latencyMs: 1, requestedAt: '2026-08-25T12:00:00.000Z',
  }
}

describe('RECEIVER-3 承接确认小卡（DoD ③：承接前摘要可见）', () => {
  it('渲染 from → to + surface + 选中数 + 未完成事项', () => {
    const html = renderToStaticMarkup(<ReceiverHandoffConfirmCard
      fromLabel="GUI 收口"
      toLabel="会话二"
      surfaceKind="context"
      selectionCount={3}
      pendingReviewCount={2}
      siteMismatch={null}
      busy={false}
      onConfirm={noop}
      onCancel={noop}
    />)
    expect(html).toContain('data-testid="lcos-receiver-handoff-confirm"')
    expect(html).toContain('GUI 收口')
    expect(html).toContain('会话二')
    expect(html).toContain('切换时现场：上下文')
    expect(html).toContain('选中对象：3 项')
    expect(html).toContain('未完成事项：2 项待确认的返回结果')
    // 确认/取消双按钮 + 零副作用承诺文案
    expect(html).toContain('确认切换')
    expect(html).toContain('取消')
    expect(html).toContain('不会自动发送任何消息')
  })

  it('无前手（首次承接）与无未完成事项的形态', () => {
    const html = renderToStaticMarkup(<ReceiverHandoffConfirmCard
      fromLabel={null}
      toLabel="会话二"
      surfaceKind="main"
      selectionCount={0}
      pendingReviewCount={0}
      siteMismatch={null}
      busy={false}
      onConfirm={noop}
      onCancel={noop}
    />)
    expect(html).toContain('首次承接，无前手')
    expect(html).toContain('切换时现场：主画布')
    expect(html).toContain('选中对象：0 项')
    expect(html).not.toContain('未完成事项')
  })

  it('现场快照不可用时如实标注降级（不造假字段）', () => {
    const html = renderToStaticMarkup(<ReceiverHandoffConfirmCard
      fromLabel="GUI 收口"
      toLabel="会话二"
      surfaceKind={null}
      selectionCount={0}
      pendingReviewCount={0}
      siteMismatch={null}
      busy={false}
      onConfirm={noop}
      onCancel={noop}
    />)
    expect(html).toContain('切换时现场：不可用')
  })

  it('RECEIVER-6：施工现场不同 → 确认卡出现提醒（当前/目标 + 不自动 checkout 承诺）', () => {
    const html = renderToStaticMarkup(<ReceiverHandoffConfirmCard
      fromLabel="GUI 收口"
      toLabel="会话二"
      surfaceKind="main"
      selectionCount={0}
      pendingReviewCount={0}
      siteMismatch={{ current: 'feat/context-surface', target: 'fix/windows-runtime' }}
      busy={false}
      onConfirm={noop}
      onCancel={noop}
    />)
    expect(html).toContain('data-testid="lcos-receiver-site-mismatch"')
    expect(html).toContain('施工现场不同')
    expect(html).toContain('feat/context-surface')
    expect(html).toContain('fix/windows-runtime')
    expect(html).toContain('不会自动 checkout')
    // 只提醒：确认按钮仍是普通切换确认，没有额外 merge/checkout 动作词。
    expect(html).toContain('确认切换')
  })
})

describe('RECEIVER-6 施工现场对比纯函数（43I.2）', () => {
  const conversation = (branchRef: string | null, workspaceRef: string | null = null) => ({
    schemaVersion: 1 as const,
    id: 'cc-x',
    projectId: 'project-1',
    provider: 'codex' as const,
    executorId: 'codex-gui',
    conversationRef: 'ref-x',
    label: '会话 X',
    isRunning: false,
    waitingReason: null,
    lastActiveAt: '2026-08-25T12:00:00.000Z',
    workspaceRef,
    branchRef,
    createdAt: '2026-08-20T12:00:00.000Z',
    updatedAt: '2026-08-25T12:00:00.000Z',
  })

  it('branchRef 不一致 → { current, target }', () => {
    expect(receiverSiteMismatch(conversation('feat/context-surface'), conversation('fix/windows-runtime')))
      .toEqual({ current: 'feat/context-surface', target: 'fix/windows-runtime' })
  })

  it('branchRef 相同 → null（不打扰）', () => {
    expect(receiverSiteMismatch(conversation('feat/a'), conversation('feat/a'))).toBeNull()
  })

  it('无 branch 时回退 workspaceRef 对比；信息不足（任一侧全空 / 无 active）→ null', () => {
    expect(receiverSiteMismatch(conversation(null, 'ws-main'), conversation(null, 'ws-runtime')))
      .toEqual({ current: 'ws-main', target: 'ws-runtime' })
    expect(receiverSiteMismatch(conversation(null, 'ws-main'), conversation(null))).toBeNull()
    expect(receiverSiteMismatch(null, conversation('feat/a'))).toBeNull()
    expect(receiverSiteMismatch(conversation('feat/a'), null)).toBeNull()
  })
})

describe('RECEIVER-3 确认切换行为（DoD ①：切换零副作用）', () => {
  it('确认后先 setActiveReceiver 后 prepareHandoff（两调用顺序），且绝不触发任何 send/run', async () => {
    const setActiveReceiver = vi.fn(async (): Promise<RuntimeCall<ProjectReceiverBindingV1>> => okCall({ schemaVersion: 1, projectId: 'project-1', connectedConversationIds: ['cc-1', 'cc-2'], activeReceiverId: 'cc-2', revision: 2 }))
    const prepareReceiverHandoff = vi.fn(async (): Promise<RuntimeCall<ProjectHandoffPackV1>> => okCall(packFixture()))
    const createRuntimeRun = vi.fn()
    const proposeRun = vi.fn()
    const dispatchRuntimeRun = vi.fn()
    const client = { setActiveReceiver, prepareReceiverHandoff, createRuntimeRun, proposeRun, dispatchRuntimeRun } as unknown as LocalCoreClient

    const call = await switchReceiverConversation(client, 'project-1', 'cc-2', {
      fromConversationId: 'cc-1',
      surface: { kind: 'main', surfaceId: 'workspace-main' },
      selectionEntityIds: ['view-brief', 'view-board'],
    })

    expect(call.result.ok).toBe(true)
    expect(setActiveReceiver).toHaveBeenCalledTimes(1)
    expect(setActiveReceiver).toHaveBeenCalledWith('project-1', 'cc-2')
    expect(prepareReceiverHandoff).toHaveBeenCalledTimes(1)
    expect(prepareReceiverHandoff).toHaveBeenCalledWith('project-1', {
      fromConversationId: 'cc-1',
      toConversationId: 'cc-2',
      surface: { kind: 'main', surfaceId: 'workspace-main' },
      selectionEntityIds: ['view-brief', 'view-board'],
    })
    // 顺序断言：切换（承接关系生效）在前，快照准备在后。
    expect(setActiveReceiver.mock.invocationCallOrder[0]).toBeLessThan(prepareReceiverHandoff.mock.invocationCallOrder[0])
    // DoD ① 红线：除 setActiveReceiver + prepareHandoff 外零 mutation。
    expect(createRuntimeRun).not.toHaveBeenCalled()
    expect(proposeRun).not.toHaveBeenCalled()
    expect(dispatchRuntimeRun).not.toHaveBeenCalled()
  })

  it('setActiveReceiver 失败时不 prepare（切换没发生，快照不准备）', async () => {
    const setActiveReceiver = vi.fn(async (): Promise<RuntimeCall<ProjectReceiverBindingV1>> => failCall('Receiver binding update failed.'))
    const prepareReceiverHandoff = vi.fn()
    const client = { setActiveReceiver, prepareReceiverHandoff } as unknown as LocalCoreClient

    const call = await switchReceiverConversation(client, 'project-1', 'cc-2', { fromConversationId: 'cc-1', surface: { kind: 'main', surfaceId: 'w' }, selectionEntityIds: [] })
    expect(call.result.ok).toBe(false)
    expect(prepareReceiverHandoff).not.toHaveBeenCalled()
  })

  it('prepare 失败时错误原样带回（切换已生效，快照缺失降级为无注入）', async () => {
    const client = {
      setActiveReceiver: vi.fn(async (): Promise<RuntimeCall<ProjectReceiverBindingV1>> => okCall({ schemaVersion: 1, projectId: 'project-1', connectedConversationIds: [], activeReceiverId: 'cc-2', revision: 2 })),
      prepareReceiverHandoff: vi.fn(async (): Promise<RuntimeCall<ProjectHandoffPackV1>> => failCall('Receiver handoff prepare failed.')),
    } as unknown as LocalCoreClient
    const call = await switchReceiverConversation(client, 'project-1', 'cc-2', { fromConversationId: 'cc-1', surface: { kind: 'main', surfaceId: 'w' }, selectionEntityIds: [] })
    expect(call.result.ok).toBe(false)
    expect(call.result.ok === false && call.result.error.message).toBe('Receiver handoff prepare failed.')
  })

  it('取消不调用：取消只清确认态，不触碰 client（源码契约 + 静态结构双断言）', () => {
    const readSource = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8').replaceAll('\r\n', '\n')
    const switcher = readSource('../src/features/shell/ReceiverSwitcher.tsx')
    // 取消回调只做 setConfirmSwitchId(null)（零 client 调用）。
    expect(switcher).toContain('onCancel={() => { setConfirmSwitchId(null) }}')
    // 切换只从确认按钮发起；点选会话行只进入确认态。
    expect(switcher).toContain('onClick={() => { setConfirmSwitchId(conversation.id) }}')
    expect(switcher).toContain('onConfirm={() => { void handleConfirmSwitch() }}')
    const html = renderToStaticMarkup(<ReceiverHandoffConfirmCard fromLabel="GUI 收口" toLabel="会话二" surfaceKind="main" selectionCount={1} pendingReviewCount={0} siteMismatch={null} busy={false} onConfirm={noop} onCancel={noop} />)
    expect(html).toContain('取消')
  })
})

describe('RECEIVER-3 注入前缀纯函数（DoD ②：首条消息含 Handoff 前缀）', () => {
  it('buildHandoffInstructionPrefix：前手标签 + surface + 选中标题列表', () => {
    const prefix = buildHandoffInstructionPrefix(packFixture(), 'GUI 收口', ['产品简报', '竞品分析'])
    expect(prefix).toBe('[承接上下文] 从「GUI 收口」切换而来；切换时现场：主画布；选中对象：产品简报、竞品分析')
  })

  it('from=null → 首次承接；无选中 → 「无」；surface 三类中文标签', () => {
    expect(buildHandoffInstructionPrefix(packFixture({ fromConversationId: null }), null, [])).toBe('[承接上下文] 首次承接（无前手会话）；切换时现场：主画布；选中对象：无')
    expect(buildHandoffInstructionPrefix(packFixture({ surface: { kind: 'context', surfaceId: 'c1' } }), '会话一', ['A'])).toContain('切换时现场：上下文')
    expect(buildHandoffInstructionPrefix(packFixture({ surface: { kind: 'workflow', surfaceId: 'w1' } }), '会话一', ['A'])).toContain('切换时现场：工作流')
  })

  it('applyHandoffPrefixToInstruction：前缀行 + 用户原指令（首条消息的最终形态）', () => {
    const instruction = applyHandoffPrefixToInstruction('[承接上下文] 从「GUI 收口」切换而来；切换时现场：主画布；选中对象：A、B', '帮我把这两份材料合并成简报')
    expect(instruction).toBe('[承接上下文] 从「GUI 收口」切换而来；切换时现场：主画布；选中对象：A、B\n帮我把这两份材料合并成简报')
  })

  it('resolveHandoffPrefix：pending=null（已消费/从未准备）→ 不注入（幂等）', () => {
    expect(resolveHandoffPrefix(null, 'GUI 收口', ['A'])).toBeNull()
    expect(resolveHandoffPrefix(packFixture(), 'GUI 收口', ['A'])).toBe('[承接上下文] 从「GUI 收口」切换而来；切换时现场：主画布；选中对象：A')
  })

  it('handoffSurfaceKindFromSurfaceId：SurfaceId → main/context/workflow 三类投影', () => {
    expect(handoffSurfaceKindFromSurfaceId('arrange')).toBe('main')
    expect(handoffSurfaceKindFromSurfaceId('outline')).toBe('context')
    expect(handoffSurfaceKindFromSurfaceId('context-space')).toBe('context')
    expect(handoffSurfaceKindFromSurfaceId('context-graph')).toBe('context')
    expect(handoffSurfaceKindFromSurfaceId('workflow')).toBe('workflow')
    expect(handoffSurfaceKindFromSurfaceId('deliver')).toBe('workflow')
  })
})

describe('RECEIVER-3 client REST 接线（receiver-handoff 三端点）', () => {
  function stubFetch(value: unknown, status = 200): ReturnType<typeof vi.fn> {
    return vi.fn(async (_input: string, _init?: RequestInit) => new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } }))
  }

  it('prepareReceiverHandoff POST 到 receiver-handoff，body 带 from/to/surface/selection', async () => {
    const fetchMock = stubFetch({ ok: true, value: packFixture() })
    vi.stubGlobal('fetch', fetchMock)
    const result = await createLocalCoreClient().prepareReceiverHandoff('project-1', {
      fromConversationId: 'cc-1',
      toConversationId: 'cc-2',
      surface: { kind: 'main', surfaceId: 'workspace-main' },
      selectionEntityIds: ['view-brief'],
    })
    expect(fetchMock).toHaveBeenCalledWith('/api/local-core/v1/projects/project-1/receiver-handoff', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ fromConversationId: 'cc-1', toConversationId: 'cc-2', surface: { kind: 'main', surfaceId: 'workspace-main' }, selectionEntityIds: ['view-brief'] }),
    }))
    expect(result.result).toEqual({ ok: true, value: packFixture() })
  })

  it('getPendingReceiverHandoff GET 到 receiver-handoff/:conversationId（pending 为 null 时原样解码）', async () => {
    const fetchMock = stubFetch({ ok: true, value: null })
    vi.stubGlobal('fetch', fetchMock)
    const result = await createLocalCoreClient().getPendingReceiverHandoff('project-1', 'cc-2')
    expect(fetchMock).toHaveBeenCalledWith('/api/local-core/v1/projects/project-1/receiver-handoff/cc-2', expect.objectContaining({ signal: expect.any(AbortSignal) }))
    expect(result.result).toEqual({ ok: true, value: null })
  })

  it('consumeReceiverHandoff POST 到 receiver-handoff/:conversationId/consume', async () => {
    const fetchMock = stubFetch({ ok: true, value: packFixture({ consumedAt: '2026-08-25T12:01:00.000Z' }) })
    vi.stubGlobal('fetch', fetchMock)
    const result = await createLocalCoreClient().consumeReceiverHandoff('project-1', 'cc-2')
    expect(fetchMock).toHaveBeenCalledWith('/api/local-core/v1/projects/project-1/receiver-handoff/cc-2/consume', expect.objectContaining({ method: 'POST' }))
    expect(result.result.ok).toBe(true)
  })
})

describe('RECEIVER-3 发送链注入接线（源码契约：App.tsx 组装处）', () => {
  it('startRunFrom 发送前查 pending → resolveHandoffPrefix 注入 → Run 创建成功后 consume', () => {
    const readSource = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8').replaceAll('\r\n', '\n')
    const app = readSource('../src/App.tsx')
    expect(app).toContain('RECEIVER-3 next-send injection')
    expect(app).toContain('getPendingReceiverHandoff(activeProjectId, activeReceiverId)')
    expect(app).toContain('resolveHandoffPrefix(pending, fromLabel, selectionTitles)')
    expect(app).toContain('applyHandoffPrefixToInstruction(handoffPrefix, command)')
    expect(app).toContain('consumeReceiverHandoff(activeProjectId, activeReceiverId)')
    // Run 创建成功后才消费（失败保持 pending，下次发送重试注入）。
    expect(app).toContain('if (handoffConsume !== null) void handoffConsume()')
  })

  it('App 透传真实切换现场给 Chip（surface=当前视图、selection=当前选中、pending=待确认数）', () => {
    const readSource = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8').replaceAll('\r\n', '\n')
    const app = readSource('../src/App.tsx')
    expect(app).toContain('handoffSurfaceKindFromSurfaceId(activeSurface)')
    expect(app).toContain('selectionEntityIds: selectedIds')
    expect(app).toContain('pendingReviewCount: pendingReviews.length')
    expect(app).toContain('handoffContext={receiverHandoffContext}')
  })
})
