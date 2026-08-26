import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

import { extractOutlineBranchText, parseOutline, serializeOutline } from '../src/features/canvas/outlineTree'
import { LCOS_MINDMAP_BRANCH_EXTRACT_EVENT } from '../src/features/canvas/MindMapNoteVisual'

const source = (relative: string) => readFileSync(new URL(`../src/${relative}`, import.meta.url), 'utf8')

describe('G-4 extractOutlineBranchText 纯函数（导图分支拖出的提取层）', () => {
  const outline = [
    '市场调研',
    '  竞品分析',
    '    定价策略',
    '      折扣阶梯',
    '    渠道布局',
    '  用户访谈',
    '    访谈提纲',
  ].join('\n')

  it('单条分支（无子）→ 提取该分支纯文本（DoD-①：noteBody 匹配分支文本）', () => {
    const roots = parseOutline(outline)
    const leaf = roots[0]!.children[0]!.children[0]!.children[0]! // 折扣阶梯（depth 3，无子）
    expect(extractOutlineBranchText(roots, leaf.id)).toBe('折扣阶梯')
  })

  it('带子孙的父分支 → 提取整棵子树为缩进大纲，层级结构与源一致（DoD-②）', () => {
    const roots = parseOutline(outline)
    const branch = roots[0]!.children[0]! // 竞品分析 → 定价策略(→折扣阶梯) + 渠道布局
    const text = extractOutlineBranchText(roots, branch.id)
    expect(text).toBe(['- 竞品分析', '  - 定价策略', '    - 折扣阶梯', '  - 渠道布局'].join('\n'))
    // 往返：提取文本重新解析 → 同一棵子树（层级 3 层 + 根 = 4 层结构）
    const reparsed = parseOutline(text!)
    expect(reparsed).toHaveLength(1)
    expect(reparsed[0]!.children).toHaveLength(2)
    expect(reparsed[0]!.children[0]!.children[0]!.text).toBe('折扣阶梯')
  })

  it('摘取是复制语义：源森林序列化前后不变（DoD-③：原导图分支保留）', () => {
    const roots = parseOutline(outline)
    const before = serializeOutline(roots)
    extractOutlineBranchText(roots, roots[0]!.children[0]!.id)
    extractOutlineBranchText(roots, roots[0]!.children[1]!.children[0]!.id)
    expect(serializeOutline(roots)).toBe(before)
  })

  it('未知 id / 根占位 id → null（拖出被阻止，不出垃圾节点）', () => {
    const roots = parseOutline(outline)
    expect(extractOutlineBranchText(roots, '__root__')).toBeNull()
    expect(extractOutlineBranchText(roots, 'outline-999')).toBeNull()
  })
})

describe('G-4 导图分支拖出链路契约（指针事件 + 窗口事件通道）', () => {
  it('事件名常量稳定（画布监听与导图派发共享同一个字符串）', () => {
    expect(LCOS_MINDMAP_BRANCH_EXTRACT_EVENT).toBe('lcos:mindmap-branch-extract')
  })

  it('MindMapNoteVisual：指针捕获 + 幽灵标签 + 松手派发窗口事件（非 HTML5 DnD）', () => {
    const visual = source('features/canvas/MindMapNoteVisual.tsx')
    expect(visual).toContain('setPointerCapture(event.pointerId)')
    expect(visual).toContain('extractOutlineBranchText(roots, itemId)')
    expect(visual).toContain('lcos-mindmap-branch-ghost')
    expect(visual).toContain('window.dispatchEvent(new CustomEvent(LCOS_MINDMAP_BRANCH_EXTRACT_EVENT')
    expect(visual).not.toContain('dataTransfer') // HTML5 DnD 路线已废弃（SVG draggable 不可靠）
  })

  it('主画布：ProjectCanvas 监听窗口事件 → 换算世界坐标 → drop 链（onMindmapBranchDrop 优先，回退 onExternalTextDrop）', () => {
    const project = source('features/canvas/ProjectCanvas.tsx')
    expect(project).toContain(`window.addEventListener(LCOS_MINDMAP_BRANCH_EXTRACT_EVENT, onBranchExtract)`)
    expect(project).toContain('spatialScreenToWorld(detail.clientX, detail.clientY, rect, camera)')
    // G-4 后续演进：落点走 drop 变量（onMindmapBranchDrop ?? onExternalTextDrop），
    // 主画布摘取落 createNoteFromBranchText（真文本节点），不再走 pasteTextAsNode 的纸片投影链。
    expect(project).toContain('const drop = onMindmapBranchDrop ?? onExternalTextDrop')
    // 落点对齐 ghost：预览卡片在光标 +14/+16px，落点计入同一偏移（除以 zoom 换世界坐标），消除「位移」感。
    expect(project).toContain('point.x + GHOST_OFFSET_X / camera.zoom')
    expect(project).toContain('point.y + GHOST_OFFSET_Y / camera.zoom')
  })

  it('Context 通道：ContextSpaceSurface 监听同一事件（从 Context 位置产生内容节点的缺口补齐）', () => {
    const contextSurface = source('features/surfaces/ContextSpaceSurface.tsx')
    expect(contextSurface).toContain(`window.addEventListener(LCOS_MINDMAP_BRANCH_EXTRACT_EVENT, onBranchExtract)`)
    // 落点同样计入 ghost 偏移（+14/+16px ÷ zoom），与主画布同语义。
    expect(contextSurface).toContain('props.onExternalTextDrop!(detail.text, point.x + GHOST_OFFSET_X / camera.zoom, point.y + GHOST_OFFSET_Y / camera.zoom)')
    const projection = source('features/surfaces/ProjectionSurfaces.tsx')
    expect(projection).toContain('onExternalTextDrop={props.onExternalTextDrop}')
    const app = source('App.tsx')
    expect(app).toContain('appendExactPresentationMembers(\'context\', ownerId, [viewId], currentMembers)')
  })

  it('CSS：非根分支 grab 手势 + 禁文字选择 + 幽灵标签浮岛样式（Glaze 单色词汇）', () => {
    const css = source('interaction-system.css')
    expect(css).toContain('.lcos-reconstructed .lcos-mindmap-topic:not(.depth-0) { cursor: grab;')
    expect(css).toContain('.lcos-mindmap-branch-ghost')
  })
})
