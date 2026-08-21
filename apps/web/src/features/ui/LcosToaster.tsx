import { useEffect, useRef } from 'react'
import { Toaster, toast } from 'sonner'

const EDGE_SEMANTIC_DROP_NOTICE_KEY = 'lcos.edge-semantic-drop-notice.v1'

interface NavigatorUAData {
  brands?: readonly { brand: string; version: string }[]
  mobile?: boolean
}

function isMicrosoftEdge(): boolean {
  if (typeof navigator === 'undefined') return false
  const uaData = (navigator as Navigator & { userAgentData?: NavigatorUAData }).userAgentData
  if (uaData?.mobile !== true && uaData?.brands?.some((item) => item.brand === 'Microsoft Edge')) return true
  // Desktop Chromium Edge uses the Edg/ token. Do not match EdgA / EdgiOS.
  return /\bEdg\//.test(navigator.userAgent)
}

function noticeTone(message: string): 'error' | 'success' | 'info' {
  if (/(失败|错误|无法|冲突|不可用)/.test(message)) return 'error'
  if (/^(已|完成|成功)/.test(message) || /(已完成|已加入|已放入|已粘贴|已创建)/.test(message)) return 'success'
  return 'info'
}

export function LcosToaster({ notice }: { notice: string | null }) {
  const lastNoticeRef = useRef<string | null>(null)

  useEffect(() => {
    if (!notice || notice === lastNoticeRef.current) return
    lastNoticeRef.current = notice
    const options = { id: 'lcos-system-notice', duration: 2800 }
    const tone = noticeTone(notice)
    if (tone === 'error') toast.error(notice, options)
    else if (tone === 'success') toast.success(notice, options)
    else toast(notice, options)
  }, [notice])

  useEffect(() => {
    if (!isMicrosoftEdge()) return
    try {
      if (window.localStorage.getItem(EDGE_SEMANTIC_DROP_NOTICE_KEY) === 'dismissed') return
    } catch { /* storage can be unavailable in hardened browser contexts */ }

    const dismissPermanently = () => {
      try { window.localStorage.setItem(EDGE_SEMANTIC_DROP_NOTICE_KEY, 'dismissed') } catch { /* best effort */ }
    }

    toast('Edge：建议关闭「鼠标手势」', {
      id: 'lcos-edge-semantic-drop-notice',
      description: 'Edge 的原生右键鼠标手势会和 LCOS Semantic Drop 冲突。如果你平时不用它，建议在 Edge 设置里关闭「鼠标手势」，右键拖放体验最好。',
      duration: Infinity,
      closeButton: true,
      action: {
        label: '知道了',
        onClick: () => {
          dismissPermanently()
          toast.dismiss('lcos-edge-semantic-drop-notice')
        },
      },
      onDismiss: dismissPermanently,
    })
  }, [])

  return <>
    <Toaster
      position="bottom-center"
      visibleToasts={3}
      gap={8}
      offset={{ bottom: 76 }}
      toastOptions={{ className: 'lcos-sonner-toast' }}
    />
    {notice ? <span data-testid="toast" className="lcos-notice-test-proxy" aria-hidden="true">{notice}</span> : null}
  </>
}
