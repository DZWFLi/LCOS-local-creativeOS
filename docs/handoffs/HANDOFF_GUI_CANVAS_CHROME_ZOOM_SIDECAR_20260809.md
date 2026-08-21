# Handoff — Canvas Chrome、2% 总览与 Sidecar 提示词修正

日期：2026-08-09

## 任务摘要

在不改变 LCOS 对象模型、节点单击打开规则和后端数据流的前提下，修正 Canvas 多选工具、Shell 白底、重复缩放控件、超大画布缩放下限，以及窄模式提示词卡不可见问题。

## 实际范围

- `apps/web/src/App.tsx`
  - `Ctrl/Cmd+A` 仅在 Canvas 获得焦点时全选当前 Canvas 节点；文本输入仍保留原生全选。
  - 底部缩放路径统一使用 `MIN_CANVAS_ZOOM`。
  - 自动相机修复只在项目 / Scope 初始恢复相关依赖变化时运行，不再因用户每次缩放而重复夺回相机。
- `apps/web/src/features/canvas/ProjectCanvas.tsx`
  - Canvas 空白点击建立焦点。
  - 多选边界继续属于 CanvasWorld；多选工具和 Selection Composer 移到屏幕层并做视口内钳制。
  - 删除 `camera.zoom > .28` 的提示词可见性门槛。
- `apps/web/src/features/canvas/SelectionComposer.tsx`
  - 删除依赖 Canvas zoom 的缩放变换，保持屏幕尺度。
- `apps/web/src/features/canvas/canvasGeometry.ts`
  - 最小缩放由 25% 改为 2%。
- `apps/web/src/features/canvas/CanvasMiniMap.tsx`
  - “定位内容”不再被远处孤立节点拉成不可读的全量总览；定位当前最密集内容区并保持阅读缩放下限。
- `apps/web/src/product-interface.css`
  - 左侧 / 窄模式顶部 Workspace rail 与底部 dock 去除整块白色背景；入口全部保留。
  - 隐藏底部重复 zoom controls。
  - 小地图落在右下角。
  - 多选工具只留图标按钮，无白色底卡。
  - 修正透明 Dock 的 pointer hit-area，避免遮住右下角小地图。
- tests
  - 更新 2% 下限与屏幕层 overlay 合同；新增 Canvas Ctrl/Cmd+A 合同。

## 变更流程

```text
此前：Selection UI 属于 CanvasWorld → 随相机缩放 / 可能越出窄视口
现在：Selection Bounds 属于 CanvasWorld
      Selection Toolbar / Composer 属于 Canvas screen layer → 固定尺度 + 视口钳制

此前：Rail / Dock 整块白底 + Dock zoom + MiniMap zoom
现在：入口浮于透明 Shell → 只保留 MiniMap zoom → MiniMap 位于右下角

此前：用户缩小 → camera validity effect 重跑 → 被拉回 58%
现在：初次恢复时校正一次 → 用户缩小 → 最低稳定在 2%
```

## 验收

证据：[LCOS_GUI_CANVAS_CHROME_AND_ZOOM_EVIDENCE_20260809.md](../audit/LCOS_GUI_CANVAS_CHROME_AND_ZOOM_EVIDENCE_20260809.md)

## 风险与回滚

- 风险：在极窄视口中，小地图与底部入口的视觉距离较近；已通过透明父层 + 仅按钮接收指针避免交互遮挡。
- 回滚点：恢复 `product-interface.css` 本轮覆盖、将 Selection UI 放回 CanvasWorld，并把 `MIN_CANVAS_ZOOM` 恢复为 0.25；不涉及 Schema、Project 数据或 Local Core。

## 未完成与下一步

- 本轮没有修改后端、Agent Skill、桌面封装或 iOS 封装。
- 下一步回到 GUI 产品化主线，继续做剩余交互与视觉一致性验收。

## 本轮追加：搜索 / 导入全链路与 Canvas 边缘行为

- `App.tsx`：顶部“搜索”不再是空按钮，接入项目工具的画布内容查找；小地图“定位内容”统一走孤岛检测与预览。
- `scopeLayout.ts`：新增孤立内容岛恢复提案，只移动非固定的离群对象；主内容岛和 position-locked 对象保持原位。
- `CanvasMiniMap.tsx`：支持由 App 接管定位行为；无接管时保留原有阅读定位 fallback。
- `ProjectCanvas.tsx`：只有真正贴住 Canvas 右缘的 WorkRail 才缩减右侧自动平移边界，避免 Sidecar 中左侧 / 非右缘 rail 让右拖失效。
- `product-interface.css`：补齐能力面板自身的 header、搜索、卡片和列表布局；Sidecar 下搜索、通用导入、链接、项目工具、Obsidian 与对话上下文二级界面使用统一安全区和滚动策略。
- 相关关闭按钮显示“关闭”文字；能力面板点击画布关闭，模态界面点击遮罩关闭；打开二级界面前会先关闭上一级能力浮层。

变更后流程：

```text
搜索 → 项目工具 / 查找画布内容 → 选择结果或点遮罩关闭
导入 → 六类来源 → 二级界面 → 返回 / 关闭 / 点遮罩关闭
定位内容 → 检测孤岛 → 无孤岛则直接定位
                    → 有孤岛则预览 ghost → 应用写入 / 取消不改数据
节点拖向右缘 → 使用真实 Canvas 右边界 → 相机持续向右跟随
```

回滚：移除 `onSearch` 绑定、`onLocateContent` 接管和 Sidecar 弹层覆盖即可；孤岛布局在确认前不产生数据变更，不涉及 Schema 或 Local Core。

## 轻量化复核

- 能力与导入浮层恢复图标主导的小面积形态，不再使用近全屏 Sidecar 卡片。
- 顶部搜索通过 `projectToolsMode: search | full` 与完整项目工具分流，避免搜索入口加载无关的工程和 Codex 会话内容。
- 底部两排导航不使用贯穿 Canvas 的分隔线；每个按钮独立拥有轻瓷白微底座，保持画布可读性和液态玻璃激活效果。
- 本次仅改变展示分流和 CSS 表现，没有改变 Project、Canvas、Artifact、Run 或 Local Core 数据。
