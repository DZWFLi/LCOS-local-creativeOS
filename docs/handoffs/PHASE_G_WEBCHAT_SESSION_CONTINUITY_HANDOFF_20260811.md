# Phase G Handoff｜Web Chat Deep Capture + Cross-session Continuity

> 日期：2026-08-11
> 施工包：LCOS A-H FINAL V2.2（00_MASTER_AH_FINAL_V2.md）
> 完成标准：05_PRODUCTION_COMPLETION_DOCTRINE

---

## Completed

Phase G 目标：补回"不同 Agent / Session / Web Chat 的上下文连续性"。本轮完成：

1. **Session Context Ref 持久化**（G13）：schema v29 `session_context_refs` 表（sessionId PK / projectId / selectedViewIds / retrievalEntityRefs / sourceRefs / status idle|working|blocked|closed / closedAt）。只存 refs，不复制完整 Project Context（G15）。
2. **API**：`POST /runtime/sessions/:id/bind`（项目绑定 + 状态 + refs）、`GET /runtime/sessions/:id/context`、`POST /runtime/sessions/:id/close`、`GET /runtime/sessions/contexts?projectId=`。
3. **CLI**（G21）：`lcos session bind <id> --project <id> [--views a,b] [--refs a,b] [--status]`、`lcos session context <id>`、`lcos session close <id>`、`lcos session sources <id>`。
4. **Web Chat Provider Adapter 骨架**（G8-G10）：`apps/browser-extension/src/providers/chatgpt.js`（matches + 可见引用收集）；右键菜单"收集当前 Web Chat 对话引用到 LCOS"**只在用户主动触发时运行**；provider 解析失败自动回退普通页面捕获（G9），绝不拖垮扩展。
5. **Capture kind `conversation_snapshot`**：已有契约（Phase C），本轮接入 adapter 输出。

## 现状核查

- Session Affinity（G6）：Phase B 的 sessionId ↔ projectId 规则已生效（session bind 后 capture 自动归属）。
- ConversationImportService（G11）：raw evidence 保留，不铺画布——已有。
- Bridge Run truth（G16/G17）：session status 独立于 Run state——未混用。

## Files changed

- `apps/local-core/src/metadata-repository.ts`（v29 + session refs CRUD）
- `apps/local-core/src/server.ts`（4 个 sessions 路由）
- `tools/lcos-agent/cli.mjs`（session bind/context/close/sources）
- `apps/browser-extension/src/providers/chatgpt.js`（新增）
- `apps/browser-extension/src/service-worker.js` / `manifest.json`（conversation 菜单 + scripting 权限）
- `scripts/phase-g-smoke.mjs`（新增，6 项全过）

## Tests

- Core：67 文件 / 330 用例全过（schema 快照 29）
- `node scripts/phase-g-smoke.mjs`：bind + sourceRefs + context + 双 Session + close + list + 404 —— 全过

## Explicitly NOT implemented

- ❌ Local Agent Browser file chooser 拦截（G3-G4）：需要内嵌浏览器控制面（Phase J / 后续），当前以"用户主动 provider adapter + 扩展"覆盖 Web Chat 场景
- ❌ Claude/Gemini provider adapter（G8）：接口与模式已定，chatgpt 为第一个样例
- ❌ Cross-session Bridge dispatch（G18）：Context Continuity 基础已就绪，派单等 Golden Case 通过后接
- ❌ GUI Run Rail 的 session 状态显示（G19）：留 Phase H

## Next risks

1. ChatGPT DOM 结构会变：adapter 收集逻辑是启发式，失败有回退；后续按需修。
2. session refs 无 TTL：closed 会话保留，Phase I 加清理策略。
3. sourceRefs 目前是调用方上报（CLI/扩展/未来内嵌浏览器）；本地 agent 浏览器内嵌拦截是真正的自动来源（后续）。

## Commit

提交将在本 Handoff 完成后执行（见 git log）。

