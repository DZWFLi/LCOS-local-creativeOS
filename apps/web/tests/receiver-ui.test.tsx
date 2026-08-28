import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type { ConnectedConversationV1, ProjectReceiverBindingV1 } from '@local-creative-os/contracts'
import type { LocalCoreClient, RuntimeCall } from '../src/runtime/localCoreClient'
import { isReceiverSessionError } from '../src/runtime/messages'
import { relativeTime } from '../src/features/shell/relativeTime'
import { ReceiverChip, ReceiverChipFace } from '../src/features/shell/ReceiverChip'
import { ReceiverSwitcher, receiverProviderLabel, switchReceiverConversation } from '../src/features/shell/ReceiverSwitcher'

describe('RECEIVER-5 isReceiverSessionError 识别口径（照 browser-harness daemon stale 判定）', () => {
  it('命中一族会话失效特征（中英文）', () => {
    expect(isReceiverSessionError('Session with given id not found')).toBe(true)
    expect(isReceiverSessionError('session not found: abc')).toBe(true)
    expect(isReceiverSessionError('Session expired')).toBe(true)
    expect(isReceiverSessionError('Conversation not found')).toBe(true)
    expect(isReceiverSessionError('conversation does not exist')).toBe(true)
    expect(isReceiverSessionError('会话不存在')).toBe(true)
    expect(isReceiverSessionError('会话已失效')).toBe(true)
    expect(isReceiverSessionError('对话已失效')).toBe(true)
  })
  it('普通 provider/网络错误不误判（stale 是重操作，误判会造成假断开提示）', () => {
    expect(isReceiverSessionError('ECONNREFUSED 127.0.0.1:43121')).toBe(false)
    expect(isReceiverSessionError('timeout of 30000ms exceeded')).toBe(false)
    expect(isReceiverSessionError('authorization failed (401)')).toBe(false)
    expect(isReceiverSessionError('version conflict (409)')).toBe(false)
    expect(isReceiverSessionError(undefined)).toBe(false)
    expect(isReceiverSessionError(null)).toBe(false)
    expect(isReceiverSessionError('')).toBe(false)
  })
})


function conversationFixture(overrides: Partial<ConnectedConversationV1> = {}): ConnectedConversationV1 {
  return {
    schemaVersion: 1,
    id: 'cc-1',
    projectId: 'project-1',
    provider: 'codex',
    executorId: 'executor-1',
    conversationRef: 'ref-1',
    label: 'GUI 收口',
    isRunning: false,
    waitingReason: null,
    lastActiveAt: '2026-08-25T12:00:00.000Z',
    workspaceRef: null,
    branchRef: null,
    createdAt: '2026-08-25T12:00:00.000Z',
    updatedAt: '2026-08-25T12:00:00.000Z',
    ...overrides,
  }
}

function bindingFixture(overrides: Partial<ProjectReceiverBindingV1> = {}): ProjectReceiverBindingV1 {
  return {
    schemaVersion: 1,
    projectId: 'project-1',
    connectedConversationIds: ['cc-1'],
    activeReceiverId: 'cc-1',
    revision: 1,
    ...overrides,
  }
}

const noop = (): void => {}
const idleClient = {} as LocalCoreClient

describe('RECEIVER-2 relativeTime 四档', () => {
  const now = Date.parse('2026-08-25T12:00:00.000Z')

  it('<60s → 刚刚；负差值钳到刚刚', () => {
    expect(relativeTime(now - 30_000, now)).toBe('刚刚')
    expect(relativeTime(now + 10_000, now)).toBe('刚刚')
  })
  it('分钟档：≥60s 且 <60m', () => {
    expect(relativeTime(now - 60_000, now)).toBe('1 分钟前')
    expect(relativeTime(now - 5 * 60_000, now)).toBe('5 分钟前')
    expect(relativeTime(now - 59 * 60_000, now)).toBe('59 分钟前')
  })
  it('小时档：≥60m 且 <24h', () => {
    expect(relativeTime(now - 60 * 60_000, now)).toBe('1 小时前')
    expect(relativeTime(now - 3 * 3_600_000, now)).toBe('3 小时前')
  })
  it('天档：≥24h', () => {
    expect(relativeTime(now - 24 * 3_600_000, now)).toBe('1 天前')
    expect(relativeTime(now - 2 * 86_400_000, now)).toBe('2 天前')
  })
})

