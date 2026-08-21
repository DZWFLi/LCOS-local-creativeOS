# Phase A Handoff｜Runtime Foundation + Late-Binding

> 日期：2026-08-11
> 施工包：LCOS A-H FINAL V2.2（00_MASTER_AH_FINAL_V2.md）
> 完成标准：05_PRODUCTION_COMPLETION_DOCTRINE（真实入口 / 真实数据 / 真实持久化 / 重启正确 / 无 mock）

---

## Completed

Phase A 目标：先解决"LCOS 仍像本地 Web 工具"的根问题。本轮完成四块：

1. **Project Runtime Registry**（A5）：`~/.lcos/runtime/registry.json` 持久化，含 recentProjects（≤20）/ lastFocusedProjectId / pinnedCaptureProjectId；Core 启动即加载，崩溃/损坏自动恢复为空。
2. **Project Focus Signal**（A6）：`POST /runtime/projects/:id/focus`，前端项目 Tab 在 focus / visibilitychange 时上报；Web 新端点 `GET /runtime/registry`、`POST /runtime/registry/capture-target`（pin/unpin）。
3. **Project Reveal Folder**（A9/A10）：`POST /projects/:id/reveal`，只允许 metadata 中已注册的 project root，禁止任意路径；GUI 在 ProjectStripVNext（项目条）和 ProjectDrive（项目卡片）各加文件夹图标，一键打开资源管理器。
4. **Zero Naming（TitlePolicy）**（A11-A15）：schema v24 为 projects/workspaces/artifacts/scopes 增加 `title_mode`（默认 `auto`）；`POST /entities/:type/:id/title` 支持 auto/manual/locked；前端"新建子画布/新建工作空间"去必填名（留空自动 fallback，Agent 可后续改名）；节点行内改名写回 Core 且标记 `manual`（修复了此前只改前端内存、Core 不认的断链）。
5. **Local Intelligence capability probe**（A16）：`GET /runtime/local-intelligence` 探测 Ollama（loopback 守卫 + 2.5s 超时），失败返回 unavailable，不影响主链。

**附带发现**：本机 Ollama 已安装（v0.32.6），`nomic-embed-text:latest` 已就绪 —— Phase F 的向量检索可直接激活（此前记录"Ollama 未装"已过时）。

## Backend / Runtime

新增文件：

- `apps/local-core/src/runtime-registry-service.ts` —— RuntimeRegistryV0 + 原子写（tmp+rename）+ 损坏自愈
- `apps/local-core/src/local-intelligence-service.ts` —— Ollama probe
- `apps/local-core/src/os-integration.ts` —— revealRegisteredPath（Windows explorer / macOS open -R / Linux xdg-open；只接受绝对路径 + 存在性校验）

修改文件：

- `apps/local-core/src/metadata-repository.ts` —— schema v24 迁移；`updateEntityTitle` / `getEntityTitleMode`（表/列白名单，不接受拼接）
- `apps/local-core/src/compose.ts` —— 装配 runtimeRegistry + localIntelligence
- `apps/local-core/src/server.ts` —— 5 个新路由（focus / registry / capture-target / reveal / local-intelligence / entity title）
- `apps/local-core/src/index.ts` 未改（新服务走 compose 默认装配）

## GUI / Frontend

修改文件：

- `apps/web/src/App.tsx` —— Focus Signal effect；renameNodeTitle 写 Core（manual）；drive/strip 接入 reveal；ProjectDrive 卡片改为新标签页打开（Launcher 语义）
- `apps/web/src/features/shell/ProjectStripVNext.tsx` —— 新增"在资源管理器中打开项目目录"图标
- `apps/web/src/features/project/ProjectDrive.tsx` —— 项目卡片新增文件夹按钮
- `apps/web/src/features/create/ScopeCreateDialog.tsx` —— 名称可选（"留空稍后自动命名"），创建不再被名称阻塞
- `apps/web/src/features/workspace/WorkspaceDialog.tsx` —— 创建模式名称可选，编辑模式仍必填
- `apps/web/src/runtime/localCoreClient.ts` —— 新增 6 个 client 方法
- `apps/web/src/features/shell/AppShellView.tsx` —— 透传新 props
- `apps/web/src/vnext.css` / `surface.css` —— reveal 按钮样式（沿用现有设计语言）

设计语言约束：全部沿用现有 vnext 视觉（小尺寸、低对比 hover、不新增配色体系）；没有新增任何大页面/向导。

## CLI

本 Phase 未改 CLI（Registry/Reveal/Title 走 Core HTTP；CLI 后续 Phase 视需要暴露）。

## Node / Relation / Presentation semantics

