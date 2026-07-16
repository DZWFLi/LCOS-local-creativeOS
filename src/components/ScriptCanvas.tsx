import { ChevronDown, MessageSquareText } from 'lucide-react'
import type { BriefSnapshot, ScriptReviewItem, ScriptSegment } from '../types/evaluation'

interface ScriptCanvasProps {
  baselineSegment: ScriptSegment
  brief: BriefSnapshot
  compareOpen: boolean
  contextOpen: boolean
  reviews: ScriptReviewItem[]
  segments: ScriptSegment[]
  selectedSegmentId: string
  onChangeSegment: (segment: ScriptSegment) => void
  onToggleCompare: () => void
  onSelectSegment: (id: string) => void
  onToggleContext: () => void
}

export function ScriptCanvas({ baselineSegment, brief, compareOpen, contextOpen, reviews, segments, selectedSegmentId, onChangeSegment, onSelectSegment, onToggleCompare, onToggleContext }: ScriptCanvasProps) {
  return (
    <section className="script-column" aria-label="脚本工作区">
      <button className="brief-bar" type="button" onClick={onToggleContext} aria-expanded={contextOpen}>
        <span><small>Objective</small>{brief.objective}</span>
        <span><small>Audience</small>{brief.audience}</span>
        <span><small>Platform</small>{brief.platform}</span>
        <span><small>Format</small>{brief.duration} · {brief.format}</span>
        <ChevronDown className={contextOpen ? 'is-rotated' : ''} size={15} />
      </button>
      {contextOpen && <div className="locked-row"><strong>LOCKED</strong>{brief.lockedElements.map((item) => <span key={item}>{item}</span>)}</div>}

      <div className="script-canvas">
        <header className="canvas-heading"><div><small>ADFRAME SCRIPT</small><h1>Commercial Script Review</h1></div><button onClick={onToggleCompare} type="button">{compareOpen ? 'Close Compare' : 'V1 / Current Compare'}</button></header>
        {compareOpen && <div className="version-compare">
          <div><small>V1 ORIGINAL · {baselineSegment.timeRange}</small><strong>{baselineSegment.title}</strong><p>{baselineSegment.action}</p></div>
          <div><small>CURRENT REVISION · {segments.find((item) => item.id === selectedSegmentId)?.timeRange}</small><strong>{segments.find((item) => item.id === selectedSegmentId)?.title}</strong><p>{segments.find((item) => item.id === selectedSegmentId)?.action}</p></div>
        </div>}
        <div className="script-segments">
          {segments.map((segment) => {
            const selected = segment.id === selectedSegmentId
            const count = reviews.filter((review) => review.segmentId === segment.id).length
            return (
              <article className={`script-segment${selected ? ' is-selected' : ''}`} key={segment.id} onClick={() => onSelectSegment(segment.id)}>
                <header><span>{segment.timeRange} · {segment.title}</span><em>{count > 0 && <><MessageSquareText size={11} />{count} Review</>}</em></header>
                <div className="script-fields">
                  <label><span>画面</span><textarea aria-label={`${segment.title} 画面`} value={segment.visual} onChange={(event) => onChangeSegment({ ...segment, visual: event.target.value })} /></label>
                  <label><span>动作</span><textarea aria-label={`${segment.title} 动作`} value={segment.action} onChange={(event) => onChangeSegment({ ...segment, action: event.target.value })} /></label>
                  <label><span>字幕 / 台词</span><textarea aria-label={`${segment.title} 字幕台词`} value={segment.dialogue} placeholder="—" onChange={(event) => onChangeSegment({ ...segment, dialogue: event.target.value })} /></label>
                </div>
                <details><summary>Generation Prompt</summary><textarea aria-label={`${segment.title} Prompt`} value={segment.prompt} onChange={(event) => onChangeSegment({ ...segment, prompt: event.target.value })} /></details>
              </article>
            )
          })}
        </div>
      </div>
    </section>
  )
}
