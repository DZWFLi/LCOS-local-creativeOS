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
  - ✅ 第一片：AgentContextSurface 迁至 `features/shell/AgentContextSurface.tsx`；
    `createId / runtimePresentationStatus / fileNameFromPath / buildScopePath /
    isTextPreviewFile / inferFileType` 迁至 `features/shell/appShell.ts`；
    `humanizeRuntimeMessage` 迁至 `runtime/messages.ts`。App.tsx 2750 行。
  - ⏳ 剩余：JSX 尾部迁为 AppShellView（CanvasHost / WorkRailHost / DialogsHost
    组合），App.tsx 只留编排。
- `apps/local-core/src/server.ts`（约 3000 行）路由拆分 `routes/*` + 服务装配 `compose.ts`。
  - ✅ 第一片：`/artifact-returns/:id/(accept|reject|retry)` 迁至
    `routes/runtime-reviews.ts`（注入式 context，server.ts 约 40 行 → 15 行）。
  - ⏳ 剩余：context-proposals / runs / conversations / resources / workspaces
    / active-context 等路由组继续外迁。

### Phase 2 — 契约与适配

- web `model.ts` 视图模型 → contracts 显式适配层全覆盖（projectionAdapters 补全）+ 架构测试。
  - ⏳ projectionAdapters 覆盖审计（web model 与 contracts 一致性）进行中；
  - ✅ 架构测试首块：`tests/architecture/web-shell-boundaries.test.ts`
    （features 不得 import App、runtime client 不得 import features）。
- CSS 主题收敛（用户暂缓；v07/v071/porcelain 三套并存）。
- `qa-fixtures/` 归档：fixtures 只留给测试，不进生产包。

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
