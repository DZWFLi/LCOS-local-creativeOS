# LCOS vNext 前后端审计与前端修改报告

- 日期：2026-08-03
- Codex v4 基线包：`frontend-package-20260803-v4.zip`
- v4 SHA-256：`b0fe60a59ca80e0e6eda7c51c9362c652d0ed6b64939fe826154a8608386546b`
- v4 包内来源：`codex/backend-hardening-20260802 @ b748f5ad7ee50936deadac780c1e8bff45f3eff0`
- 合并参考前端包：`frontend-package-20260803-editorial-spatial-vnext.zip`
- 参考包 SHA-256：`cb1a290f391704e1adf794dfaf1167f652c2ad29119b4d7bf1bcafcd5e7055af`

## 1. 审计结论

Codex v4 后端已经提供本轮前端主线所需的关键接口与约束，**没有发现阻止本轮前端施工的硬性缺口**：

- Active Context 更新；
- Run propose / create / dispatch；
- `analyze / create / revise` 显式意图与结果策略校验；
- Provider 状态；
- Workspace Membership 增、删、移、查；
- Workspace State 保存、列表与恢复；
- Artifact / Revision 溯源与 Compare；
- Process Projection；
- Session Summary；
- Artifact Search。

后端 Guard 与本轮产品方向一致：

- `outputIntent` 必填；
- analyze / create 不能带 Edit Target；
-外部 Reference 不能作为 revise 目标；
- revise 只能生成 Draft Revision，不能覆盖 Current；
- Provider offline 时禁止发送；
- Workspace Membership 是成员真相。

因此本轮已直接开始并完成前端修改，没有再保留旧的 Run 配置页作为过渡层。

## 2. 仍需记录的后端契约边界

这些不阻止本轮 UI，但不能假装已经不存在。

### 2.1 单 Run 暂时只支持一个 Edit Target

`proposeRun` 已支持复数 `editTargets`，但 `CreateRuntimeRunInput` 仍为单数：

- `targetArtifactId`
- `targetRevisionId`

所以当前前端允许多个 Context，但每次 revise 只选一个编辑对象。后续要支持“一次分别修改多个目标”，应先扩展真实 Run 创建契约，不能只在 GUI 里多选然后暗中循环提交。

### 2.2 Process / Session 节点尚不是一等 Run Context

过程投影与 Session Summary 已能显示在 Canvas，但当前真实 Run Context 输入仍以 Artifact / Revision ID 为主。因此：

- 文件、引用和 Managed Artifact 可以进入真实 Run Context；
- Run / Session Summary 等过程节点目前主要承担可视化溯源；
- 若要直接框选一组过程节点作为下一次 Agent Context，需要后端增加 Process Entity / Context Snapshot 的一等引用契约。

### 2.3 Agent Canvas Skill 仍未完整

后端台账显示 Workspace / Membership / Session / Revision 的 CLI/MCP 已就绪，但 Canvas 的 link / unlink / arrange 等 Agent 工具还未补齐。这不会阻止用户在 GUI 中管理，但“本地 Agent 替用户完整搭建、连线和整理节点”的目标尚未完全兑现。

### 2.4 waiting_input 协议仍未开放

本轮前端没有伪造等待输入的交互状态。歧义只使用 `proposeRun` 返回的单个最小问题，真实 Run 内部的 waiting_input 留待协议完成。

## 3. 本轮前端修改

### 3.1 删除独立 Run 发起页

- 删除 `RunConfirmDialog.tsx`；
- 不再从 Canvas 跳转到僵硬的 Run 配置界面；
- Run 从选区下方 Composer 或右侧全局 Composer 直接发起；
- Work Rail 只负责运行状态、返回、Compare、Review、Accept / Reject / Retry。

### 3.2 选区下方 Composer

新增 `SelectionComposer.tsx`：

- 输入 Prompt；
- 选择范式：分析 / 创建 / 修改；
- 选择本地 Agent：Auto / WorkBuddy / Codex；
- 选择结果落点；
- revise 时显式选择一个受管 Edit Target；
- 点击右侧箭头直接 propose 并创建 Run；
- Provider offline 时明确禁用；
- 外部 Reference 只提供分析 / 创建，不提供修改。

### 3.3 上下文范围语义

- 单选：当前节点 + 一跳直接连线节点；
- 多选 / 框选：严格只使用所选节点；
- 右侧全局 Composer：当前 Workspace 全部成员；没有 Workspace 时使用当前 Scope / Canvas；
- Edit Target 与 Context 分离，不再靠节点类型或连线猜执行方式。

### 3.4 Revision 与 Prompt 溯源

- 选择有来源 Run 的 Revision 时，读取 Artifact Detail / Revision List；
- Composer 显示 Revision、来源 Run、Provider、时间和原 Prompt；
- 原 Prompt 自动回填，可继续修改后发起新 Draft；
- 历史版本只读，基于历史继续时不会覆盖旧 Revision；
- Workbench 补充 Revision Timeline、来源信息和“基于此版本继续”。

### 3.5 Workspace 成员与工作现场

- 选区可加入当前 Workspace；
- 可从 Workspace 移出；
- 可移动到其他 Workspace；
- 当前 Workspace 中导入、新建和 Run Return 默认加入该 Workspace；
- Workspace Dock 增加“保存当前工作现场”和“工作现场历史”；
- UI 不再暴露抽象的“创建 Checkpoint”，底层仍可复用其持久化能力；
- 新增 `WorkspaceStatesDialog.tsx`，支持列表、保存与恢复。

