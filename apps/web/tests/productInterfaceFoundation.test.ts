import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const interfaceCss = readFileSync(new URL('../src/product-interface.css', import.meta.url), 'utf8')
const tokens = readFileSync(
  new URL('../../../opendesign/design-systems/lcos-product/tokens/colors_and_type.css', import.meta.url),
  'utf8',
)
const main = readFileSync(new URL('../src/main.tsx', import.meta.url), 'utf8')
const strip = readFileSync(new URL('../src/features/shell/ProjectStripVNext.tsx', import.meta.url), 'utf8')
const dock = readFileSync(new URL('../src/features/shell/SurfaceDock.tsx', import.meta.url), 'utf8')
const projectViewRail = readFileSync(new URL('../src/features/shell/WorkspaceRailVNext.tsx', import.meta.url), 'utf8')
const rail = readFileSync(new URL('../src/features/workrail/WorkRail.tsx', import.meta.url), 'utf8')
const nodeVisual = readFileSync(new URL('../src/features/canvas/CanvasNodeVisual.tsx', import.meta.url), 'utf8')
const canvas = readFileSync(new URL('../src/features/canvas/ProjectCanvas.tsx', import.meta.url), 'utf8')
const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8')
const shell = readFileSync(new URL('../src/features/shell/AppShellView.tsx', import.meta.url), 'utf8')
const workRail = readFileSync(new URL('../src/features/workrail/WorkRail.tsx', import.meta.url), 'utf8')

const luminance = (hex: string) => {
  const channels = hex.match(/[a-f\d]{2}/gi)?.map((value) => Number.parseInt(value, 16) / 255) ?? []
  const [red = 0, green = 0, blue = 0] = channels.map((value) => (
    value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  ))
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue
}

const contrast = (foreground: string, background: string) => {
  const lighter = Math.max(luminance(foreground), luminance(background))
  const darker = Math.min(luminance(foreground), luminance(background))
  return (lighter + 0.05) / (darker + 0.05)
}

