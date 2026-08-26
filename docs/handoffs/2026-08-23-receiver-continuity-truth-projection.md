# Receiver Continuity Truth Projection

## 审计结论

旧 Stage 4 交接称仓库没有 Receiver Runtime capability，这个结论不完整。当前已有：

- `continuityResume`；
- `providerSessions`；
- continuity attach / return；
- Core Handoff 与 Context Manifest。

当前确实没有：

- `setActiveReceiver`；
- `sendToReceiver`；
- GUI 侧任意 Provider 会话切换能力。

## 修正

- Agent 协作上下文显示真实 Provider Session。
- Active 优先，其次显示最近 stale / closed session。
- 一次性交接复用现有 Context Manifest / Handoff Dialog。
- 无 Provider Session 时明确显示“未连接 Receiver”，不提供假切换器。
- 切换 Receiver 不通过前端状态或 fixture 冒充。

## 修改文件

- `apps/web/src/App.tsx`
- `apps/web/src/features/shell/AgentContextSurface.tsx`
- `apps/web/src/reconstruction.css`

## 验证

- Web typecheck：PASS。
- 相关 Foundation test：15/15 PASS。
- `git diff --check`：无空白错误，仅 Windows LF/CRLF 提示。

## 阻断能力

真正的 Active Receiver 切换与 one-off send 仍需批准正式 Runtime 合约；本批不新增平行 Bridge RPC。

## 回滚

单独 revert 本批提交；无 Schema 或 Core truth 变更。
