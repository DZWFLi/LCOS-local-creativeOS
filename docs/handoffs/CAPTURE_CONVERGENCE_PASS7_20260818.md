# LCOS 0.1 Capture Convergence PASS7 · Handoff
日期：2026-08-18
状态：SOURCE COMPLETE / FULL WORKTREE QA PENDING

## 1. 本轮目的

PASS7 直接建立在 Desktop Alpha PASS6 之上，把 0.1 Capture 收成一条单一路径：

```text
Browser / Agent / Clipboard / Explorer
                ↓
          Capture Transport
                ↓
           Capture Space
         （系统级暂存画布）
                ↓
      AI 整理 / 用户空间整理
                ↓
     Semantic Drop → Project
                ↓
       Project Main Canvas
```

PASS7 是给 Codex 的新单一交接基线。**不要再单独合 PASS6。**

## 2. 产品冻结

### Capture Space

- 系统级，不属于任何 Project。
- 不是隐藏的 `__capture_project__`。
- 没有 Context / Workflow / Project Run 语义。
- 保留 Canvas 基础能力：自由摆放、多选、框选、对齐/分布、轻量 Region、Semantic Drop、AI Arrange、真实材料预览。
- AI 可以根据内容、来源和 project affinity 做匹配与分组，但不能未经用户动作自动把材料归入项目。

### Capture payload 与 Presentation 分离

- Capture payload truth：`capture_staging_items` + blob/cache。
- Cache 默认根：`~/.lcos/capture-staging/blobs/<sha256>`。
- Capture presentation truth：全局 `capture_space_presentation`，只保存 x/y/size/collapsed/fixed/regions。
- Capture materialize 到 Project 后，项目获得 Artifact/View/ImportBatch；原 capture blob/cache **不因这次投送被删除**。

### Capture Float

- 旧 `scripts/capture-assistant.ps1` / `43123/wake` 只保留历史审计，不再属于 0.1 正式产品路径。
- Desktop Host 新增独立 Electron `CaptureWindow`：frameless / always-on-top / skipTaskbar / 常驻。
- 悬浮窗只负责收东西、显示待整理数量/最近项、打开 Capture Space。
- 它不是缩小版 Project，也不做项目分配 UI。

### Browser Extension

- Canonical 0.1 源：`extension/`。
- 默认 `target.mode = staging`，即进入 Capture Space。
- 不再 wake 43123，不再默认 `auto` 偷投最近项目。
- `apps/browser-extension/` 暂视为旧/历史实现，PASS7 不删除，待 Codex 合并后做 census 再决定。

### 本地真实项目文件整理

0.1 明确不做：

- 不让 AI move/rename 真实 Project Folder。
- 不实现 FileOperationJournal / Windows File ID / Adobe dependency relink 等 P0 大系统。
- 只保留 Capture Space 内的 AI 分类/匹配/摆放。

## 3. Core 新增/修改

### Metadata schema 37

新增：

```sql
capture_space_presentation
```

只保存系统级 Capture Presentation。

### CaptureSpaceService

新增：

- `snapshot()`
- `savePresentation()`
- `preview()`
- `organize()`
- `materializeToProject()`

### Core routes

- `POST /runtime/capture-space/enqueue`
- `GET /runtime/capture-space`
- `PUT /runtime/capture-space/presentation`
- `GET /runtime/capture-space/items/:id/preview`
- `POST /runtime/capture-space/organize`
- `POST /runtime/capture-space/materialize`

`enqueue` 是 Desktop Runtime Host 的受信入口，复用 CaptureGateway 的 `CaptureRequestV1` 逻辑。

### 修复：text staging blob

旧路径有机会只生成 `blob:<hash>` metadata，却没真正写 text bytes。PASS7 将文本 payload 以 `TextEncoder` 写入 blob root，避免后续 preview/materialize 读到空气。

## 4. Web UI 收敛

新增：

- `CaptureSpace.tsx`
- `CaptureFloatApp.tsx`

变化：

- Project Drive 固定出现 Capture Space 入口。
- `/capture` 是系统 Capture Space。
- `?surface=capture-float` 只渲染独立 Float UI。
- 旧 StagingDialog 已从 active DialogsHost 脱钩，文件暂留历史兼容。
- `ProjectCanvas` 新增 `surfaceMode="capture"`：保留空间编辑，关闭 Project-only relation / Collection / delete-view 等动作。
- Capture Project Rail 直接复用现有 Semantic Drop project target contract。

## 5. AI 整理边界

`organize()`：

- 低频调用现有 Utility intelligence provider。
- 模型输入包含 title/kind/source/url/path、文字摘录、suggestedProjects。
- 输出仅 group/region + project hint。
- 模型不可用时按已有 affinity + material kind deterministic fallback。
- 只改 Capture Presentation，不改 Project Truth。

## 6. Capture → Existing Project

`materializeToProject(captureIds, projectId)`：

- 校验 Project/root scope。
- URL / text / blob / local file 复用现有 import/text artifact 链。
- 复用 `CapturePlacementService`，只摆新节点，不移动项目已有节点。
- 记录 ImportBatchRef。
- staging item 标记 resolved。
- 从 Capture Space Presentation 移除已投送节点。
- 不删除源 blob/cache。

0.1 限制：一个 staging item 当前只 resolve 到一个 Project；多 Project 重复投送不是本轮目标。

## 7. Desktop Source

PASS7 继承 PASS6 Runtime Supervisor，并新增：

- Electron CaptureWindow
- native file drag path via `webUtils.getPathForFile()`
- Desktop trusted capture enqueue
- tray: Open Capture Space / Show-Hide Capture Float
- capture success/error IPC

**Desktop installer / Squirrel make 仍暂停。**

## 8. 验证

当前独立交付包没有 `node_modules`，所以只做到 Source Gate：

- changed TS/TSX syntax transpile：PASS
- Electron main/preload `node --check`：PASS
- canonical extension JS `node --check`：PASS
- extension manifest JSON：PASS
- CaptureRequest default target=staging sanity：PASS
- extension ZIP SHA256：PASS
- `interaction-system.css` / `surface.css` PostCSS parse：PASS

完整 Web typecheck 尝试结果：环境缺 `@types/node` 和 `vite/client`，因此 BLOCKED。不是 PASS7 代码级 type error 证据。

## 9. Codex 合并后必须验证

只合 PASS7 一次，之后：

1. 安装/恢复完整 workspace deps，更新 lockfile（如必要）。
2. 全量 typecheck。
3. affected Core/Vitest + extension tests。
4. Web production build。
5. 浏览器视觉/交互 QA：Capture Space。
6. Desktop dev-source QA：Capture Float 接文件/文字/URL、打开 Capture Space。
7. Semantic Drop：Capture → Existing Project，并验证项目旧节点不移动。
8. Restart：Capture positions/regions/pending items 持久化。

本轮不要跑 `desktop:make:win` / Squirrel installer。