describe('RECEIVER-1 ReceiverChip 展示面（43B.1：只显示四态）', () => {
  it('working/waiting/ready 三态分别落到状态 class，文案为「provider · label」', () => {
    const working = renderToStaticMarkup(<ReceiverChipFace active={conversationFixture({ isRunning: true })} expanded={false} onToggle={noop} />)
    expect(working).toContain('status-working')
    expect(working).toContain('Codex · GUI 收口')

    const waiting = renderToStaticMarkup(<ReceiverChipFace active={conversationFixture({ waitingReason: '等待确认' })} expanded={false} onToggle={noop} />)
    expect(waiting).toContain('status-waiting')

    const ready = renderToStaticMarkup(<ReceiverChipFace active={conversationFixture()} expanded={false} onToggle={noop} />)
    expect(ready).toContain('status-ready')

    // 红线：Chip 不显示 token/queue/session UUID/port/model
    expect(ready).not.toContain('ref-1')
    expect(ready).not.toContain('executor-1')
  })

  it('无 active receiver → 弱化态「未连接对话」+ offline 灰点', () => {
    const html = renderToStaticMarkup(<ReceiverChipFace active={null} expanded={false} onToggle={noop} />)
    expect(html).toContain('is-idle')
    expect(html).toContain('status-offline')
    expect(html).toContain('未连接对话')
  })

  it('ReceiverChip 静态初始渲染（数据未加载完成前）为加载态「连接中…」+ loading 点（不冒充未连接）', () => {
    const html = renderToStaticMarkup(<ReceiverChip projectId="project-1" client={idleClient} onOpenArchive={noop} />)
    expect(html).toContain('data-testid="lcos-receiver-chip"')
    expect(html).toContain('status-loading')
    expect(html).toContain('连接中…')
  })
})

describe('RECEIVER-2 ReceiverSwitcher 结构（43B.2）', () => {
  const switcherProps = {
    projectId: 'project-1',
    client: idleClient,
    onClose: noop,
    onChanged: noop,
    onOpenArchive: noop,
  }

  it('RECEIVER-5 disconnected：Chip 断开态按 offline 呈现 + label 追加「已断开」+ data-session-phase 标记', () => {
    const html = renderToStaticMarkup(<ReceiverChipFace active={conversationFixture()} expanded={false} onToggle={noop} phase="disconnected" />)
    expect(html).toContain('data-session-phase="disconnected"')
    expect(html).toContain('status-offline')
    expect(html).toContain('已断开')
    // disconnected 是断开，不是「未连接对话」——is-idle 只属于 active === null
    expect(html).not.toContain('is-idle')
    expect(html).not.toContain('未连接对话')
    // stale（信息过期旁路）不冒充断开：会话保持连接，仅提示信息可能过期
    const staleHtml = renderToStaticMarkup(<ReceiverChipFace active={conversationFixture()} expanded={false} onToggle={noop} phase="stale" />)
    expect(staleHtml).toContain('data-session-phase="stale"')
    expect(staleHtml).toContain('信息可能过期')
    expect(staleHtml).not.toContain('已断开')
  })

  it('RECEIVER-5 disconnected：Switcher 当前承接行带 is-disconnected + 断开说明 + 重新连接按钮', () => {
    const html = renderToStaticMarkup(<ReceiverSwitcher
      open
      conversations={[conversationFixture()]}
      activeReceiverId="cc-1"
      activePhase="disconnected"
      onRecover={noop}
      {...switcherProps}
    />)
    expect(html).toContain('is-disconnected')
    expect(html).toContain('lcos-receiver-stale-note')
    expect(html).toContain('已断开 · 项目现场不受影响')
    expect(html).toContain('data-testid="lcos-receiver-reconnect"')
    expect(html).toContain('重新连接')
  })

  it('RECEIVER-5 stale：信息过期旁路不冒充断开——is-stale + 过期说明 + 无重连按钮', () => {
    const html = renderToStaticMarkup(<ReceiverSwitcher
      open
      conversations={[conversationFixture()]}
      activeReceiverId="cc-1"
      activePhase="stale"
      {...switcherProps}
    />)
    expect(html).toContain('is-stale')
    expect(html).toContain('信息可能过期 · 会话仍保持连接')
    expect(html).not.toContain('已断开 · 项目现场不受影响')
    expect(html).not.toContain('lcos-receiver-reconnect')
  })

  it('RECEIVER-5 disconnected：未传 onRecover 时不渲染重新连接按钮（死交互红线：长得像按钮就要能点）', () => {
    const html = renderToStaticMarkup(<ReceiverSwitcher
      open
      conversations={[conversationFixture()]}
      activeReceiverId="cc-1"
      activePhase="disconnected"
      {...switcherProps}
    />)
    expect(html).toContain('is-disconnected')
    expect(html).not.toContain('lcos-receiver-reconnect')
  })

  it('RECEIVER-5：未传 activePhase 时当前承接行保持 is-active，无断开说明', () => {
    const html = renderToStaticMarkup(<ReceiverSwitcher
      open
      conversations={[conversationFixture()]}
      activeReceiverId="cc-1"
      {...switcherProps}
    />)
    expect(html).toContain('is-active')
    expect(html).not.toContain('is-stale')
    expect(html).not.toContain('lcos-receiver-stale-note')
  })

  it('当前承接区：active 行带 aria-current；列表区展示其余对话', () => {
    const html = renderToStaticMarkup(<ReceiverSwitcher
      open
      conversations={[
        conversationFixture(),
        conversationFixture({ id: 'cc-2', label: '会话二', isRunning: true, conversationRef: 'ref-2' }),
      ]}
      activeReceiverId="cc-1"
      {...switcherProps}
    />)
    expect(html).toContain('aria-current="true"')
    expect(html).toContain('当前承接')
    expect(html).toContain('已连接对话')
    // active 行为 ready 态，列表行的会话二为 working 态（四态色 class 由投影函数驱动）
    expect(html).toContain('status-ready')
    expect(html).toContain('status-working')
    expect(html).toContain('会话二')
    // 固定结构：新开按钮 + 分隔线 + 历史对话入口
    expect(html).toContain('新开对话接着做')
    expect(html).toContain('lcos-receiver-divider')
    expect(html).toContain('查看历史对话')
  })

  it('provider 徽标：codex → Codex、workbuddy → WorkBuddy', () => {
    const html = renderToStaticMarkup(<ReceiverSwitcher
      open
      conversations={[conversationFixture(), conversationFixture({ id: 'cc-2', provider: 'workbuddy', label: '会话二', conversationRef: 'ref-2' })]}
      activeReceiverId="cc-1"
      {...switcherProps}
    />)
    expect(html).toContain('Codex')
    expect(html).toContain('WorkBuddy')
    expect(receiverProviderLabel('codex')).toBe('Codex')
    expect(receiverProviderLabel('workbuddy')).toBe('WorkBuddy')
  })

  it('空态：无 connected conversations 时显示引导文案', () => {
    const html = renderToStaticMarkup(<ReceiverSwitcher open conversations={[]} activeReceiverId={null} {...switcherProps} />)
    expect(html).toContain('还没有可承接的对话')
    expect(html).toContain('新开一个对话接着做')
  })

  it('open=false 不渲染浮层', () => {
    const html = renderToStaticMarkup(<ReceiverSwitcher open={false} conversations={[conversationFixture()]} activeReceiverId="cc-1" {...switcherProps} />)
    expect(html).toBe('')
  })
})

