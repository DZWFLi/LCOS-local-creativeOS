import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = (path: string) => readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8')
const visual = source('features/canvas/CanvasNodeVisual.tsx')
const signal = source('features/design/DotGlyph.tsx')
const canvas = source('features/canvas/ProjectCanvas.tsx')
const surface = source('features/surfaces/SurfaceObject.tsx')
const workflow = source('features/surfaces/WorkflowSurface.tsx')
const dock = source('features/shell/SurfaceDock.tsx')
const app = source('App.tsx')
const css = source('interaction-system.css')

describe('GUI R8-R11 closeout contracts', () => {
  it('lets material morphology communicate file identity without file-type DotGlyphs', () => {
    expect(visual).toContain('MaterialPaperFallback')
    expect(visual).toContain('CollapsedNotePaper')
    expect(visual).toContain('lcos-material-paper-fallback')
    expect(visual).not.toContain("SystemDotGlyph kind={kind === 'markdown'")
    expect(visual).not.toContain('SystemDotGlyph kind="markdown" label="文字"')
  })

  it('defines one 16×16 system signal seed for action/state language', () => {
    for (const state of ['stable','focus','sending','receiving','working','pending','kept','reverting','conflict','failed']) {
      expect(signal).toContain(`| '${state}'`)
    }
    expect(signal).toContain('LcosSignalGlyph')
    expect(canvas).toContain('lcos-node-system-signal')
    expect(surface).toContain('lcos-surface-system-signal')
    expect(workflow).toContain('lcos-workflow-action-signal')
    expect(css).toContain('R9 — LCOS 16×16 Dynamic Language V1')
    expect(css).toContain('prefers-reduced-motion')
  })

  it('uses one temporary Reader entry for all readable material while keeping Workbench for versions/details', () => {
    expect(app).toContain('One temporary Reader for every readable material')
    expect(app).toContain('openImmersive(id)') // R1D：Reader 入口带 sourceAnchor/revision 封装
    expect(app).toContain('openImmersive(node.id)') // R1D：Reader 入口封装
  })

  it('keeps the existing Dock shell but exposes Main / Context / Workflow as the top-level work scenes', () => {
    expect(dock).toContain("label:'主画布'")
    expect(dock).toContain("label:'上下文'")
    expect(dock).toContain("label:'工作流'")
    expect(dock).not.toContain("label:'整理'")
    expect(dock).toContain('ContextGlyph')
    expect(dock).toContain('WorkflowGlyph')
  })
})
