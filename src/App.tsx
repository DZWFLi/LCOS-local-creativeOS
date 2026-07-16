import { useState } from 'react'
import { AssetRail } from './components/AssetRail'
import { EvaluationPanel } from './components/EvaluationPanel'
import { ExportDrawer } from './components/ExportDrawer'
import { MediaViewer } from './components/MediaViewer'
import { demoAssets } from './data/demoAssets'
import './App.css'

export type EvaluationTab = 'human' | 'ai' | 'summary'

function App() {
  const [selectedAssetId, setSelectedAssetId] = useState(demoAssets[0].id)
  const [activeTab, setActiveTab] = useState<EvaluationTab>('human')
  const [contextOpen, setContextOpen] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)

  const selectedAsset =
    demoAssets.find((asset) => asset.id === selectedAssetId) ?? demoAssets[0]

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">AdFrame</div>
        <div className="topbar-divider" />
        <div className="current-project">{selectedAsset.title}</div>
        <div className="topbar-status">
          <span className="status-dot" />
          Day 1 · 静态骨架
        </div>
      </header>

      <main className="workspace">
        <AssetRail
          assets={demoAssets}
          selectedAssetId={selectedAsset.id}
          onSelect={setSelectedAssetId}
        />
        <MediaViewer
          asset={selectedAsset}
          contextOpen={contextOpen}
          onToggleContext={() => setContextOpen((open) => !open)}
        />
        <EvaluationPanel activeTab={activeTab} onTabChange={setActiveTab} />
      </main>

      <ExportDrawer open={drawerOpen} onToggle={() => setDrawerOpen((open) => !open)} />
    </div>
  )
}

export default App