describe('LCOS product interface foundation', () => {
  it('loads canonical tokens before the active product interface layer', () => {
    const tokenImport = main.indexOf('lcos-product/tokens/colors_and_type.css')
    const interfaceImport = main.indexOf("./product-interface.css")
    expect(tokenImport).toBeGreaterThan(-1)
    expect(interfaceImport).toBeGreaterThan(tokenImport)
  })

  it('keeps small semantic text and focus indicators above contrast thresholds', () => {
    expect(tokens).toContain('--lcos-color-text-muted: var(--lcos-raw-ink-600)')
    expect(tokens).toContain('--lcos-color-text-faint: var(--lcos-raw-ink-500)')
    expect(contrast('#696673', '#ffffff')).toBeGreaterThanOrEqual(4.5)
    expect(contrast('#777381', '#ffffff')).toBeGreaterThanOrEqual(4.5)
    expect(contrast('#6758d8', '#ffffff')).toBeGreaterThanOrEqual(3)
    expect(interfaceCss).toContain('button:focus-visible')
    expect(interfaceCss).toContain('outline: 2px solid var(--lcos-color-focus)')
  })

  it('preserves responsive and reduced-motion safeguards', () => {
    expect(interfaceCss).toContain('@media (max-width: 1100px)')
    expect(interfaceCss).toContain('@media (prefers-reduced-motion: reduce)')
    expect(interfaceCss).toContain('animation-duration: .001ms !important')
    expect(interfaceCss).toContain('transition-duration: .001ms !important')
  })

  it('keeps primary shell and destination controls accessible by name and state', () => {
    expect(strip).toContain('aria-label="项目操作"')
    expect(strip).not.toContain('aria-label="打开项目 Agent"')
    expect(strip).toContain('aria-label="对话记录"')
    expect(dock).toContain('aria-label="Scope 与能力入口"')
    expect(dock).toContain('aria-label={`${label}：${hint}`}')
    expect(projectViewRail).toContain('aria-label="项目视图"')
    expect(projectViewRail).toContain('data-project-view-drop-target={view.id}')
    expect(projectViewRail).toContain("aria-label={`${view.active ? '当前' : '进入'}${previewLabel(view.kind)}：${view.title}`}")
    expect(rail).toContain('aria-label="Agent 参考范围"')
    expect(rail).toContain('aria-label="发送指令"')
  })

  it('memoizes the canvas and each content object across unrelated shell updates', () => {
    expect(canvas).toContain('export const ProjectCanvas = memo(')
    expect(nodeVisual).toContain('export const CanvasNodeVisual = memo(')
    expect(nodeVisual).toContain('previous.node === next.node')
    expect(nodeVisual).not.toContain('previous.onDetails === next.onDetails')
  })

  it('dynamically reflows the Codex in-app Browser without closing user state', () => {
    expect(app).toContain("type ShellLayoutDensity = 'comfortable' | 'compact' | 'constrained'")
    expect(app).toContain("type ShellLayoutMode = 'desktop' | 'sidecar'")
    expect(app).toContain("width <= 960 && width / Math.max(height, 1) < 1.35 ? 'sidecar' : 'desktop'")
    expect(app).toContain('setViewportWidth')
    expect(app).toContain('setViewportHeight')
    expect(app).toContain('responsiveRailWidth(viewportWidth, compareExpanded)')
    expect(app).toContain('shellWorkingCenter(viewportWidth, viewportHeight, layoutMode')
    expect(app).toContain('x: current.x + deltaX, y: current.y + deltaY')
    expect(app).toContain("previousMode === 'sidecar'")
    expect(app).not.toContain('const selected = selectedIds.length > 0 ? getSelectionBounds(scopeNodes, selectedIds) : null')
    expect(app).toContain('runtimeProvidersRef.current.some')
    expect(app).not.toContain('[bootMode, runtimeProviders, singleSelectedNode?.artifactId')
    expect(app).not.toContain("if (window.innerWidth < 1160) setWorkRail((current) => ({ ...current, collapsed: true }))")
    expect(shell).toContain('data-layout-density={props.layoutDensity}')
    expect(shell).toContain('data-layout-mode={props.layoutMode}')
    expect(shell).toContain("style={{ ...props.layoutStyle, '--lcos-ui-scale': String(props.uiScale) }")
    expect(shell).toContain("props.layoutMode === 'desktop' ? <WorkRailHost")
    expect(workRail).toContain("'--lcos-runtime-rail-width': `${props.width}px`")
    expect(interfaceCss).toContain(':has(.work-rail:not(.collapsed)) .minimap')
    expect(interfaceCss).toContain('bottom: calc(var(--lcos-dock-h) + 10px)')
    expect(interfaceCss).toContain('[data-layout-density="constrained"]')
    expect(interfaceCss).toContain('[data-layout-mode="sidecar"]')
    expect(interfaceCss).toContain('grid-template-rows: 40px 43px')
    expect(interfaceCss).not.toContain('--lcos-sidecar-panel-h')
    expect(strip).toContain('showWorkRailActions')
    expect(app).toContain("showWorkRailActions: layoutMode === 'desktop'")
    expect(app).toContain("onSearch: () => setProjectToolsMode('search')")
    expect(app).toContain("onProjectTools: () => { setCapabilityOpen(false); setProjectToolsMode('full') }")
    expect(interfaceCss).toContain('grid-template-rows: 46px 46px')
    expect(interfaceCss).toContain('.lcos-reconstructed[data-layout-mode="sidecar"] .capability-popover')
    expect(interfaceCss).toContain('grid-template-rows: auto auto minmax(0, 1fr)')
    expect(interfaceCss).toContain('.lcos-reconstructed[data-layout-mode="sidecar"] .import-source-grid')
    expect(interfaceCss).toContain('.lcos-reconstructed[data-layout-mode="sidecar"] .conversation-layout')
    expect(interfaceCss).toContain('width: min(308px, calc(100vw - 16px)) !important')
    expect(interfaceCss).toContain('grid-template-columns: repeat(3, minmax(0, 1fr)) !important')
    expect(interfaceCss).toContain('.modal-backdrop:has(.universal-import-panel)')
    expect(interfaceCss).toContain('border-bottom: 0 !important')
    expect(interfaceCss).toContain('porcelain micro-plates')
    expect(interfaceCss).toContain('.project-tools-dialog.search-only')
  })
})
