# LCOS 前端包｜VNext.3 Capability Freedom Refactor

日期：2026-08-08
输入基线：`frontend-package-20260808-phase4-silk.zip`
输入 SHA256：`6388ac5cfc8b91e0404582f38c8c7083deb6bf357c0ea498f8bbe2fe72099d1d`

## 本轮原则

- 保留 Phase4 Silk 已经顺手的 Shell / Canvas / Drop / Relation / Camera / Workbench / Workspace 实现。
- 保留左侧 Rail + 底部 Capability Bar + 中央 Canvas + 右侧 Run Rail 的大框架。
- 删除 / 隐藏的是固定业务语义与强制流程，不是能力入口。
- 用户层底部：`整理 / 上下文 / 工作流`。
- Run 只在右侧执行列表。
- Context History 只属于单条导入对话，不自动等同整个 Project History。
- Workflow 是自由项目图，不强制固定 Step Schema。

## 主要代码变化

- `SurfaceDock.tsx`
  - 三能力入口；旧 work/deliver surface id 仅做持久化兼容并迁移到 workflow。
  - Projection pills 间距与按钮布局修正。
- `WorkflowSurface.tsx`
  - 新增自由 Workflow Canvas renderer，不使用固定泳道。
- `ContextFlowSurface.tsx`
  - 去掉 feedback/session/artifact 固定 lane，改为无业务 taxonomy 的自由投影。
- `ContextGraphSurface.tsx`
  - Relation filter 根据当前项目真实 Edge kind 动态生成，不再硬编码四种关系。
- `WorkspaceDialog.tsx`
  - GUI 移除 understand/explore/build/decide intent picker；底层兼容字段仍可保留。
- `WorkspaceRailVNext.tsx`
  - Hover Preview 不再显示固定 Context Policy 业务标签。
- `ConversationContextDialog.tsx`
  - 新增单对话 GPT Desktop 式 `Change Navigation Rail`。
  - 重要性图形点、Hover 摘要、点击平滑定位与短暂高亮。
  - “提升为决策”改成中性的“标为重点”。
  - Agent 标注 Prompt 面向“重要修改 / 方向变化 / 确认点”，不建立项目级 ontology。
- `WorkRail.tsx`
  - 增加最近 Run 列表；Waiting / Review / Failed 等状态可以快速打开。
- `App.tsx`
  - ProjectStrip 的 Pending 打开右侧 Run Rail。
  - History 打开导入对话记录。
  - Project ContextSnapshot / Handoff 不再被默认投影成“当前对话历史”。
  - Workspace preferredSurface 兼容迁移。
- `ProjectCanvas.tsx`
  - Drop staging 独立记录 stageAnchor。
  - 离开边缘时 gutter 立即熄灭；Ghost 可继续拖到已展开的 Destination Sheet。
  - 实际节点始终留在原位；中央松手取消；Destination 上松手直接投送。
- `reconstruction.css`
  - 不新增第六层 CSS，继续在 active reconstruction layer 收口。
  - 图标 / 文案同行、最小间距、Run List、Workflow / Context Free、Conversation Change Rail 等视觉。

## 验证

### Source contract

`node validate-vnext3.mjs`

结果：`29 / 29 PASS`

### TypeScript syntax parse

系统 TypeScript parser 扫描：

`apps/web/src/src + apps/web/tests`

结果：`120 TS/TSX, 0 syntax errors`

### 实际浏览器交互 Harness

Browser plugin 不在当前环境；普通 Playwright `page.goto(http://127.0.0.1...)` 被管理员策略拦截，因此使用系统 Chromium + Python Playwright `set_content()`，载入**当前正式 reconstruction.css**与对应交互测试 DOM。

实际用鼠标 / 控件完成：

- 顶部图标间距；
- Projection 按钮间距；
- Canvas / Bottom Dock 安全区；
- Minimap 避让；
- 连线 Anchor 反缩放；
- 多选；
- 拖入 Bottom Drop；
- 真实 Node 回原位 + Ghost；
- 离开边缘 gutter 熄灭；
- Canvas 中央松手取消；
- Destination 上直接松手投送；
- Change Rail Hover 展开。

结果：全部 PASS，Console 0 error / warning。

> 注意：这是真实 Chromium 指针交互 Harness，不是假截图，但不是完整 React Runtime E2E。

### Full React install / build / E2E

当前沙箱运行 `npm install` 失败：内部 Registry 对 `@local-creative-os/contracts@0.1.0` 返回 404；上传包也不包含 monorepo 的本地 `packages/*` workspace 实现，因此无法在本环境重建完整 React Runtime。

输入 Silk 包自身 `BUILD_INFO.md` 记录其打包前：

- fast checks 全绿；
- Playwright E2E 3/3；
- 真实浏览器手测完成。

本轮不会把这个“输入包此前通过”冒充成本轮完整 React E2E。

## 正常仓库环境下一步验证

把本包覆盖回完整 monorepo 后运行仓库原有：

```bash
npm install
npm run check:fast
# 或至少 web typecheck / unit / build + phase4 playwright
```

重点真实浏览器手测仍是：

```text
拖一次
缩一次
多选一次
Drop 一次
再打开一条长对话点 Change Rail 定位一次
```
