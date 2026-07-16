import { Check, FileText } from 'lucide-react'
import type { ScriptVersion } from '../types/evaluation'

interface ScriptRailProps {
  versions: ScriptVersion[]
  selectedVersionId: string
  selectedSegmentId: string
  onSelectVersion: (id: string) => void
  onSelectSegment: (id: string) => void
}

export function ScriptRail({ versions, selectedVersionId, selectedSegmentId, onSelectVersion, onSelectSegment }: ScriptRailProps) {
  const version = versions.find((item) => item.id === selectedVersionId) ?? versions[0]
  return (
    <aside className="script-rail" aria-label="脚本版本与段落">
      <div className="rail-heading"><span>PROJECT SCRIPTS</span><span>{versions.length}</span></div>
      <div className="version-list">
        {versions.map((item) => (
          <button className={`version-item${item.id === selectedVersionId ? ' is-selected' : ''}`} key={item.id} onClick={() => onSelectVersion(item.id)} type="button">
            <FileText size={14} />
            <span><strong>{item.label}</strong><small>{item.note}</small></span>
            {item.status === 'current' && <Check size={13} />}
          </button>
        ))}
      </div>
      <div className="rail-subheading">SCRIPT SECTIONS</div>
      <div className="segment-nav">
        {version.segments.map((segment) => (
          <button className={segment.id === selectedSegmentId ? 'is-selected' : ''} key={segment.id} onClick={() => onSelectSegment(segment.id)} type="button">
            <i>{String(segment.order).padStart(2, '0')}</i>
            <span><strong>{segment.title}</strong><small>{segment.timeRange}</small></span>
            <em className={`segment-status status-${segment.status}`} />
          </button>
        ))}
      </div>
    </aside>
  )
}
