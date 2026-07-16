import { ChevronDown, MessageSquareText } from 'lucide-react'
import type { BriefSnapshot, CreativeDirection, ScriptReviewItem, ScriptSegment } from '../types/evaluation'

interface ScriptCanvasProps {
  baselineSegment?: ScriptSegment
  brief: BriefSnapshot
  creativeDirection: CreativeDirection
  compareOpen: boolean
  contextOpen: boolean
  reviews: ScriptReviewItem[]
  segments: ScriptSegment[]
  selectedSegmentId: string
  sourceVersionLabel?: string
  onChangeSegment: (segment: ScriptSegment) => void
  onToggleCompare: () => void
  onSelectSegment: (id: string) => void
  onToggleContext: () => void
}

export function ScriptCanvas({ baselineSegment, brief, creativeDirection, compareOpen, contextOpen, reviews, segments, selectedSegmentId, sourceVersionLabel, onChangeSegment, onSelectSegment, onToggleCompare, onToggleContext }: ScriptCanvasProps) {
  const selectedSegment = segments.find((item) => item.id === selectedSegmentId)
  return (
    <section className="script-column" aria-label="脚本工作区">
      <button className="brief-bar" type="button" onClick={onToggleContext} aria-expanded={contextOpen}>
        <span><small>Objective</small>{brief.objective}</span>
        <span><small>Audience</small>{brief.audience}</span>
        <span><small>Platform</small>{brief.platform}</span>
        <span><small>Format</small>{brief.duration} · {brief.format}</span>
        <ChevronDown className={contextOpen ? 'is-rotated' : ''} size={15} />
      </button>
      {contextOpen && <div className="context-detail">
        <div className="direction-summary"><small>CREATIVE DIRECTION</small><strong>{creativeDirection.directionTitle}</strong><p>{creativeDirection.creativeMechanism}</p><span>{creativeDirection.storyArc}</span></div>
        <div className="locked-row"><strong>LOCKED</strong>{brief.lockedElements.map((item) => <span key={item}>{item}</span>)}</div>
      </div>}

      <div className="script-canvas">
        <header className="canvas-heading"><div><small>ADFRAME SCRIPT</small><h1>Commercial Script Review</h1></div><button onClick={onToggleCompare} type="button">{compareOpen ? 'Close Compare' : 'Source / Current Compare'}</button></header>
        {compareOpen && <div className="version-compare">
          {baselineSegment ? <div><small>{sourceVersionLabel} · {baselineSegment.timeStart}–{baselineSegment.timeEnd}s</small><strong>{baselineSegment.beatName}</strong><p>{baselineSegment.action}</p></div> : <div className="empty-state"><small>SOURCE VERSION</small><strong>无对应基线段落</strong><p>当前版本没有可匹配的来源段落。</p></div>}
          <div><small>CURRENT REVISION · {selectedSegment?.timeStart}–{selectedSegment?.timeEnd}s</small><strong>{selectedSegment?.beatName}</strong><p>{selectedSegment?.action}</p></div>
        </div>}
        <div className="script-segments">
          {segments.map((segment) => {
            const selected = segment.id === selectedSegmentId
            const count = reviews.filter((review) => review.versionId === segment.versionId && review.segmentId === segment.id).length
            return (
              <article className={`script-segment${selected ? ' is-selected' : ''}`} key={segment.id} onClick={() => onSelectSegment(segment.id)}>
                <header><span>{segment.timeStart}–{segment.timeEnd}s · {segment.beatName}</span><em>{count > 0 && <><MessageSquareText size={11} />{count} Review</>}</em></header>
                <div className="segment-intent"><span><small>PURPOSE</small>{segment.purpose}</span><span><small>PRODUCT ROLE</small>{segment.productRole || '—'}</span></div>
                <div className="script-fields">
                  <label><span>画面</span><textarea aria-label={`${segment.beatName} 画面`} value={segment.visual} onChange={(event) => onChangeSegment({ ...segment, visual: event.target.value })} /></label>
                  <label><span>动作</span><textarea aria-label={`${segment.beatName} 动作`} value={segment.action} onChange={(event) => onChangeSegment({ ...segment, action: event.target.value })} /></label>
                  <label><span>字幕 / 台词</span><textarea aria-label={`${segment.beatName} 字幕台词`} value={segment.dialogue ?? segment.super ?? ''} placeholder="—" onChange={(event) => onChangeSegment({ ...segment, super: event.target.value })} /></label>
                </div>
                <div className="segment-locks"><small>LOCKED</small>{segment.lockedElements.map((item) => <span key={item}>{item}</span>)}</div>
              </article>
            )
          })}
        </div>
      </div>
      <div className="derived-output-strip"><span><small>DERIVED OUTPUTS</small>Script approved 后生成</span><button type="button" disabled>Shot List · Pending</button><button type="button" disabled>Prompt Pack · Pending</button><button type="button" disabled>Vendor Brief · Pending</button></div>
    </section>
  )
}
