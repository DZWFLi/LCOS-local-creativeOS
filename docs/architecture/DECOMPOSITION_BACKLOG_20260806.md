# LCOS 解耦与治理台账（2026-08-06）

## 已治理（本轮 + 前几轮）

```text
1. MCP CLI-first 精简：Agent 45 / Executor 8 白名单；执行器物理拆分 executor-tools.mjs
2. Skill 结构化：SPEC + 索引 + lcos-executor-run 拆分；入口 4K → 0.7K token
3. SSE 三源推送：active-context / proposals / runs，3s 轮询移除（仅流失败兜底）
4. 前端演示 harness 移除：queryState / perf fixture / RUN-044 / Thinker_Concept /
   重置演示数据按钮 全部删除（仅 dev 生效的验收 seed 不再留在 App.tsx）
5. CLI 命令面去重：task start 删除（run start 覆盖），task claim 保留（claim-next 语义不同）
6. 存储：.v5/.v17 迁移备份移至 %TEMP%\lcos-db-backups-20260806；WAL 已 checkpoint
7. 会话失效→新建、运行中取消、Retry 指令、多待审导航、A1 MCP 加载 等修复（见验收报告）
```

## 待办：解耦（Phase 1-3）

### Phase 1 — 结构拆分（行为不变）

- `apps/web/src/App.tsx`（约 2900 行）拆为：
  AppShell / CanvasHost / WorkRailHost / AgentCardHost / DialogsHost；
  每个 Host 只通过 contracts + runtime 客户端访问 Core。
  - ✅ 完成：`features/shell/AppShellView.tsx` 组装 Drive / TopBar / Scene /
    WorkRail / Dialogs；`CanvasSceneHost.tsx`（Dock + Canvas + Mini-map +
    面包屑 + 状态浮层）、`WorkRailHost.tsx`、`DialogsHost.tsx`（14 类弹窗 +
    复杂弹窗逃生口）；`AgentContextSurface.tsx` + `appShell.ts` +
    `runtime/messages.ts` 上一轮已迁出。App.tsx 只保留编排与 props 组装
    （约 2930 行，JSX 展示层已全部外迁）。
- `apps/local-core/src/server.ts`（约 3000 行）路由拆分 `routes/*` + 服务装配 `compose.ts`。
  - ✅ 完成：`routes/` 下 13 个模块（route-context 共享守卫/helpers、
    runtime-reviews、conversations、projects、canvas、context-proposals、runs、
    lcosproj、artifacts、workspace-states、connectors、executor、runtime、
    imports、resources、entity、multipart）；server.ts 从 3014 行降至 670 行，
    分发器只剩健康检查 + 模块调用 + entity/fallback。

### Phase 2 — 契约与适配

- web `model.ts` 视图模型 → contracts 显式适配层全覆盖（projectionAdapters 补全）+ 架构测试。
  - ✅ projectionAdapters 覆盖测试（artifact revisions / workspace states /
    process projection / session summaries / revision compare）：
    `apps/web/tests/projectionAdapters.test.ts`；
  - ✅ 适配层边界测试：`tests/architecture/projection-adapters-boundary.test.ts`
    （只依赖 contracts + model，不碰 React/features）；
  - ✅ 既有 shell 边界测试保留：`tests/architecture/web-shell-boundaries.test.ts`。
- CSS 主题收敛（用户暂缓；v07/v071/porcelain 三套并存）。
- ✅ `qa-fixtures/` 已退出生产路径：`createBlankProjectState` 迁至
  `state/projectState.ts`；App.tsx 不再 import qa-fixtures，目录只被
  `apps/web/tests/*` 引用；边界测试 `tests/architecture/qa-fixtures-boundary.test.ts`
  阻止生产代码回引。

### 本轮验证

```text
check:fast（lint → typecheck → web 134 / core 252 / domain / contracts 测试
  → 架构 69 → web build）✅
smoke:gatef-core（新代码进程内全链路 + schema/capabilities）✅
真实 HTTP 抽查（connectors/executor/projects/graph/active-context/
  context-proposals/workspaces/artifacts/runs/providers/states/revisions）全部 200 ✅
```

### 提交

```text
3069c3c refactor(shell): extract AgentContextSurface + runtime-review route + boundaries test
eaf754f refactor(core): extract conversations/projects/canvas/proposals/runs route modules
8f6033a refactor(core): extract lcosproj/artifacts/workspace-states route modules + shared multipart
9397a93 refactor(core): extract connectors/executor/runtime/imports/resources/entity route modules
03eb9c0 refactor(shell): split App JSX into AppShellView + Canvas/Dialogs/WorkRail hosts
102d2b2 feat(phase2): fixtures out of prod + projection adapter coverage tests
```

### Phase 3 — Gate W 前置

- 能力注册表：✅ 已建 `tools/lcos-runtime/capabilities.json` + 校验脚本 +
  dev-launcher 接线；安装器/托盘/文件关联只读它。
- 双同步机制结论：RuntimeAutoSyncService（Core 侧收结果）+ 看门狗（派新活）为互补，
  保留并写入 `RUNTIME_CAPABILITY_REGISTRY_20260806.md`，禁止再叠第三套。
- created/planned 状态 Run 的 cancel：✅ 已修复（本地转移 cancelled + run.cancelled 事件 +
  回归测试）。
- 剩余：安装器/托盘/文件关联本体（Gate W 交付物）。

## 待办：功能

```text
Checkpoint 状态对比 / Preview 外部打开 / Handoff 文件级 zip / 文件夹扫描确认页
Eagle/IMA/收藏夹连接器 / L3 Ollama + sqlite-vec（等本机 Ollama 就绪）
SSE 推送延迟量化 / 执行会话按 N 轮轮换 / run.started 事件语义文档
backend/frontend/workbuddy 三个 skill 迁入 packages/skills
L1/L2 真实对话导入基准（省 token 实测）
```

## 本地环境备注

- `.bak` 已移至 `%TEMP%\lcos-db-backups-20260806`（可恢复）。
- 4 条 created 惰性 Run（从未派发）保留在 DB，取消接口暂不支持 created 状态；
  不影响看门狗（dispatch=planned 不会被 pick）。
