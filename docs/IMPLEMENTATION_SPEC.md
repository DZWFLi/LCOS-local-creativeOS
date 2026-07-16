# Day 1 Implementation Spec

This document is the single implementation baseline for the static AdFrame workspace shell. It combines the approved concept, WorkBuddy research, product scope, and sub-agent reviews. When sources disagree, this file and `PRODUCT.md` win.

## Screen structure

- Top bar: 54px, AdFrame + current case; no profile, settings, mode switch, or fake save metrics.
- Desktop grid: `224px minmax(480px, 1fr) 376px`.
- At `max-width: 1100px`: `76px minmax(0, 1fr) 320px`; the asset rail becomes thumbnails only.
- Main workspace height: `calc(100dvh - 54px - 42px)`.
- Export drawer: fixed overlay, collapsed to 42px by default; expanded content scrolls and is capped at `min(420px, 45dvh)`.
- Left and right rails scroll independently. Tabs in the right rail remain sticky.
- Panel widths are fixed for Day 1. No drag resizing, freeform panels, or A/B viewer.

## Required visible regions

1. Two preset cases: `PortaSplit / The Thinker` and `Product KV / V2`.
2. Media-first viewer with a minimal video control treatment and one issue timecode marker.
3. Compact context strip exposing `传播目标`, `投放平台`, `必须保留`, and `生成信息`.
4. Right tabs: `人工测评`, `AI 测评`, `综合结论`.
5. Six static rows using the fixed product dimensions.
6. Collapsed `Context / Export` drawer with actions for Markdown, JSON, and Codex Handoff.
7. Quiet Recipe and three-Skill status; no model brands or fake dashboard statistics.

## Fixed evaluation labels

1. 商业目标表达
2. 平台内容适配
3. 产品融入方式
4. 构图与视觉层级
5. 动作 / 时序连续性
6. AI 生成瑕疵

Do not substitute aesthetic-only dimensions from the generated concept.

## Day 1 interaction boundary

- Asset switching works.
- Evaluation tabs switch.
- Context strip and export drawer expand/collapse.
- No editable scoring, localStorage, mock AI delay, conflict calculation, or export generation yet.
- `运行 AI 测评` belongs to the AI tab, never the human tab.
- Codex Handoff is labeled as copying structured context, not executing a real task.

## Visual tokens

- Background `#0B0C0E`; panel `#111317`; media workspace `#090A0B`.
- Hairline border `rgba(255,255,255,.12)`.
- Primary text `#F2F3F5`; muted text `#9298A1`.
- Accent `#55D8CE`; serious conflict `#FF565E`.
- Main panel radius 0–8px; control radius 6px; no gradients, glass effects, glows, or static-panel shadows.
- UI type uses Inter-compatible system fallbacks; controls receive explicit sizes and weights.
- `focus-visible`: 2px accent outline with 2px offset.

## Approved copy

- AdFrame
- PortaSplit / The Thinker
- Product KV / V2
- 资产 / 版本
- 人工测评 / AI 测评 / 综合结论
- 传播目标 / 投放平台 / 必须保留 / 生成信息
- 保存人工测评 / 运行 AI 测评 / 查看依据 / 生成综合结论 / 标记问题时间点
- 一致 / 需关注 / 判断冲突
- Context / Export
- 导出 Markdown / 导出 JSON / 复制 Codex Handoff
- 未评测 / 评测中 / 已完成 / 运行失败 / 保存成功

No additional above-the-fold marketing copy, fake metrics, model names, or decorative labels may be invented.

## Concept deviations required before implementation

- Correct the six evaluation labels.
- Add the Brief/generation context strip.
- Move the AI-run action out of the human tab.
- Keep the export drawer collapsed on first load.
- Treat the generated media frame as visual direction only; UI text and controls remain code-native.
