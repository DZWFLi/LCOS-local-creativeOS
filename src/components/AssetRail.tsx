import { Image, Play, Video } from 'lucide-react'
import type { DemoAsset } from '../types/evaluation'

interface AssetRailProps {
  assets: DemoAsset[]
  selectedAssetId: string
  onSelect: (assetId: string) => void
}

export function AssetRail({ assets, selectedAssetId, onSelect }: AssetRailProps) {
  return (
    <aside className="asset-rail" aria-label="资产与版本">
      <div className="rail-heading">
        <span>资产 / 版本</span>
        <span className="rail-count">02</span>
      </div>
      <div className="asset-list">
        {assets.map((asset, index) => {
          const selected = asset.id === selectedAssetId
          const AssetIcon = asset.kind === 'video' ? Video : Image
          return (
            <button
              className={`asset-item${selected ? ' is-selected' : ''}`}
              key={asset.id}
              onClick={() => onSelect(asset.id)}
              type="button"
              aria-pressed={selected}
              title={asset.title}
            >
              <div className={`asset-thumb asset-thumb-${asset.kind}`}>
                <span className="asset-index">0{index + 1}</span>
                <AssetIcon aria-hidden="true" size={22} strokeWidth={1.5} />
                {asset.kind === 'video' && (
                  <span className="thumb-play"><Play size={11} fill="currentColor" /></span>
                )}
              </div>
              <div className="asset-copy">
                <strong>{asset.title}</strong>
                <span>{asset.version} · {asset.kind === 'video' ? '商业视频' : '产品图像'}</span>
                <small>{asset.generationContext}</small>
              </div>
            </button>
          )
        })}
      </div>
    </aside>
  )
}