describe('RECEIVER-2 切换承接行为（43C：零副作用）', () => {
  it('switchReceiverConversation 只调 setActiveReceiver，绝不触发任何 send/run', async () => {
    const setActiveReceiver = vi.fn(async (): Promise<RuntimeCall<ProjectReceiverBindingV1>> => ({
      result: { ok: true, value: bindingFixture() },
      origin: 'runtime',
      latencyMs: 1,
      requestedAt: '2026-08-25T12:00:00.000Z',
    }))
    const createRuntimeRun = vi.fn()
    const proposeRun = vi.fn()
    const dispatchRuntimeRun = vi.fn()
    const client = { setActiveReceiver, createRuntimeRun, proposeRun, dispatchRuntimeRun } as unknown as LocalCoreClient

    const call = await switchReceiverConversation(client, 'project-1', 'cc-1')

    expect(call.result.ok).toBe(true)
    expect(setActiveReceiver).toHaveBeenCalledTimes(1)
    expect(setActiveReceiver).toHaveBeenCalledWith('project-1', 'cc-1')
    expect(createRuntimeRun).not.toHaveBeenCalled()
    expect(proposeRun).not.toHaveBeenCalled()
    expect(dispatchRuntimeRun).not.toHaveBeenCalled()
  })

  it('切换失败时把 runtime 错误原样带回（上层据此提示）', async () => {
    const client = {
      setActiveReceiver: vi.fn(async (): Promise<RuntimeCall<ProjectReceiverBindingV1>> => ({
        result: { ok: false, error: { code: 'CONFLICT', message: 'Receiver binding update failed.', retryable: false, origin: 'runtime' } },
        origin: 'runtime',
        latencyMs: 1,
        requestedAt: '2026-08-25T12:00:00.000Z',
      })),
    } as unknown as LocalCoreClient

    const call = await switchReceiverConversation(client, 'project-1', 'cc-1')
    expect(call.result.ok).toBe(false)
  })
})
