# Figma Make 迭代记录

## 判断基线

- UI / Interaction 主依据：`OS项目文档/docx记录/Local_Creative_OS_UI_Visual_Interaction_Spec_v0.1.docx`
- 补充依据：最新 UI v0.2 与 `CREATIVE_OS_MATERIAL_VISUAL_SYSTEM.md`
- Make 版本取舍：V3 交互正确；V2 视觉细节较优；V1 基本不采用。
- 修改策略：始终从正确交互版本增量修改，不整体重写，不删除未点名的现有能力。

## 2026-07-20 — 基线恢复

- 原状态：Make 停在 Version 4，画面实质为旧版卡片式原型。
- 操作：在 Version history 中选择“修改交互真实性与UI减法” Version 3，点击蓝色 `Restore this version`。
- 结果：Make 创建 Version 6，恢复以下正确交互结构：
  - 自由布局节点；
  - 左下 Mini-map；
  - Source / Current / Draft / Context / Decision / Run 分层；
  - 一张持续 Project Canvas；
  - 渐进披露与关系 Inspector 基础。
- 视觉判断：V3 结构清楚但过于简略，需要吸收 V2 的材质、分类色与按钮渐变。

## Round 1 — V3 交互 + V2 视觉细节

- 基础版本：Version 6。
- 目标：只提升 Porcelain Canvas、精密塑胶、分类环境色、克制 Liquid Chrome 与银线质感。
- 硬性保留：自由拖拽、连线跟随、Canvas 平移缩放、Mini-map 相机控制、Workspace 相机定位、`?` Overlay、Hover 二级菜单、双击 Relations Inspector、Draft 状态约束。
- 明确删除方向：不允许永久 `SOURCE ZONE / TARGET / REVIEW / RETURN ZONE` 画布分区标题；分类收纳到左侧二级分类层，不锁定位置。
- 提交证据：已填写左下 `Ask for changes`，点击唯一 `Send` 蓝色向上箭头；随后页面中精确匹配到新用户消息 `verifyCount: 1`。
- 生成结果：Version 7（标题“提升视觉完整度”）。
- 实际画面优点：
  - 节点恢复瓷白与内高光层级；
  - Source / Current / Draft / Context / Decision / Run 使用克制边缘色；
  - 左侧 Workspace 控制器比 V3 完整；
  - `New Run` 与新增控制使用受限渐变；
  - 永久 Zone 标题已移除；默认画面仍保持留白。
- 实际画面问题：Make 把 Mini-map 从规范要求的左下移动到右下，必须在下一轮纠正；节点拖拽、Mini-map 视口拖动、Workspace 相机与二级信息尚需实际操作验收。
- 当前结论：视觉方向通过第一轮，但未达到交互验收门，不能复制代码。

## Round 2 — 实测交互修正

- 基础版本：Version 7。
- 实际验收：
  - 通过：拖动“当前提案.pptx”后节点停在新位置；Source、Context、Decision、Draft 的连线实时跟随并重算路径。
  - 通过：拖动 Mini-map 内视口会真实移动主 Canvas 相机。
  - 通过：Mini-map Fit 可把相机恢复到节点簇。
  - 问题：Mini-map 位于右下，违反 UI V0.1 的左下规范。
  - 问题：视口可轻易拖到整屏空白，缺少有效内容边界或柔性回弹。
  - 待验证：Hover 二级菜单、`?` Overlay、双击 Relations Inspector 的稳定性。
- Round 2 修正内容：Mini-map 左下归位、有效边界、Dock/Mini-map 间距、稳定 Hover 菜单、`?` 屏幕坐标 Overlay、双击 Inspector、左侧分类二级入口。
- 提交证据：页面已显示完整 Round 2 用户消息，并出现 Make `Reasoning` 与 `Add message to queue` 状态；说明蓝色 Send 已提交且生成开始。
- 生成结果：Version 8（标题“Refine Mini-map Positioning”）。
- 实际验收：
  - 通过：Mini-map 已回到左下，Workspace Dock 与 Mini-map 不重叠；
  - 通过：Mini-map 拖动与点击定位继续真实控制主 Canvas，相机定位增加有效内容约束；
  - 通过：节点 Hover 菜单稳定显示 `预览 / 关系 / Command / 原生 / 更多`；
  - 通过：点击节点右上角 `?` 打开屏幕坐标详情 Overlay；
  - 通过：双击节点打开单实例 Relations Inspector；
  - 通过：左侧加入 Source / Target / Review / Return 分类筛选，未在 Canvas 固定节点位置。
- 当前结论：Version 8 为后续 Alpha 功能状态扩展的交互基线。

## Round 3 — Alpha 功能化 UI 状态

- 基础版本：Version 8。
- 用户范围调整：暂停在 Make 内继续细抠材质；材质、间距与动效在复制代码后由 Codex 精修。
- Mini-map 新要求：默认缩为约 `128×82` 地图区，并提供 Compact / Standard 两档或明确尺寸调节；继续保留左下定位、视口拖动、点击定位与缩放控制。
- 本轮功能状态：Project Tabs / 新标签页、Preview 与 Alpha 备注、Command 与 Context、Run 与 `waiting_input`、Artifact Return、Compare / Accept / Retry、Checkpoint。
- Golden Path：项目导航 → 打开 Project → Preview / Note → 选择 Target + Context → Command → Run → `waiting_input` → review → Artifact Return → Compare → Accept / Retry → Checkpoint。
- 范围限制：全部为 Prototype Data / Demo State；不接真实 Bridge、Codex、文件写入或后端；不加入团队、计费、插件市场、数据库配置、开发者控制台或完整内容编辑器。
- 提交证据：左下 `Ask for changes` 已填写并点击蓝色 `Send`；页面出现完整新用户消息、Make `Reasoning for the latest version` 与 `Stop` 按钮，确认生成已经启动。
- 生成结果：Version 9 已完成。
- 源码证据：Figma 官方设计上下文已返回 V9 的 `src/app/App.tsx`、`package.json`、样式文件、组件文件与图片资源链接，确认本轮不是静态截图，而是完整 Make React 原型源码。
- 当前验收状态：结构与源码已确认；Chrome 内嵌预览读取连续超时，因此尚未把 Golden Path 的每一步标记为“实际点击通过”。在完成浏览器实测前，不虚报交互验收完成。
- 下一步：读取 / 复制 V9 源码到独立原型目录，运行本地构建和浏览器 Smoke；随后将关键状态拆进 Figma 可评论精修稿。

## Figma 可评论精修稿

- 设计文件：`Local Creative OS · Alpha UI Review`
- 文件地址：`https://www.figma.com/design/W9AilfPTpCvbtGVeIpUIsL`
- 分工：Figma Make 继续承担可点击功能原型；Figma Design 文件承接代码复制后的可评论视觉精修稿。
- 已创建：`00 · Review Index` 页面与交付状态 Frame。
- 后续结构：按 Golden Path 拆分 Canvas Default、Preview / Note、Command / Context、Run / waiting_input、Artifact Return、Compare、Checkpoint 等可评论状态。
- 材质策略：不在 Make 继续反复调整；复制代码后，以 UI V0.1 为主依据，在 Figma 精修 Porcelain Canvas、精密塑胶、Liquid Chrome、分类环境色、Mini-map 尺寸与动效说明。
