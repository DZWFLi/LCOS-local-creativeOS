# LCOS B6｜项目连续性运行时｜代码收口报告

日期：2026-08-16

## 目标

让“换一个 AI 不等于重新讲一遍项目”成为一个稳定 Runtime 合同，而不是 GUI 口号。

## 本轮完成

### 项目识别
复用 `resolveProjectAffinity`，并把 `session_context_refs` 纳入真实 Session Binding 证据。

### 会话绑定与恢复
复用既有 Session Context、Provider Session、Workspace、B4 WorkState/Intent/Attention。

### Resume Snapshot
一次返回：

- Project
- Workspace/Scene
- Session
- B4 Intent/Attention
- Context Pack
- Skill/Target
- Provider Session
- Realtime cursor

### 统一 Attach Bundle
新增 Provider-neutral attach contract。Codex/Claude/DeepSeek/未来 Harness 不需要理解 LCOS GUI 内部对象结构，只消费同一 bundle。

### 最小结果回流
外部 Agent 的总结/决策/下一步/产物引用写回复用现有：

- SessionSummary
- HandoffRecord
- Session Context refs

三者现在作为一个 SQLite transaction 提交，避免半份交接。

### CLI 连续性入口

```text
lcos continuity resolve
lcos continuity resume
lcos continuity attach
lcos continuity bind
lcos continuity return
```

### 浏览器采集
R17 既有浏览器 Capture 链继续作为 B6 最小 Browser→LCOS 入口，本轮未扩成 Browser Runtime/自动化。

## 模型调用纪律

打开“项目工具”不自动运行 Continuity/B4 model path。连续性检查改为显式用户动作；如果配置 Utility API，UI 明确提示可能产生模型调用。

## 当前验证

- B6 static gate: 16/16 PASS
- A4→B6 静态合同总计 149/149 PASS
- 477 TS/TSX syntax scan: 0 error

## 外部 Gate

与 B5 相同：需要真实开发环境补跑完整 lint/typecheck/Vitest/build/E2E。

## 真实机复验（2026-08-16）

补丁报告 §11 声明沙箱未完成完整工程 Gate。本轮在真实开发机复验：

| Gate | 结果 |
|---|---|
| workspace semantic typecheck（web / local-core / domain / contracts） | PASS |
| production build（web vite） | PASS |
| 定向 Vitest（projectRealtime / boundaryHintState / mutation-safety-b5 / continuity-runtime-b6 / project-root-indexer） | 10/10 PASS |
| local-core 全量 Vitest | 86 文件 / 423 用例 PASS |

复验中发现并修复了包里两处静态门未覆盖的真实缺陷：

1. `continuity-runtime-b6.test.ts` 断言 `resolvedProjectId`，但 `ProjectAffinityResultV0` / `ContinuityResolveResultV1` 契约为 `projectId`。测试改为断言 `resolved.projectId`；服务、Web 客户端与 `project-affinity-service.test.ts` 均以 `projectId` 为准。
2. `resume()` 未把绑定会话的 `selectedViewIds` 恢复进 Attention，导致 attach bundle 的 `contextPack.items` 为空。修复：`AttentionRuntimeRequestV0` 增加可选 `seedViewIds`，`resume()` 把 `session_context_refs.selectedViewIds` 作为 Attention seed 传入；只读快照不变更存储，其他调用方不受影响。

仍未复验（保留开放项）：lint、architecture tests、web 全量 Vitest、Playwright E2E。