- 名称 ≠ Identity 正式落库：stable id 不变，display title 增加 auto/manual/locked 状态。
- 用户改名 → manual：Agent 后续不得自动覆盖（Phase E naming policy 会再次写入 Skill）。
- Project root 与 display title 解耦：reveal 走 rootPath，与 name 无关。

## Ollama / Local Intelligence impact

- 只探测、不启动、不下载、不阻塞（A21）。
- 本机探测结果：`provider=ollama, available=true, version=0.32.6, embeddingModels=[nomic-embed-text:latest]`。

## Files changed

见上方 Backend/GUI 列表 + 测试文件：

- `apps/local-core/tests/runtime-registry-service.test.ts`（6 用例）
- `apps/local-core/tests/local-intelligence-service.test.ts`（4 用例）
- `apps/local-core/tests/os-integration.test.ts`（2 用例）
- `apps/local-core/tests/title-policy.test.ts`（4 用例）
- `scripts/phase-a-smoke.mjs`（真实 HTTP 冒烟：8 项全过）
- 4 个既有测试文件 schemaVersion 23→24 快照更新

## Contracts frozen

- `RuntimeRegistryV0`（schemaVersion 0）
- `LocalIntelligenceStatusV0`
- `TitleModeV0 = 'auto' | 'manual' | 'locked'` + `EntityTitleInputV0`
- HTTP 路由：`POST /runtime/projects/:id/focus`、`GET /runtime/registry`、`POST /runtime/registry/capture-target`、`GET /runtime/local-intelligence`、`POST /projects/:id/reveal`、`POST /entities/:type/:id/title`

## Migrations

- SQLite `user_version` 23 → 24：projects / scopes / workspaces / artifacts 增加 `title_mode TEXT NOT NULL DEFAULT 'auto'`（ALTER TABLE ADD COLUMN，幂等）。

## Tests

- Core：61 个测试文件 / 298 用例全过（含新增 16 个）
- Web：60 个测试文件 / 274 用例全过
- 真实 HTTP 冒烟 `node scripts/phase-a-smoke.mjs`：项目创建 → focus → registry → pin/unpin → reveal（404 与成功路径）→ title 改名（200 + bad mode 400）→ local-intelligence → registry 落盘，全部通过

## Manual evidence

- reveal 的真实 explorer 弹出在 smoke 中触发成功（200 返回）；本机为 Windows，explorer.exe 已收到路径。
- Ollama probe 真实返回 v0.32.6 + nomic-embed-text。
- GUI 部分（folder 按钮点击、新标签页打开、去必填名弹窗）已过类型/构建/测试，尚未做真人点击验收 —— 列入 Phase H Golden Acceptance 统一验收。

## Source references actually used

- `00_MASTER_AH_FINAL_V2.md`（A1-A21 全部条目）
- `05_PRODUCTION_COMPLETION_DOCTRINE.md`
- `sources/architecture/LCOS_LATE_BINDING_ZERO_SELECTION_ZERO_NAMING_20260811.md`（用户桌面文件，核心原则）
- `sources/research/LCOS_GUI_SURFACE_SKILL_GAP_INVENTORY_20260811.md`（§1.1/§1.4/§2 现状交叉验证）

## Compatibility still present

- 旧数据库自动迁移 v24，无需手工步骤。
- 旧前端调用不受影响（新增方法均为可选能力；renameNodeTitle 在原型模式仍只改本地）。
- `disposable-mvp-sample` 原型模式不受影响（bootMode !== runtime 时 reveal 提示、focus 不上报）。

## Explicitly NOT implemented

- ❌ Browser Extension / Capture 插件（Phase C）
- ❌ Project Affinity Resolver + Staging（Phase B）
- ❌ Ollama 模型下载/embedding（Phase F）
- ❌ Tray 全局快捷键（Phase A 只要求 capability foundation；现有 tray 脚本保留，未扩）
- ❌ `.lcosproj` 双击关联 / 安装器（Phase J）
- ❌ GUI 真人点击验收（Phase H 统一做）

## Next risks

1. `projects.name` 仍是 NOT NULL（Phase A12 兼容策略）：fallback 显示依赖前端判断；如果 Agent 自动命名在 Phase D/E 频繁更新名称，建议届时评估真正 nullable。
2. ProjectDrive onOpen 改为新标签页后，单实例"最近待处理"点击也会开新 tab —— 行为一致，但用户可能期望部分场景原地切换；Phase H 统一手感评审。
3. `runtimeFocusProject` 每 2.5s 超时 + focus 事件触发频率低，无性能风险；但 visibilitychange 在后台 tab 恢复时只报一次，符合预期。

## Commit

提交将在本 Handoff 完成后执行（见 git log）。

