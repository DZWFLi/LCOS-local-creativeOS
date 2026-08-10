# Phase B Handoff

## Completed

- **SQLite v21**：`presentation_views` 表（aggregate JSON + CAS + 双索引），`user_version=21`
- **Repository 薄层**：`getPresentationView / listPresentationViews / insertPresentationView / compareAndSwapPresentationView / deletePresentationView`（只做 SQL + JSON 映射）
- **PresentationApplicationService 正式实现**：project/scope/member 归属校验、hierarchy/edges 只引用 member、`STALE_PRESENTATION_VERSION` 冲突（带 currentVersion）、graphVersion 永不因 presentation 变更
- **HTTP 路由**：GET list / GET one / PUT（contract + expectedVersion）/ DELETE / SSE stream（`afterVersion` 轻量变更推送）
- **Web facade**：`presentationViewState.ts`（可测 session 核心 + hook + 模块 bridge）：load / seed / optimistic patch / debounced save / CAS retry once / SSE 远端刷新 / Core 不可用时 memory fallback
- **Context / Workflow membership 持久化**（B9）：App 打开时 seed（context 用 workspace focus 经 resolver 语义），Agent 可写同一份，刷新/重启后恢复；用户编辑 write-through
- **Draft / Hierarchy 镜像**（B8）：positions / presentationEdges / pinnedViewIds / hierarchy 持久化；edge-cut hidden ids 保持 memory（契约无 edge 级语义，已注明）

## Files changed

```text
apps/local-core/src/metadata-repository.ts          v21 migration + CRUD/CAS
apps/local-core/src/presentation-repository.ts      interface
apps/local-core/src/presentation-application-service.ts  校验 + CAS + listener
apps/local-core/src/routes/presentations.ts         HTTP + SSE
apps/local-core/src/compose.ts / server.ts          装配 + 注册
apps/local-core/src/errors.ts                       STALE_PRESENTATION_VERSION
apps/local-core/tests/presentation-persistence.test.ts  5 用例
packages/contracts/src/index.ts                     error code 扩展
apps/web/src/runtime/localCoreClient.ts             presentation CRUD + SSE
apps/web/src/state/presentationViewState.ts         facade + bridge + membership hook
apps/web/src/state/presentationDraftState.ts        镜像
apps/web/src/state/presentationHierarchyState.ts    镜像
apps/web/src/features/presentation/presentationHierarchy.ts  契约转换器
apps/web/src/App.tsx                                context/workflow membership 接入
apps/web/tests/*（4 新文件 + runtimeBridge mock）
tests/architecture/presentation-contract.test.ts   断言更新（Phase B 契约已批准）
```

## Contracts frozen

```text
PresentationViewV0（schemaVersion 0）实际落库（aggregate JSON + CAS）
稳定 ID：presentation:<capability>:<scopeId>
版本语义：presentation.version 独立于 project.graphVersion（硬 Gate 测试覆盖）
```

## Migrations

```text
v20 → v21：CREATE TABLE presentation_views + 2 indexes + user_version=21
旧库（v20 及以下）自动迁移；无数据回填（Presentation 可重建）
```

## Tests run

```text
npm run lint / typecheck                    : PASS
npm run test                                : web 260/260 · core 265/265 · domain 5/5 · contracts 4/4
npm run test:architecture                   : 86/86
npm run build                               : PASS
Playwright E2E（phaseb-e2e.mjs）            : 6/6（seed / agent write / reload 保留）
Core 重启保留                               : context v5 members=3 · workflow v7 members=2
```

## Acceptance evidence

```text
restart recovery        : repository reopen + Core 进程重启后 presentation_views 完整
CAS conflict            : service 抛 PresentationConflictError；HTTP 409；E2E 中 stale PUT 正确拒绝
cross-project member    : 非本项目 view 被拒（VALIDATION 400）
dangling edge           : 引用非 member 的 edge 被拒
graphVersion unchanged  : PUT presentation 前后 graphVersion 相同
SSE                     : afterVersion 过滤 + snapshot/update 事件
```

## Known compatibility paths still present

```text
prototypeStorage（fixture 模式）/ projectNavigation（camera，B13 明确不迁）
presentationDraftState / presentationHierarchyState（memory 保留，已镜像持久化）
WorkspaceIntent / NodeKind / title-regex / process-node heuristic（DEPRECATED_BEHAVIORAL_HINT）
Conversation Sections / ContextManifest / lcos-project-context Skill
```

## Explicitly NOT implemented

```text
ELK/fCoSE、visualFamily、CLI write、Skill、RAG、Ollama
Strands 的 strand-band 手动位置 / edge-cut hidden（契约无对应字段）
Arrange 位置迁移（保持 artifact_views.position，B12）
Camera 迁移（B13，写 TODO）
旧 memory store 删除（B15）
```

## Risks for next phase

```text
Phase C 做 Presentation Engine 时，positions 单份 aggregate 会被多个 renderer
共享：需要明确 last-write-wins 或 renderer 级 namespace。
resolver seed 仍存在于 App.tsx（usePresentationMembership seedMembers），
只作为 first-run seed，不再长期承担 Truth。
```

## Repository state

```text
branch  : codex/backend-hardening-20260802
commits : 638d589（Core）· 66c4cdb（Web）
HEAD    : 66c4cdb
dev 栈  : Core 43121 + Web 5173 以 phaseb token 运行（本轮 E2E 用）
```
