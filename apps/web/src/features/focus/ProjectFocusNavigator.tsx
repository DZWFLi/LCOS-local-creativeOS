import { useEffect } from 'react'
import { Crosshair, FolderTree, LayoutGrid, Network, Workflow, X } from 'lucide-react'
import type { ProjectFocusLocation } from '../../state/projectFocus'

interface Props {
  readonly open: boolean
  readonly sourceLabel: string
  readonly sourceCount: number
  readonly locations: readonly ProjectFocusLocation[]
  readonly onClose: () => void
  readonly onNavigate: (location: ProjectFocusLocation) => void
}

function iconFor(kind: ProjectFocusLocation['kind']) {
  if (kind === 'collection') return <FolderTree size={14}/>
  if (kind === 'context' || kind === 'context-graph') return <Network size={14}/>
  if (kind === 'workflow' || kind === 'workflow-graph') return <Workflow size={14}/>
  if (kind === 'workspace') return <LayoutGrid size={14}/>
  return <Crosshair size={14}/>
}

/**
 * Object-first locator only. Search is intentionally a separate product surface:
 * Focus answers “this known object is where?”, not “what object am I looking for?”.
 */
export function ProjectFocusNavigator(props: Props) {
  useEffect(() => {
    if (!props.open) return
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') props.onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [props.onClose, props.open])

  if (!props.open) return null

  return <aside className="lcos-project-focus-navigator" data-testid="project-focus-navigator" aria-label="项目聚焦定位">
    <header>
      <div><span><Crosshair size={14}/>在哪</span><strong>{props.sourceLabel || `${props.sourceCount} 项 Selection`}</strong></div>
      <button type="button" aria-label="关闭项目聚焦" title="关闭" onClick={props.onClose}><X size={14}/></button>
    </header>

    <section className="lcos-project-focus-locations" aria-label="出现位置">
      <div className="lcos-project-focus-summary"><b>{props.sourceCount} 项 Focus Set</b><span>同一对象在不同 Presentation 中的位置</span></div>
      {props.locations.length ? props.locations.map((location) => <button key={location.key} type="button" className={location.active ? 'active' : ''} onClick={() => props.onNavigate(location)}>
        <i>{iconFor(location.kind)}</i>
        <span><b>{location.label}</b><small>{location.active ? '当前视图 · ' : ''}{location.exact ? '全部命中' : `${location.matchedCount}/${location.totalCount} 命中`}</small></span>
        <em>{location.kind === 'context-graph' ? 'Context Graph' : location.kind === 'workflow-graph' ? 'Workflow Graph' : location.kind}</em>
      </button>) : <p className="lcos-project-focus-empty">这些对象目前没有出现在其它保存视图中。</p>}
    </section>

    <footer><span>F：定位当前 Selection</span><span>⌘/Ctrl+F：项目搜索</span></footer>
  </aside>
}
