/** B-3：shell chrome 实际占位（左 Rail 右缘 / 底部 Dock 上缘）。
 *  供 portal 到 body 的内联编辑器（InlineNoteEditor / InlineNodeRename）
 *  计算视口安全区，避免编辑层被左 Rail / 底部 Dock 遮挡。
 *  优先量 DOM 实际渲染尺寸（覆盖双列 rail、UI 缩放等动态状态），
 *  量不到时回退到 reconstruction.css 的 --lcos-rail-w / --lcos-dock-h 常量。 */
export function readShellChromeInsets(): { left: number; bottom: number } {
  if (typeof document === 'undefined') return { left: 52, bottom: 66 }
  const rail = document.querySelector<HTMLElement>('.lcos-workspace-rail')
  const dock = document.querySelector<HTMLElement>('.lcos-bottom-dock')
  const root = getComputedStyle(document.documentElement)
  const railVar = Number.parseFloat(root.getPropertyValue('--lcos-rail-w'))
  const dockVar = Number.parseFloat(root.getPropertyValue('--lcos-dock-h'))
  const left = rail ? rail.getBoundingClientRect().right : (Number.isFinite(railVar) ? railVar : 52)
  const dockTop = dock ? dock.getBoundingClientRect().top : window.innerHeight - (Number.isFinite(dockVar) ? dockVar : 66)
  return { left, bottom: Math.max(0, window.innerHeight - dockTop) }
}
