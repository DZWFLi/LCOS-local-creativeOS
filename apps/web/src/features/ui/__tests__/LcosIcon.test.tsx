import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { FileText } from 'lucide-react'
import { iconShapes } from '../iconShapes'
import { LcosIcon } from '../LcosIcon'

/**
 * LcosIcon 剪影测试（Wave A-0b，游戏 GUI 裁决 §2.2 铁律进 CI 验收）。
 *
 * 图标三定律的机器可验代理（真「涂黑测试」无法自动化，以下为结构侧证据）：
 *   ① 剪影可辨 → 容器 path 非空且闭合（M 起 Z 收，填充式剪影），且组件
 *      把形状数据原样渲染进 DOM（渲染侧证据）
 *   ② 形状即身份 → 各 shape 的 path 数据两两互不相同
 *   ③ 去矩形化 → 直线命令 L 为 paper（文档矩形系）专属；有机形状纯 C 曲线
 *   ④ 尺寸契约 → size 传递到容器 style 与内嵌 glyph（0.58 倍），
 *      默认 24（sidebar 标准档）
 *
 * 环境说明：本项目 vitest 走 node 环境（无 jsdom），与 tests/command-palette.test.tsx
 * 同一先例——用 renderToStaticMarkup 断言静态结构。
 */

const shapes = Object.keys(iconShapes) as Array<keyof typeof iconShapes>

function renderShape(shape: keyof typeof iconShapes): string {
  return renderToStaticMarkup(<LcosIcon shape={shape} icon={FileText} />)
}

describe('LcosIcon 剪影测试（游戏 GUI 裁决 §2.2 铁律进 CI）', () => {
  it('① 每个 shape 的容器 path 非空且闭合（M 起 Z 收），并被组件原样渲染', () => {
    expect(shapes.length).toBe(7)
    for (const shape of shapes) {
      const def = iconShapes[shape]
      expect(def.path.length, `shape=${shape}`).toBeGreaterThan(0)
      expect(def.path.startsWith('M'), `shape=${shape} 以 M 起点`).toBe(true)
      expect(def.path.endsWith('Z'), `shape=${shape} 以 Z 闭合`).toBe(true)
      // 渲染侧证据：容器 path 的 d 与形状库数据逐字一致
      expect(renderShape(shape), `shape=${shape}`).toContain(`d="${def.path}"`)
    }
  })

  it('② 形状即身份：各 shape 的 path 数据两两互不相同', () => {
    const paths = shapes.map((s) => iconShapes[s].path)
    expect(new Set(paths).size).toBe(shapes.length)
  })

  it('③ 去矩形化：直线命令 L 仅 paper 持有；有机形状为纯 C 曲线', () => {
    for (const shape of shapes) {
      const path = iconShapes[shape].path
      if (shape === 'paper') {
        expect(path, 'paper 有直边（L 命令）').toMatch(/L/)
        expect(path, 'paper 圆角处仍为曲线（C 命令）').toMatch(/C/)
      } else {
        expect(path, `shape=${shape} 不含直线命令`).not.toMatch(/L/)
        expect(path, `shape=${shape} 主体为曲线`).toMatch(/C/)
      }
    }
  })

  it('④ size 传递正确：容器 style 尺寸 + 内嵌 glyph 取 0.58 倍', () => {
    const at24 = renderToStaticMarkup(<LcosIcon shape="pebble" icon={FileText} size={24} />)
    expect(at24).toContain('width:24px')
    expect(at24).toContain('height:24px')
    expect(at24).toContain('width="14"') // round(24 × 0.58) = 14

    const at16 = renderToStaticMarkup(<LcosIcon shape="leaf" icon={FileText} size={16} />)
    expect(at16).toContain('width:16px')
    expect(at16).toContain('height:16px')
    expect(at16).toContain('width="9"') // round(16 × 0.58) = 9

    // 默认 24（sidebar 标准档）
    const atDefault = renderToStaticMarkup(<LcosIcon shape="egg" icon={FileText} />)
    expect(atDefault).toContain('width:24px')
  })

  it('tone 结构：default 无修饰 · active/identity 挂 tone 类 · identity 注入身份色变量', () => {
    const base = renderToStaticMarkup(<LcosIcon shape="capsule" icon={FileText} />)
    expect(base).toContain('class="lcos-icon"')

    const active = renderToStaticMarkup(
      <LcosIcon shape="capsule" icon={FileText} tone="active" />,
    )
    expect(active).toContain('lcos-icon--active')

    const identity = renderToStaticMarkup(
      <LcosIcon shape="capsule" icon={FileText} tone="identity" identityColor="#ff8800" />,
    )
    expect(identity).toContain('lcos-icon--identity')
    expect(identity).toMatch(/--lcos-icon-identity-color:\s*#ff8800/)
  })
})
