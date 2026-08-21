import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const popover = readFileSync(new URL('../src/features/canvas/NodeInfoPopover.tsx', import.meta.url), 'utf8')
const workbench = readFileSync(new URL('../src/features/workbench/ArtifactWorkbench.tsx', import.meta.url), 'utf8')
const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8')

describe('Phase 2 — Source actions + Change Trace contract', () => {
  it('exposes real open / reveal / copy-path source actions on node info', () => {
    expect(popover).toContain('打开')
    expect(popover).toContain('定位')
    expect(popover).toContain('复制路径')
    expect(popover).toContain('onOpenSource')
    expect(popover).toContain('onRelinkSource')
    expect(popover).toContain('来源已失效')
  })

  it('wires source actions to the local core client instead of a placeholder notice', () => {
    expect(app).toContain('openArtifactSource(node.artifactId)')
    expect(app).toContain('revealArtifactSource(node.artifactId)')
    expect(app).toContain('artifactSourcePath(node.artifactId)')
    expect(app).toContain('relinkArtifactSource(node.artifactId, path)')
    expect(app).not.toContain('将由本地核心服务打开')
  })

  it('renders Change Trace as 内容 / 来源 / 历史 in the revisions view', () => {
    expect(workbench).toContain('变更轨迹 · 内容 / 来源 / 历史')
    expect(workbench).toContain('buildChangeTrace(revisions)')
    expect(workbench).toContain('entry.actor')
    expect(workbench).toContain('entry.reasonSummary')
  })
})
