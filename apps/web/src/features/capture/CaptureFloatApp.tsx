import { useCallback, useEffect, useRef, useState } from 'react'
import { Boxes, ExternalLink } from 'lucide-react'
import { createLocalCoreClient } from '../../runtime/localCoreClient'
import { getDesktopPort } from '../../runtime/desktopPort'

export function CaptureFloatApp() {
  const client = useState(() => createLocalCoreClient())[0]
  const [pending, setPending] = useState(0)
  const [lastTitle, setLastTitle] = useState('拖入文件、文字或链接')
  const [receiving, setReceiving] = useState(false)
  const dragDepth = useRef(0)

  const refresh = useCallback(async () => {
    const call = await client.captureSpace().catch(() => null)
    if (!call?.result.ok) return
    setPending(call.result.value.pendingCount)
    const latest = call.result.value.items[0]
    if (latest) setLastTitle(String((latest.source as { title?: string }).title ?? latest.payloadRef.split(/[\\/]/).at(-1) ?? latest.kind))
  }, [client])

  useEffect(() => {
    void refresh()
    const desktop = getDesktopPort()
    const unsubscribe = desktop?.onCaptureReceived?.(() => void refresh())
    const unsubscribeError = desktop?.onCaptureError?.((value) => {
      setReceiving(false)
      setLastTitle(value.message?.trim() || 'Capture 失败，请确认 LCOS Runtime 已就绪')
    })
    const interval = window.setInterval(() => void refresh(), 5_000)
    return () => {
      unsubscribe?.()
      unsubscribeError?.()
      window.clearInterval(interval)
    }
  }, [refresh])

  return <main
    className={`capture-float lcos-reconstructed ${receiving ? 'is-receiving' : ''}`}
    onDragEnter={(event) => { event.preventDefault(); dragDepth.current += 1; setReceiving(true) }}
    onDragOver={(event) => event.preventDefault()}
    onDragLeave={(event) => { event.preventDefault(); dragDepth.current = Math.max(0, dragDepth.current - 1); if (dragDepth.current === 0) setReceiving(false) }}
    onDrop={() => { dragDepth.current = 0; setReceiving(false); window.setTimeout(() => void refresh(), 250) }}
  >
    <header><Boxes size={15}/><strong>LCOS Capture</strong><span>{pending}</span></header>
    <section><b>{receiving ? '松手收进 Capture Space' : 'Drop anything'}</b><small>{lastTitle}</small></section>
    <button type="button" onClick={() => void getDesktopPort()?.openCaptureSpace?.()}><ExternalLink size={12}/>打开暂存画布</button>
  </main>
}
