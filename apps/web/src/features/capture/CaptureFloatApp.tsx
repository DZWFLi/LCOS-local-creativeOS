import { useCallback, useEffect, useRef, useState } from 'react'
import { ExternalLink } from 'lucide-react'
import { createLocalCoreClient } from '../../runtime/localCoreClient'
import { getDesktopPort } from '../../runtime/desktopPort'
import { LcosGlyth } from '../spatial/visual/LcosGlyth'
import { LightSegment } from '../spatial/visual/LightSegment'
import { MatrixActivity } from '../spatial/visual/MatrixActivity'

/** Pending gauge: each lit discrete segment stands for one captured item (Nothing-Glyph style). */
const GAUGE_SEGMENTS = 12

/**
 * Capture float — LCOS visual language only: the living Glyth is the icon
 * (stable → absorb while receiving → confirm on landing, error on failure),
 * a discrete light-segment gauge reads the pending count, and the dot-matrix
 * texture carries the receiving/flow verbs. No card chrome, no generic icons.
 */
export function CaptureFloatApp() {
  const client = useState(() => createLocalCoreClient())[0]
  const [pending, setPending] = useState(0)
  const [lastTitle, setLastTitle] = useState('拖入文件、文字或链接')
  const [receiving, setReceiving] = useState(false)
  const [failed, setFailed] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const dragDepth = useRef(0)
  const pendingRef = useRef(0)
  const confirmTimer = useRef(0)

  const refresh = useCallback(async () => {
    const call = await client.captureSpace().catch(() => null)
    if (!call?.result.ok) return
    setFailed(false)
    const next = call.result.value.pendingCount
    if (next > pendingRef.current) {
      // New material landed: play the confirm pose once; LcosGlyth settles itself.
      setConfirmed(true)
      window.clearTimeout(confirmTimer.current)
      confirmTimer.current = window.setTimeout(() => setConfirmed(false), 1_400)
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
      setFailed(true)
      setReceiving(false)
      setLastTitle(value.message?.trim() || 'Capture 失败，请确认 LCOS Runtime 已就绪')
    })
    const interval = window.setInterval(() => void refresh(), 5_000)
    return () => {
      unsubscribe?.()
      unsubscribeError?.()
      window.clearInterval(interval)
      window.clearTimeout(confirmTimer.current)
    }
  }, [refresh])

  const glythState = failed ? 'error' : receiving ? 'absorb' : confirmed ? 'confirm' : 'stable'
  const gaugeRatio = pending > 0 ? Math.min(1, pending / GAUGE_SEGMENTS) : 0

  return <main
    className={`capture-float lcos-reconstructed ${receiving ? 'is-receiving' : ''}`}
    onDragEnter={(event) => { event.preventDefault(); dragDepth.current += 1; setReceiving(true) }}
    onDragOver={(event) => event.preventDefault()}
    onDragLeave={(event) => { event.preventDefault(); dragDepth.current = Math.max(0, dragDepth.current - 1); if (dragDepth.current === 0) setReceiving(false) }}
    onDrop={() => { dragDepth.current = 0; setReceiving(false); window.setTimeout(() => void refresh(), 250) }}
  >
    <header>
      <strong>LCOS Capture</strong>
      <span className="capture-float-count" data-empty={pending === 0 || undefined}>{pending}</span>
      <LightSegment
        className="capture-float-gauge"
        axis="horizontal"
        segments={GAUGE_SEGMENTS}
        mode={pending > 0 ? 'progress' : 'static'}
        progress={pending > 0 ? gaugeRatio : undefined}
        semantic={failed ? 'error' : 'default'}
      />
    </header>
    <section>
      <LcosGlyth className="capture-float-glyth" state={glythState} size={64} label={`Capture 精灵：${glythState}`}/>
      <b>{receiving ? '松手收进暂存区' : failed ? 'Capture 失败' : 'Drop anything'}</b>
      <small>{lastTitle}</small>
      <MatrixActivity
        className="capture-float-matrix"
        active={receiving || pending > 0}
        verb={receiving ? 'absorb' : 'flow'}
        density={16}
        direction={90}
      />
    </section>
    <button type="button" onClick={() => void getDesktopPort()?.openCaptureSpace?.()}><ExternalLink size={12}/>打开暂存画布</button>
  </main>
}
