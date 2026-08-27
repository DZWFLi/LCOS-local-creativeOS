/**
 * LcosIcon —— LCOS 有机形状图标容器家族（Wave A-0b，游戏 GUI 裁决核心增补件）。
 *
 * 定位（裁决 §1 病灶②⑥ / §3.2 施工增补）：
 *   图标三定律——剪影测试（涂黑也认得出）/ 形状即身份（叶形/卵石形/胶囊，非矩形）/
 *   一个图标一个含义全站一致。本家族提供「有机形状容器 + 语义规范」这一层新语言；
 *   内嵌 glyph 一律沿用 lucide-react 现有图标（Grammar §8.1：不自行再造形态）。
 *
 * 边界（Design Grammar §8.1）：本组件属 UI chrome 域的图标「容器」语言
 * （卵/叶/胶囊/蛋/超椭圆/花瓣/纸），不是 Glyth 形态——Bloub/Glyth 形状能力
 * 仍由 spatial/visual 域自管。
 *
 * 接线批次说明：本批次只立家族，不动存量——仓内既有 lucide 裸图标继续可用；
 * 存量图标逐处替换为 <LcosIcon> 属 Wave B+ 接线任务。
 *
 * Material 因果律（Grammar §5）：图标容器默认不加底不加玻璃不加阴影（纯形状+色）；
 * 只有「身份域」图标（kind badge 类）才允许低饱和填充底（active 12% / identity 14%）。
 * 容器为色洗底（tint wash）而非裁剪边界——glyph 不被形状裁切。
 *
 * 形状语义分工建议（一个形状一个含义，全站一致）：
 *   pebble    卵石   —— 通用对象（语义未特化的普通节点/条目，默认档）
 *   leaf      叶形   —— 采集捕获类（capture / 剪藏 / 采集入库）
 *   capsule   胶囊   —— 状态动作类（运行中 / 可执行 / 状态切换）
 *   egg       蛋形   —— 会话对话类（conversation / agent 会话 / 消息流）
 *   squircle  超椭圆 —— 能力技能类（capability / skill / 工作流能力）
 *   petal     花瓣   —— 上下文域（context region / 上下文片段）
 *   paper     圆角矩 —— 文档类（唯一矩形系，专给文档缩略 / 纸类）
 *
 * 使用示例：
 *   import { FileText } from 'lucide-react'
 *   import { LcosIcon } from './LcosIcon'
 *
 *   <LcosIcon shape="paper" icon={FileText} />                       // 24 默认档（sidebar 标准）
 *   <LcosIcon shape="leaf" icon={Camera} size={16} tone="active" />  // 紧凑 + 选中态
 *   <LcosIcon shape="squircle" icon={Workflow} tone="identity" identityColor="#8e7cc3" />
 */
import type { CSSProperties } from 'react'
import type { LucideIcon } from 'lucide-react'
import { iconShapes, type LcosIconShape } from './iconShapes'

export type LcosIconTone = 'default' | 'active' | 'identity'

export interface LcosIconProps {
  /** 容器形状（语义分工建议见文件头表；形状数据见 iconShapes.ts） */
  shape: LcosIconShape
  /** 内嵌 lucide 图标组件（glyph 沿用现有图标库，本家族不重造形态） */
  icon: LucideIcon
  /** 容器边长 px：24（sidebar 标准，默认）/ 16（紧凑）——Apple 规格参照 */
  size?: number
  /**
   * tone（Material 因果律 Grammar §5）：
   *   default  无底纯形状（glyph 色随上下文 currentColor）
   *   active   选中态：glyph 色 var(--lcos-ui-active) + 12% 同源底（A-3 批先例）
   *   identity 身份域 badge：传入色 14% 底 + 传入色 glyph
   */
  tone?: LcosIconTone
  /** tone='identity' 时的身份色（任意 CSS 色值，组件经 inline CSS 变量注入） */
  identityColor?: string
  /** 追加到容器 span 的类名 */
  className?: string
}

/** glyph 与容器边长之比（Apple 规格参照的内档比例） */
const GLYPH_RATIO = 0.58

export function LcosIcon({
  shape,
  icon: Icon,
  size = 24,
  tone = 'default',
  identityColor,
  className,
}: LcosIconProps) {
  const vessel = iconShapes[shape]
  const glyphSize = Math.round(size * GLYPH_RATIO)
  const classes = ['lcos-icon', tone === 'default' ? null : `lcos-icon--${tone}`, className]
    .filter(Boolean)
    .join(' ')
  const style = {
    width: size,
    height: size,
    ...(tone === 'identity' && identityColor !== undefined
      ? { '--lcos-icon-identity-color': identityColor }
      : null),
  } as CSSProperties

  return (
    <span className={classes} style={style}>
      <svg className="lcos-icon__vessel" viewBox={vessel.viewBox} aria-hidden="true">
        <path d={vessel.path} />
      </svg>
      <Icon className="lcos-icon__glyph" size={glyphSize} aria-hidden="true" />
    </span>
  )
}
