import { useCallback, useEffect, useRef, useState } from 'react'
import { createLocalCoreClient } from '../../runtime/localCoreClient'
import { getDesktopPort } from '../../runtime/desktopPort'
import { LcosGlyth, type LcosGlythState } from '../spatial/visual/LcosGlyth'
import { LightSegment } from '../spatial/visual/LightSegment'

/** Pending ratio denominator: each lit micro-bar segment ≈ two captured items. */
const GAUGE_SEGMENTS = 12
const MICRO_SEGMENTS = 6
const SUCCESS_HOLD_MS = 1_200
const FAILURE_HOLD_MS = 2_000

/**
 * Capture float — 单独悬浮的 Glyth 小生物（Grammar §19 冻结六态）。
 * 不再是 header + card body + footer button 的卡片：一只 bloub 生物居中，
 * 极简状态小字（idle 时仅 hover 浮现），receiving/working 时亮一条
 * LightSegment 微条。Capture Space 入口 = 双击生物。窗口空白处仍是
 * Electron 拖拽区（位置持久化在 main.mjs），投放数据链路在 preload.mjs。
 */
type CapturePhase = 'idle' | 'aware' | 'receiving' | 'working' | 'success' | 'failure'

/** 六态 → bloub 形态：aware 与 idle 同为 stable，差别只在眼睛跟 pointer。 */
const PHASE_GLYTH: Record<CapturePhase, LcosGlythState> = {
  idle: 'stable',
  aware: 'stable',
  receiving: 'absorb',
  working: 'working',
  success: 'confirm',
  failure: 'error',
}

const PHASE_TEXT: Record<CapturePhase, string> = {
  idle: '拖入文件 / 文字 / 链接',
  aware: '双击打开暂存画布 · 拖入投放',
  receiving: '松手收进暂存区',
  working: '暂存中',
  success: '已收下',
  failure: '收进失败',
}

export function CaptureFloatApp() {
  const client = useState(() => createLocalCoreClient())[0]
  const [pending, setPending] = useState(0)
  const [lastTitle, setLastTitle] = useState('')
  const [receiving, setReceiving] = useState(false)
  const [aware, setAware] = useState(false)
  const [succeeded, setSucceeded] = useState(false)
  const [failed, setFailed] = useState(false)
  const dragDepth = useRef(0)
  const pendingRef = useRef(0)
  const successTimer = useRef(0)
  const failureTimer = useRef(0)

  const refresh = useCallback(async () => {
    const call = await client.captureSpace().catch(() => null)
    if (!call?.result.ok) return
    setFailed(false)
    window.clearTimeout(failureTimer.current)
    const next = call.result.value.pendingCount
    if (next > pendingRef.current) {
      // 新物料落袋：success 姿态放一次，1.2s 后自愈回常态（LcosGlyth 自身也会 settle）。
      setSucceeded(true)
      window.clearTimeout(successTimer.current)
      successTimer.current = window.setTimeout(() => setSucceeded(false), SUCCESS_HOLD_MS)
    }
    pendingRef.current = next
    setPending(next)
    const latest = call.result.value.items[0]
    if (latest) setLastTitle(String((latest.source as { title?: string }).title ?? latest.payloadRef.split(/[\\/]/).at(-1) ?? latest.kind))
  }, [client])

  useEffect(() => {
    void refresh()
    const desktop = getDesktopPort()
    const unsubscribe = desktop?.onCaptureReceived?.(() => void refresh())
    const unsubscribeError = desktop?.onCaptureError?.((value) => {
      setReceiving(false)
      dragDepth.current = 0
      setFailed(true)
      setLastTitle(value.message?.trim() || 'Capture 失败，请确认 LCOS 项目服务已就绪')
      // 状态自愈：failure 形态 2s 后回 idle，错误细节留在状态小字里。
      window.clearTimeout(failureTimer.current)
      failureTimer.current = window.setTimeout(() => setFailed(false), FAILURE_HOLD_MS)
    })
    const interval = window.setInterval(() => void refresh(), 5_000)
    return () => {
      unsubscribe?.()
      unsubscribeError?.()
      window.clearInterval(interval)
      window.clearTimeout(successTimer.current)
      window.clearTimeout(failureTimer.current)
    }
  }, [refresh])

  // 六态裁决：failure > receiving > success > working > aware > idle。
  const phase: CapturePhase = failed ? 'failure'
    : receiving ? 'receiving'
    : succeeded ? 'success'
    : pending > 0 ? 'working'
    : aware ? 'aware'
    : 'idle'

  const statusText = phase === 'receiving' ? PHASE_TEXT.receiving
    : phase === 'success' ? (lastTitle ? `已收下 ${lastTitle}` : PHASE_TEXT.success)
    : phase === 'failure' ? (lastTitle ? `收进失败 · ${lastTitle}` : PHASE_TEXT.failure)
    : phase === 'working' ? `暂存 ${pending} 项`
    : PHASE_TEXT[phase]

  return <main
    className={`capture-float lcos-reconstructed phase-${phase} ${receiving ? 'is-receiving' : ''}`}
    aria-label={`LCOS Capture 小生物：${PHASE_TEXT[phase]}${pending > 0 ? `，暂存 ${pending} 项` : ''}，双击打开暂存画布`}
    onDragEnter={(event) => { event.preventDefault(); dragDepth.current += 1; setReceiving(true) }}
    onDragOver={(event) => event.preventDefault()}
    onDragLeave={(event) => { event.preventDefault(); dragDepth.current = Math.max(0, dragDepth.current - 1); if (dragDepth.current === 0) setReceiving(false) }}
    onDrop={() => { dragDepth.current = 0; setReceiving(false); window.setTimeout(() => void refresh(), 250) }}
  >
    <div
      className="capture-float-stage"
      onPointerEnter={() => setAware(true)}
      onPointerLeave={() => setAware(false)}
    >
      <div
        className="capture-float-creature"
        title="双击打开暂存画布"
        onDoubleClick={() => void getDesktopPort()?.openCaptureSpace?.()}
      >
        <LcosGlyth className="capture-float-glyth" state={PHASE_GLYTH[phase]} size={96} label={`Capture 小生物：${PHASE_TEXT[phase]}`}/>
      </div>
      <LightSegment
        className="capture-float-segments"
        axis="horizontal"
        length={64}
        segments={MICRO_SEGMENTS}
        mode={receiving ? 'flow' : 'progress'}
        active={receiving}
        progress={pending > 0 ? Math.min(1, pending / GAUGE_SEGMENTS) : undefined}
      />
      <span className="capture-float-status" aria-live="polite">{statusText}</span>
    </div>
  </main>
}
