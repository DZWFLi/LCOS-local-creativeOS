import { useMemo, useState } from 'react'
import type { Camera } from '../../model'
import { EDGE_PIN_EDGE_INSET, edgePinEdgeForPlacement, edgePinForWorldBounds, type EdgePinEdge } from './edgePinGeometry'

/** 边缘气泡条目:调用方负责过滤「被标点」对象(pinned/选中/被圈),本组件不管过滤规则。 */
export interface CanvasEdgePinItem {
  readonly id: string
  readonly label: string
  readonly bounds: Readonly<{ x: number; y: number; width: number; height: number }>
}

interface Props {
  readonly camera: Camera
  readonly viewportSize: Readonly<{ width: number; height: number }>
  readonly items: readonly CanvasEdgePinItem[]
  readonly onLocate: (id: string) => void
}

interface PinEntry {
  readonly item: CanvasEdgePinItem
  readonly screenX: number
  readonly screenY: number
  readonly angleDeg: number
}

/** 边缘渲染顺序(上→右→下→左,与 DOM 顺序一致) */
const EDGE_ORDER: readonly EdgePinEdge[] = ['top', 'right', 'bottom', 'left']
const EDGE_LABELS: Record<EdgePinEdge, string> = { top: '上', right: '右', bottom: '下', left: '左' }
/** 聚合巢点阵上限(n 个标点 = n 个 Matrix 点,超过 6 个截断防溢壳) */
const CLUSTER_DOT_CAP = 6

/**
 * §4.13 画布引导·边缘气泡层(SpatialOverlayLayer 同层、与 minimap 同族的固定屏幕层):
 * 视口外的「被标点」对象沿画布边缘出地图钉式方位气泡——Matrix 方点箭头随对象真实方位旋转;
 * 点击气泡 → onLocate(调用方复用 focus 链把相机滑过去),对象回到视口内气泡自动消失。
 * 同边缘多个标点聚合为一个巢,点击巢展开堆叠列表逐个跳转(防遮挡,治"丰盛画布"噪音)。
 * 气泡层整层 pointer-events:none,只有气泡/巢本身可点,不阻塞画布交互。
 */
export function CanvasEdgePinLayer({ camera, viewportSize, items, onLocate }: Props) {
  /** 当前展开的聚合巢所在边缘(一次只展开一个;再点同一个巢收起) */
  const [expandedEdge, setExpandedEdge] = useState<EdgePinEdge | null>(null)

  /** 逐对象求边缘锚点 + 指向角,过滤视口内标点,按物理边缘四向分组(§4.13 B 聚合) */
  const groups = useMemo(() => {
    const byEdge: Record<EdgePinEdge, PinEntry[]> = { top: [], right: [], bottom: [], left: [] }
    for (const item of items) {
      const pin = edgePinForWorldBounds(item.bounds, camera, viewportSize, EDGE_PIN_EDGE_INSET)
      if (pin.isOnscreen) continue
      byEdge[edgePinEdgeForPlacement(pin, viewportSize, EDGE_PIN_EDGE_INSET)].push({
        item,
        screenX: pin.screenX,
        screenY: pin.screenY,
        angleDeg: (pin.angle * 180) / Math.PI,
      })
    }
    return byEdge
  }, [camera, items, viewportSize])

  /** 从巢的展开列表点行:先收起巢,再走同一条 onLocate 跳转链(跳转逻辑复用不新写) */
  const locateFromCluster = (id: string) => {
    setExpandedEdge(null)
    onLocate(id)
  }

  if (!items.length) return null

  return <div className="lcos-edge-pin-layer" data-testid="spatial-edge-pin-layer">
    {EDGE_ORDER.map((edge) => {
      const entries = groups[edge]
      if (!entries.length) return null
      // 同边缘仅 1 个标点 → 直接出方位气泡(地图钉式旋转箭头)
      if (entries.length === 1) {
        const entry = entries[0]
        return <button
          key={entry.item.id}
          type="button"
          className="lcos-edge-pin"
          data-testid="spatial-edge-pin"
          data-edge-pin-id={entry.item.id}
          style={{ left: entry.screenX, top: entry.screenY }}
          aria-label={`定位:${entry.item.label}`}
          title={entry.item.label}
          onClick={() => onLocate(entry.item.id)}
        >
          <span className="lcos-edge-pin-dots" style={{ transform: `rotate(${entry.angleDeg}deg)` }} aria-hidden="true"><i/><i/><i/></span>
          <span className="lcos-edge-pin-label">{entry.item.label}</span>
        </button>
      }
      // 同边缘多标点 → 聚合为一个巢:位置取同边缘锚点平均(锚点共线于该边缘,平均后仍贴边)
      const clusterX = entries.reduce((sum, entry) => sum + entry.screenX, 0) / entries.length
      const clusterY = entries.reduce((sum, entry) => sum + entry.screenY, 0) / entries.length
      const expanded = expandedEdge === edge
      return <div key={edge} className={`lcos-edge-pin-cluster is-${edge}${expanded ? ' is-expanded' : ''}`} style={{ left: clusterX, top: clusterY }}>
        <button
          type="button"
          className="lcos-edge-pin lcos-edge-pin-toggle"
          data-testid="spatial-edge-pin-cluster"
          data-edge={edge}
          aria-expanded={expanded}
          aria-label={`${EDGE_LABELS[edge]}边缘 ${entries.length} 个标点,点击${expanded ? '收起' : '展开'}`}
          title={`${entries.length} 个标点`}
          onClick={() => setExpandedEdge(expanded ? null : edge)}
        >
          <b className="lcos-edge-pin-count">{entries.length}</b>
          <span className="lcos-edge-pin-cluster-dots" aria-hidden="true">{entries.slice(0, CLUSTER_DOT_CAP).map((entry) => <i key={entry.item.id}/>)}</span>
        </button>
        {expanded && <ul className="lcos-edge-pin-cluster-list">
          {entries.map((entry) => <li key={entry.item.id}>
            <button type="button" className="lcos-edge-pin-cluster-row" onClick={() => locateFromCluster(entry.item.id)}>
              <span className="lcos-edge-pin-dots" style={{ transform: `rotate(${entry.angleDeg}deg)` }} aria-hidden="true"><i/><i/><i/></span>
              <span className="lcos-edge-pin-cluster-row-label">{entry.item.label}</span>
            </button>
          </li>)}
        </ul>}
      </div>
    })}
  </div>
}
