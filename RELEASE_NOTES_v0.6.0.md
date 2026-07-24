# Local Creative OS v0.6.0 · Release Notes

## 版本性质

v0.6.0 是进入 Alpha 后端能力开发前的完整前端基线候选版。

它合并了此前三个阶段的累计能力，并把阶段编号从用户可见入口移除。源码中的历史 CSS 兼容类和测试文件名暂时保留，以避免在最终回归前进行无收益的重命名重构。

## 已合并能力

### 交互稳定

- 居中执行确认；
- 确认期间 Canvas Pointer、Wheel、Drag RAF 三层锁定；
- 遮罩手势不关闭确认；
- Composer 输入不触发 Canvas 整体重建；
- 单一 Work Rail；
- Work Rail 内部独立滚动；
- Safe Insets 避让 Dock、Mini-map 和 Work Rail。

### 直觉任务闭环

- 单选 / 多选自动推断 Target 与 Context；
- `C` 聚焦 Composer；
- `Ctrl/Cmd + Enter` 只打开确认，不能直接创建 Run；
- 最终确认后自动创建 Command、Context Snapshot 和 Run 记录；
- Running、Waiting Input、Review 自动驱动 Work Rail；
- Artifact Return 自动落位并打开 Compare；
- Accept 更新 Current 并压缩当前 Process；
- Continue Modify 将 Draft 设为下一轮 Target 并聚焦 Composer。

### 项目与空间系统

- Project Drive；
- 多 Project Tabs 与项目状态隔离；
- 空白项目；
- Root / Child Canvas Scope；
- Container Node；
- 面包屑和返回上级；
- Artifact 与 ArtifactView 身份分离；
- Child Workspace；
- Scope Camera 保存与恢复；
- 自动布局 Ghost Preview；
- 固定节点；
- Scope Tree 删除合同；
- 项目标签独立关闭控件。

### Canvas 基础编辑

- 节点和关系复制粘贴；
- 多选复制内部关系；
- Duplicate ArtifactView；
- Undo / Redo；
- 关系模式；
- 多选组拖动；
- 紧凑 / 标准 / 展开信息密度；
- Mini-map 定位；
- Workspace 创建、改名、Intent、排序和保存视角。

## 正式收口条件

只有在 `CODEX_RUN_V0.6.0_FULL_REGRESSION.md` 的累计回归通过后，v0.6.0 才可作为 Alpha 后端开发基线冻结。