### 3.6 内容对象弱框架、过程对象强表达

- 图片优先直接显示真实缩略图；
- 无预览时不再使用假场景占位图；
- PPT / PDF / MD / Link / File 使用自己的类型图标、标题和来源信息；
- Link 显示标题 / 域名降级信息；
- 创建时间、来源 Run、Provider 在近距离可见；
- Process Node 显示 Prompt 摘要、时间、Context / Target / Output 数量；
- Session Summary 投影为过程节点，并与相关 Run 建立关系。

### 3.7 合并上一版可用视觉能力

从未被 Codex 合并的 Editorial Spatial vNext 中保留并重新适配：

- Porcelain Studio 2.0 视觉基线；
- Revision Stack / Backplates；
- Return Group Mat；
- Studio Mat 风格 Workspace Frame；
- 连续 Zoom 的信息密度分层；
- 只有 Active Edge 持续轻微流动；
- Workbench Revision Timeline；
- 内容骨架分型与克制的节点框架。

没有引入：

- Agent Action Panel；
- 飞书多维表格；
- Eagle / ima；
- 图片或视频生成平台；
- 新的固定业务页面。

## 4. 主要文件变化

### 新增

- `apps/web/src/features/canvas/SelectionComposer.tsx`
- `apps/web/src/features/workspace/WorkspaceStatesDialog.tsx`
- `apps/web/src/runtime/projectionAdapters.ts`
- `FRONTEND_VNEXT_AUDIT_20260803.md`

### 删除

- `apps/web/src/features/create/RunConfirmDialog.tsx`

### 重点修改

- `apps/web/src/App.tsx`
- `apps/web/src/features/canvas/ProjectCanvas.tsx`
- `apps/web/src/features/canvas/CanvasNodeVisual.tsx`
- `apps/web/src/features/canvas/NodeInfoPopover.tsx`
- `apps/web/src/features/canvas/NodeContextToolbar.tsx`
- `apps/web/src/features/create/CreateContentDialog.tsx`
- `apps/web/src/features/workbench/ArtifactWorkbench.tsx`
- `apps/web/src/features/workrail/WorkRail.tsx`
- `apps/web/src/features/workspace/WorkspaceDock.tsx`
- `apps/web/src/runtime/localCoreClient.ts`
- `apps/web/src/runtime/runtimeBridge.ts`
- `apps/web/src/model.ts`
- `apps/web/src/porcelain-studio.css`
- 相关 v0.6 交互测试断言

## 5. 本环境验证结果

### 已通过

- TypeScript / TSX 语法解析：89 个源码文件，0 个语法错误；
- CSS 解析：
  - `porcelain-studio.css`：464 rules，0 errors；
  - `surface.css`：932 rules，0 errors；
  - `foundation.css`：466 rules，0 errors；
  - `v07.css`：68 rules，0 errors；
  - `v071.css`：125 rules，0 errors；
- 源码契约检查：
  - RunConfirm 主路径删除；
  - Selection Composer 已挂载；
  - 单选一跳、多选严格范围；
  - Workspace Membership / State；
  - Revision Provenance；
  - Offline Provider 门禁；
  - External Reference context-only；
  - 内容身份视觉；
  - Process Projection / Session Summary；
  - Revision Stack / Return Group / Active Edge 保留。

### 本环境未能完成

本运行环境无法取得完整 npm 依赖，安装过程无法访问所需 Registry；Browser 插件也不在当前会话中，Playwright / Chromium 对 localhost 与 file 导航被平台策略阻止。因此本轮不能诚实宣称以下项目已重新全绿：

- 完整 `tsc`；
- Vitest；
- Vite build；
- 真实 Local Core / Bridge 联调；
- 浏览器视觉与交互 E2E。

v4 基线包记录的 394 测试、4/4 typecheck 与 build 通过，只代表 Codex 打包时的基线，不代表本轮前端 Delta 已完成全量验证。

## 6. Codex / 本地环境验收命令

```bash
npm install
npm run typecheck --workspace @local-creative-os/web
npm run test --workspace @local-creative-os/web
npm run build --workspace @local-creative-os/web
npm run test:e2e
```

真实联调至少应覆盖：

1. 单选 Managed Artifact → revise → 新 Draft → Review → Accept；
2. 单选 External Reference → 不出现 revise；
3. 框选多项 → Context 严格等于所选项；
4. 右栏发送 → Context 等于当前 Workspace；
5. Agent offline → 禁止发送；
6. 加入 / 移出 / 移动 Workspace 后刷新仍保持；
7. 保存工作现场 → 修改成员 / Revision → 恢复现场；
8. 选择历史 Revision → 原 Prompt 回填 → 基于历史生成新 Draft；
9. 过程投影与 Session Summary 在刷新后恢复；
10. 图片、PPT、PDF、MD、Link 的真实内容身份展示。

## 7. 当前产品边界

本轮没有重新发明全能 Canvas。当前主线已经压缩为：

> 选择上下文 → 指定或不指定编辑对象 → 选择本地 Agent → 直接发起 Run → 查看过程 → 安全管理 Revision → 保存 Workspace 工作现场。

这次修改解决的是交互模型，而不是继续给旧模型换一层更漂亮的瓷砖。
