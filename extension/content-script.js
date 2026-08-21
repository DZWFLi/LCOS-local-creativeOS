(() => {
  let dock = null
  let candidate = null
  let press = null // { x, y } 自研拖拽起点（仅左键在 img/a 上）

  // 自检标记：控制台输入 window.__LCOS_CAPTURE_EXTENSION__ 可确认注入。
  window.__LCOS_CAPTURE_EXTENSION__ = true

  const send = (mode) => {
    if (!candidate) return
    chrome.runtime.sendMessage({
      type: 'LCOS_CAPTURE_TAB',
      kind: candidate.kind,
      sourceUrl: candidate.url,
      text: candidate.text,
      mode,
      pageUrl: location.href,
      pageTitle: document.title,
    })
    hideDock()
  }

  const showDock = () => {
    if (dock) return
    dock = document.createElement('div')
    dock.id = 'lcos-capture-dock'
    dock.innerHTML = '<span>拖到 Capture Space</span><button data-mode="staging">收下</button>'
    Object.assign(dock.style, {
      position: 'fixed', left: '50%', bottom: '12px', transform: 'translateX(-50%)', zIndex: '2147483647',
      display: 'flex', gap: '8px', alignItems: 'center', padding: '8px 12px', borderRadius: '14px',
      background: 'rgba(20,20,26,.92)', color: '#fff', font: '12px system-ui', boxShadow: '0 12px 34px rgba(0,0,0,.35)',
    })
    const dockStyle = document.createElement('style')
    dockStyle.textContent = '#lcos-capture-dock button{appearance:none;border:0;border-radius:10px;padding:6px 12px;font:inherit;color:#fff;background:rgba(255,255,255,.14);cursor:pointer}#lcos-capture-dock button.hover,#lcos-capture-dock button:hover{background:#6c5ce7}'
    document.head.appendChild(dockStyle)
    dock.addEventListener('dragover', (event) => { event.preventDefault() })
    dock.addEventListener('drop', (event) => { event.preventDefault() })
    dock.querySelectorAll('button[data-mode]').forEach((button) => {
      button.addEventListener('dragover', (event) => {
        event.preventDefault()
        event.stopPropagation()
        button.classList.add('hover')
      })
      button.addEventListener('dragleave', () => button.classList.remove('hover'))
      button.addEventListener('drop', (event) => {
        event.preventDefault()
        event.stopPropagation()
        send(button.dataset.mode)
      })
      button.addEventListener('click', () => send(button.dataset.mode))
    })
    document.body.appendChild(dock)
  }
  const hideDock = () => { dock?.remove(); dock = null; candidate = null }

  const candidateFrom = (target) => {
    const image = target?.closest?.('img')
    const link = target?.closest?.('a[href]')
    if (image?.src?.startsWith('http')) return { kind: 'image', url: image.src }
    if (link?.href?.startsWith('http')) return { kind: 'link', url: link.href }
    return null
  }

  // —— 路径一：Eagle 式自研拖拽检测（不依赖网页是否允许原生拖拽）——
  // 只有左键在图片/链接上按下并移动超过阈值才显示 dock；右键/中键一律不触发，
  // 与浏览器鼠标手势（前进/后退、自动滚动）彻底绝缘。
  window.addEventListener('mousedown', (event) => {
    if (event.button !== 0) { press = null; return }
    press = candidateFrom(event.target) ? { x: event.clientX, y: event.clientY } : null
  }, true)
  window.addEventListener('mousemove', (event) => {
    if (!press) return
    if (candidate) return
    if (Math.hypot(event.clientX - press.x, event.clientY - press.y) < 6) return
    candidate = candidateFrom(event.target)
    if (candidate) showDock()
  }, true)
  window.addEventListener('mouseup', (event) => {
    if (press) {
      if (candidate && dock && event.target?.closest?.('#lcos-capture-dock')) {
        const mode = event.target.closest('button[data-mode]')?.dataset.mode ?? 'staging'
        send(mode)
      } else if (candidate) {
        hideDock()
      }
    }
    press = null
  }, true)

  // —— 路径二：原生 HTML5 拖拽（网页允许拖拽时同样可用）——
  window.addEventListener('dragstart', (event) => {
    press = null // 原生拖拽接管，避免 mouseup 路径重复处理
    const info = candidateFrom(event.target)
    if (!info) { candidate = null; return }
    candidate = info
    showDock()
  }, true)
  window.addEventListener('dragend', hideDock, true)

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type !== 'LCOS_GET_SELECTION') return
    const selection = window.getSelection()?.toString().trim()
    sendResponse({ ok: true, text: selection ?? '' })
  })
})()
