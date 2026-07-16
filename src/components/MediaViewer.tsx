import { ChevronDown, Maximize2, Pause, Volume2 } from 'lucide-react'
import type { DemoAsset } from '../types/evaluation'

interface MediaViewerProps {
  asset: DemoAsset
  contextOpen: boolean
  onToggleContext: () => void
}

export function MediaViewer({ asset, contextOpen, onToggleContext }: MediaViewerProps) {
  return (
    <section className="media-column" aria-label="素材查看区">
      <button className="context-strip" type="button" onClick={onToggleContext} aria-expanded={contextOpen}>
        <span><small>传播目标</small>{asset.brief}</span>
        <span className="context-secondary"><small>投放平台</small>{asset.kind === 'video' ? 'Reels / TikTok' : '品牌提案'}</span>
        <span className="context-secondary"><small>必须保留</small>{asset.kind === 'video' ? '产品揭示与动作因果' : '产品结构与材质'}</span>
        <ChevronDown className={contextOpen ? 'is-rotated' : ''} size={16} />
      </button>

      {contextOpen && (
        <div className="context-detail">
          <span>生成信息</span>
          <p>{asset.generationContext}</p>
        </div>
      )}

      <div className={`media-stage media-stage-${asset.kind}`}>
        <div className="stage-art" aria-label={`${asset.title} 演示素材`}>
          <div className="stage-copy">
            <span>{asset.kind === 'video' ? 'COMMERCIAL FILM' : 'PRODUCT KEY VISUAL'}</span>
            <strong>{asset.title}</strong>
          </div>
        </div>
      </div>

      <div className="media-controls">
        <button type="button" aria-label="暂停"><Pause size={17} fill="currentColor" /></button>
        <span className="timecode">00:12 <i>/ 00:30</i></span>
        <div className="timeline" aria-label="演示时间轴">
          <span className="timeline-progress" />
          {asset.kind === 'video' && <span className="issue-marker" title="00:08.12 画面过暗" />}
        </div>
        {asset.kind === 'video' && <span className="issue-label">00:08.12 · 画面过暗</span>}
        <button type="button" aria-label="音量"><Volume2 size={17} /></button>
        <button type="button" aria-label="全屏"><Maximize2 size={17} /></button>
      </div>
    </section>
  )
}
