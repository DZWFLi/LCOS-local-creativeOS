# Rail 直接操纵 + 渐变光幕（2026-08-13）

## 任务摘要

用户实测反馈两件事，并要求补齐侧边栏直接操纵：

1. R3 Correction 后右键投送只剩 ghost + 目标高亮，旧版「渐变光幕」光效没了（用户：现在 drop 没有光效了，是以前版本）。
2. 删除需要类似之前 drop 的渐变光幕提醒，但是红色的。
3. 侧边栏左键直接拖动排序；左键往左甩 = 删除；悬浮卡片内联重命名；视图多到放不下时自适应双列。

## 实际改动

### 1. 新建共享光幕组件

`apps/web/src/features/drop/LightCurtain.tsx`

- `tone: 'drop' | 'delete'`：drop = 紫蓝投送光幕；delete = 红色删除光幕。
- `anchors: ('left' | 'bottom')[]`：按屏幕边缘点亮，含 3px 发光描边 + 渐变幕布 + 标签/数量徽标。
- `hot`：命中有效目标或进入删除区时幕布加亮。
- 纯视觉层（`pointer-events:none`），不复活 DropShelf / edge-dwell / 二次选择 UI。

### 2. 恢复画布右键投送光效

`apps/web/src/features/canvas/ProjectCanvas.tsx`

- 右键拖起超过阈值（`rightDropMoved`）后，左缘 + 底缘紫色光幕点亮；命中目标时加亮并显示「加入 <目标>」标签；命中目标的高亮逻辑不变。
- 右键轻点不闪光幕；取消 / 松手 / 丢失 pointer 全部清理。

### 3. Rail 左键直接操纵 + 红色删除光幕

`apps/web/src/features/shell/WorkspaceRailVNext.tsx`

- **左键拖动排序**：越过邻居中点显示紫色插入线，松手按目标索引原子提交（新增 `onReorderRailView(viewId, targetIndex)`，复用 `saveViewRailOrder` 持久化 + 冲突重载）。
- **左拖删除**：明显左甩（dx < -96）或进入屏幕最左沿（x < rail.left + 24）→ 红色渐变光幕 + 「松手删除「标题」」标签 + 原条目降透明；松手走既有 `onDeleteWorkspace` 确认流程（内容/节点不删，只删 Workspace 记录）。scope-backed 视图无删除回调，不进入删除区。
- **内联重命名**：悬浮卡片新增铅笔按钮，标题变输入框，Enter/失焦保存（`onRenameWorkspace`，仅 workspace-backed），Esc 取消；防 Enter+blur 双提交。
- **双列自适应**：`ResizeObserver` 按单列容量计算，超容量给 rail 加 `is-two-column`，同步 `--lcos-rail-w`（104px），SurfaceHost / 底栏自动让位；插入线、预览卡位置同步适配。
- 拖拽结束后抑制按钮 click，避免误触打开视图。

### 4. App 接线

`apps/web/src/App.tsx`

- `reorderRailViewTo(viewId, targetIndex)`：原子 move-to-index + rail order 持久化。
- `renameRailWorkspace(workspaceId, label)`：复用 `updateWorkspaceRecord`。

### 5. 样式

`apps/web/src/reconstruction.css`（光幕 / 插入线 / 双列 / 重命名输入）+ `apps/web/src/product-interface.css`（预览卡 5 列布局）。

## 测试结果

- typecheck：PASS
- 新增 `tests/railDirectManipulationContract.test.ts`：5/5 PASS（拖排序契约、删除红光幕、画布/rail drop 光幕、内联重命名、双列）
- 相关回归：phase1RailContract / guiR3DirectManipulation / gui4InteractionContract / freedomCapabilityContract 共 21 例 PASS
- 全量 vitest：927/927 断言 PASS；3 个 e2e Playwright spec 因「Playwright Test did not expect test.beforeAll()」在加载期失败（0 test，环境既有问题，与本次改动无关）
- `vite build`：PASS
- 5173 dev server 已 HMR，新组件与 CSS 均确认编译加载

## 真机待验（用户手测）

- 左键拖 rail 项排序：插入线位置、松手后顺序持久化、刷新后保持
- 左甩到左侧红色光幕 → 松手 → 确认对话框 → 删除；取消拖回不删除
- 悬浮卡片铅笔 → 改名 → Enter/失焦生效
- 造 7+ 个视图触发双列，检查底栏/画布让位
- 画布节点右键拖到 Context/Workflow：紫色光幕 + 命中加亮

## 第二轮修订（同日，用户实测反馈）

### 安卓桌面式拖拽

- 左键拖起后源项挖空（`is-drag-source` 半透明），浮卡 `lcos-rail-drag-float` 跟手（42px 卡片 + 类型角标，带阴影/旋转），相邻项按目标位置实时平移让位（纯 transform，不触发网络写）；松手一次性提交 `onReorderRailView` 原子排序，取消/未移动无副作用。
- 双列模式下让位按网格 slot 计算（行/列位移），支持跨行跨列。

### 列数手动控制

- rail 右缘新增 10px 拖拽柄（hover 显示紫色 grip）：右拉 >22px = 双列（`--lcos-rail-w` 104px），左拉 < -22px = 单列，松手回原宽度 = 恢复自动（超容量自适应）。拖拽中实时预览宽度。

### 删除光幕修复

- 旧门槛 `dx<-96` 在 rail 贴屏幕左缘时物理上不可达，且 scope-backed 视图无删除回调 → 光幕不生效。
- 新门槛：`dx<-24` 且指针进入 rail 左沿 20px 带；workspace 与 scope 两类视图都能进删除区。
- scope-backed 删除已接通：`onDeleteScope(scopeId, label)` → 确认弹窗 → `removeScopeTree` 级联删除（与画布删除 View 同语义），已投送到其他视图的副本不受影响。

### 悬浮卡片改名不再消失

- item 的 pointerleave 改为 220ms 延迟关闭 + 预览卡命中桥（`::before` 12px 延伸带），鼠标从 rail 移向卡片时卡片保持，可点铅笔改名。

### 已记录、未实施（用户点名）

- 画布全局「让位式实时重排」性能影响：暂缓，进 Canvas 性能预算时评估。
- Context/Workflow 之间合并、成员跨视图拖出：待定 Core 层合并/迁移事务语义。
- scope-backed 内联重命名：Core 无 scope rename API，未接。

### 3.1A3.1 补丁合并

- `LCOS-R3.1A3.1-CONTEXT-STAGE-VISIBILITY.patch` 已 `git apply` 合入：Context Home / Signal Stage 也纳入 `lcos-presentation-spatial` 定位规则 + 对应契约测试（`guiR31a3SpatialStageVisibility.test.ts`，2/2 PASS）。

## 风险 / 回滚

- 删除仍走确认对话框（用户若要「松手即删」可一行改成直接调用）。
- scope-backed（Context/Workflow 集合）暂无删除/重命名回调，本次未扩展，避免引入未批准的 Core 删除语义。
- 双列下 rail 顶宽 104px 为硬编码，若后续调整单列宽度需同步。
- 回滚：还原 `LightCurtain.tsx` + 两个组件 + App 接线 + 两处 CSS 即可，无数据迁移。
