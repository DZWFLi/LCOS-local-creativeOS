import { FolderOpen, MousePointer2, PanelsTopLeft, Sparkles, X } from 'lucide-react'

interface Props {
  readonly onImport: () => void
}

export function CanvasEmptyState({ onImport }: Props) {
  return <section className="canvas-empty-state" aria-labelledby="canvas-empty-title" data-testid="canvas-empty-state">
    <div className="canvas-empty-copy">
      <span className="canvas-empty-eyebrow">空白项目</span>
      <h2 id="canvas-empty-title">把第一份资料放进项目</h2>
      <p>拖入 Brief、脚本、参考图或整个素材文件夹。LCOS 会保留原文件位置，只为项目建立可追溯的工作现场。</p>
      <button type="button" onClick={onImport}><FolderOpen size={18}/>选择文件或文件夹</button>
      <small>也可以直接把文件拖到画布任意位置 · 不会移动或覆盖原文件</small>
    </div>
    <div className="canvas-empty-guide" aria-label="界面角色说明">
      <div><PanelsTopLeft size={17}/><span><b>Workspace</b><small>同一项目的不同工作视角</small></span></div>
      <div><MousePointer2 size={17}/><span><b>当前现场</b><small>这次协作要带上的内容</small></span></div>
      <div><Sparkles size={17}/><span><b>Agent</b><small>选中内容后再交给它处理</small></span></div>
    </div>
  </section>
}

export function FirstArtifactGuide({ onDismiss }: { readonly onDismiss: () => void }) {
  return <aside className="first-artifact-guide" aria-label="项目界面快速说明" data-testid="first-artifact-guide">
    <div><PanelsTopLeft size={15}/><span><b>Workspace</b><small>切换工作视角</small></span></div>
    <div><MousePointer2 size={15}/><span><b>当前现场</b><small>收集本次协作内容</small></span></div>
    <div><Sparkles size={15}/><span><b>Agent</b><small>选中内容后再处理</small></span></div>
    <button type="button" aria-label="知道了" title="知道了" onClick={onDismiss}><X size={14}/></button>
  </aside>
}
