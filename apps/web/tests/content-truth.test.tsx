import { readFileSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { CanvasNodeVisual, documentPreviewStateCopy, nextImageLoadPhase } from '../src/features/canvas/CanvasNodeVisual'
import { ProjectStripVNext } from '../src/features/shell/ProjectStripVNext'
import { WorkspaceRailVNext, memberSummaryLine, railMemberLayout, type ProjectRailViewItem, type RailMemberPreview } from '../src/features/shell/WorkspaceRailVNext'

const source = (relative: string) => readFileSync(new URL(`../src/${relative}`, import.meta.url), 'utf8')
const railSource = source('features/shell/WorkspaceRailVNext.tsx')
const nodeVisualSource = source('features/canvas/CanvasNodeVisual.tsx')

const member = (id: string, x: number, y: number, width = 40, height = 30, kind = 'file'): RailMemberPreview => ({ id, x, y, width, height, kind })

function railView(overrides: Partial<ProjectRailViewItem> = {}): ProjectRailViewItem {
  return { id: 'workspace:w1', title: 'Scene 1', kind: 'scene', memberCount: 2, ...overrides }
}

function renderRail(views: ProjectRailViewItem[]): string {
  return renderToStaticMarkup(<WorkspaceRailVNext views={views} runStatus={null} onOverview={() => {}} onActivateView={() => {}} onAdd={() => {}} />)
}

describe('内容真实性收口 ⑦ —— 债1：rail 真 mini 布局', () => {
  it('railMemberLayout 按真实 x/y 归一化排布，嵌套实体不参与几何但计数', () => {
    const layout = railMemberLayout([
      member('n1', 0, 0, 40, 30, 'image'),
      member('n2', 200, 100, 60, 40, 'markdown'),
      member('scope:s2', 0, 0, 10, 10, 'entity'),
    ], 6)
    expect(layout.placed).toHaveLength(2)
    expect(layout.entityCount).toBe(1)
    expect(layout.overflow).toBe(0)
    const first = layout.placed[0]!
    const second = layout.placed[1]!
    expect(first.left).toBeLessThan(second.left)
    expect(first.top).toBeLessThan(second.top)
    for (const cell of layout.placed) {
      expect(cell.left).toBeGreaterThanOrEqual(0)
      expect(cell.left).toBeLessThanOrEqual(100)
      expect(cell.top).toBeGreaterThanOrEqual(0)
      expect(cell.top).toBeLessThanOrEqual(100)
    }
  })

  it('railMemberLayout 超过上限只显示 limit 个并如实计溢出', () => {
    const layout = railMemberLayout([
      member('n1', 0, 0, 10, 10),
      member('n2', 50, 0, 10, 10),
      member('n3', 100, 0, 10, 10),
    ], 2)
    expect(layout.placed).toHaveLength(2)
    expect(layout.overflow).toBe(1)
  })

  it('rail 条内是 F5 native glyph（真实计数驱动），真实成员布局在 hover 大卡', () => {
    // F5/F6 truth：rail 条内收窄为 native micro glyph（RailMicroObject，density=真实
    // memberCount 驱动、kind 对应形态）；真实 x/y 归一化布局（RealMemberPreview）
    // 移入 hover 大卡（preview && <ViewPreview large/>），条内不再渲染成员方块。
    const html = renderRail([railView({ memberNodes: [member('n1', 0, 0, 40, 30, 'image'), member('n2', 200, 100, 60, 40, 'markdown')] })])
    expect(html).toContain('lcos-rail-native-micro kind-scene')
    expect(html).toContain('data-density="2"')
    // hover 大卡挂载点：preview 卡内 ViewPreview 以 large 模式渲染真实布局。
    expect(railSource).toContain('<ViewPreview view={preview} large/>')
    // RealMemberPreview 渲染真实成员方块：data-member-kind + 归一化百分比 style。
    expect(railSource).toContain('className="lcos-rail-member-cell"')
    expect(railSource).toContain('data-member-kind={kind}')
    expect(railSource).toContain("style={{ left: `${left}%`, top: `${top}%`, width: `${width}%`, height: `${height}%` }}")
  })

  it('hover 大卡溢出徽章显示真实未显示成员数（+N）', () => {
    // overflow 的几何正确性由纯函数测试覆盖；此处断言渲染契约——
    // 溢出数来自 railMemberLayout 的真实 placed/overflow，徽章如实显示 +N。
    expect(railSource).toContain('layout.overflow > 0 && <b className="lcos-rail-member-overflow" title={`另有 ${layout.overflow} 个成员未显示`}>+{layout.overflow}</b>')
  })

  it('无成员节点投影时退回真实计数，不伪造布局', () => {
    // 数据边界：拿不到成员投影时渲染 lcos-rail-member-empty + 真实 memberCount，
    // 不画假几何；有成员但无几何坐标时走类型分布退路（stats），也不画假图形。
    expect(railSource).toContain('lcos-rail-member-empty')
    expect(railSource).toContain('{view.memberCount || 0}')
    expect(railSource).toContain('真实类型分布退路，不画假图形')
    expect(railSource).toContain('lcos-rail-member-stats')
  })

  it('memberSummaryLine 是真实类型分布统计行', () => {
    expect(memberSummaryLine(railView({ memberCount: 0 }))).toBe('空视图')
    expect(memberSummaryLine(railView({ memberCount: 3, memberNodes: [
      member('n1', 0, 0, 10, 10, 'image'), member('n2', 0, 0, 10, 10, 'image'), member('n3', 0, 0, 10, 10, 'markdown'),
    ] }))).toContain('图片×2')
  })

  it('成员预览 CSS：类型真实着色 + 大卡 overflow 定位（F6 契约）', () => {
    // 旧「对 scene/workflow 装饰线 b 规则提权 reset」已随样式重构退役（污染源消失）。
    // 新契约：member-cell 按真实 data-member-kind 类型着色；overflow/stats/empty
    // 仅在 hover 大卡（is-large）定位渲染。
    const css = source('spatial-components.css')
    expect(css).toContain('.lcos-reconstructed .lcos-rail-member-cell[data-member-kind=\'image\']')
    expect(css).toContain('.lcos-reconstructed .lcos-rail-member-cell[data-member-kind=\'markdown\']')
    expect(css).toContain('.lcos-reconstructed .lcos-rail-member-map.is-large .lcos-rail-member-overflow')
    expect(css).toContain('.lcos-reconstructed .lcos-rail-member-stats.is-large,')
    expect(css).toContain('.lcos-reconstructed .lcos-rail-member-empty.is-large')
  })
})

describe('内容真实性收口 ⑦ —— 债3：死交互修复（rail）', () => {
  it('「新 Scene」是真 button（可聚焦、非 aria-hidden），点击接现有创建入口', () => {
    const html = renderRail([railView()])
    const buttonTag = html.match(/<button[^>]*data-testid="new-scene-drop-target"[^>]*>/)
    expect(buttonTag).not.toBeNull()
    expect(buttonTag![0]).not.toContain('aria-hidden')
    // 源码契约：rail 的 onAdd 在 App 侧接 createEmptyWorkspaceScene（既有创建函数）。
    expect(source('App.tsx')).toContain('onAdd: createEmptyWorkspaceScene')
  })

  it('resize handle 补齐 slider ARIA（valuenow/min/max）与左右方向键切换', () => {
    const html = renderRail([railView()])
    const handle = html.match(/<span[^>]*role="slider"[^>]*>/)
    expect(handle).not.toBeNull()
    expect(handle![0]).toContain('aria-valuenow="1"')
    expect(handle![0]).toContain('aria-valuemin="1"')
    expect(handle![0]).toContain('aria-valuemax="2"')
    expect(handle![0]).toContain('tabindex="0"')
    expect(railSource).toContain("event.key === 'ArrowLeft'")
    expect(railSource).toContain("event.key === 'ArrowRight'")
  })
})

describe('内容真实性收口 ⑦ —— 债2：图片三态', () => {
  it('nextImageLoadPhase 状态机：loading → ready/error，retry 重置为 loading', () => {
    expect(nextImageLoadPhase('loading', 'load')).toBe('ready')
    expect(nextImageLoadPhase('ready', 'error')).toBe('error')
    expect(nextImageLoadPhase('error', 'retry')).toBe('loading')
    expect(nextImageLoadPhase('ready', 'reset')).toBe('loading')
  })

  it('ImageObject 初始渲染 loading 骨架；失败兜底文案与重试按钮存在', () => {
    const node = { id: 'n1', kind: 'source' as const, title: 'pic.png', subtitle: '', x: 0, y: 0, width: 120, height: 90, previewUrl: '/broken.png' }
    const html = renderToStaticMarkup(<CanvasNodeVisual node={node} density="standard" runId="r1" runStatus={null} pending={false} onDetails={() => {}} showDetails />)
    expect(html).toContain('data-image-phase="loading"')
    expect(html).toContain('lcos-image-skeleton')
    expect(nodeVisualSource).toContain('图片加载失败')
    expect(nodeVisualSource).toContain('lcos-image-retry')
    // 重试通过 key 重置重新加载（attempt 计数进 OcrImage key）。
    expect(nodeVisualSource).toContain('key={`${src}#${attempt}`}')
  })
})

describe('内容真实性收口 ⑦ —— 债4：文档预览状态如实分档', () => {
  const baseNode = { id: 'd1', kind: 'source' as const, title: 'doc.docx', subtitle: '', x: 0, y: 0, width: 100, height: 80 }

  it('按 previewStatus 枚举如实区分，失败带原因；枚举无“生成中”就不虚构进行时', () => {
    expect(documentPreviewStateCopy({ ...baseNode, previewStatus: 'failed' })).toBe('预览生成失败')
    expect(documentPreviewStateCopy({ ...baseNode, previewStatus: 'failed', previewError: 'renderer timeout' })).toBe('预览生成失败：renderer timeout')
    expect(documentPreviewStateCopy({ ...baseNode, previewStatus: 'not-generated' })).toBe('预览未生成')
    expect(documentPreviewStateCopy({ ...baseNode, previewStatus: 'unsupported' })).toBe('预览不支持')
    expect(documentPreviewStateCopy({ ...baseNode, previewStatus: 'ready' })).toBe('预览已生成')
    expect(documentPreviewStateCopy({ ...baseNode, observedPath: 'C:/a/b.docx' })).toBe('本地来源')
    expect(documentPreviewStateCopy(baseNode)).toBe('项目材料')
    expect(nodeVisualSource).not.toContain('预览暂不可用')
  })
})

describe('内容真实性收口 ⑦ —— 债5：文案卫生', () => {
  it('unsaved 显示「未保存」而非「保存失败」；idle 不虚报已保存', () => {
    const html = renderToStaticMarkup(<ProjectStripVNext projectLabel="项目 A" scopeLabel="主画布" saveStatus="unsaved" runStatus={null} onOpenProjectDrive={() => {}} onImport={() => {}} onHistory={() => {}} />)
    expect(html).toContain('未保存')
    expect(html).not.toContain('保存失败')
  })

  it('长项目名 title 携带完整名（截断由 CSS ellipsis 承担）', () => {
    const longLabel = '超长项目名称测试超长项目名称测试超长项目名称测试'
    const html = renderToStaticMarkup(<ProjectStripVNext projectLabel={longLabel} scopeLabel="主画布" saveStatus="saved" runStatus={null} onOpenProjectDrive={() => {}} onImport={() => {}} onHistory={() => {}} />)
    expect(html).toContain(`title="${longLabel}"`)
    const stripCss = source('reconstruction.css') + source('vnext.css')
    expect(stripCss).toMatch(/vnext-project-name strong[^{]*\{[^}]*text-overflow:\s*ellipsis/)
  })
})
