# LCOS Backend H0–H4 收口审计（2026-08-02）

## 基线

- Branch: `codex/backend-hardening-20260802`
- Buddy baseline: `ffe8045`
- 审计收口前 HEAD: `759a0cf`
- Schema: v9

## 已完成

### H0：边界与导入安全

- Local Core 保持 loopback，除 `/health` 外使用 Bearer Token；限制 Origin，并拒绝浏览器路径字段。
- 对 Workspace / Artifact / ArtifactView / Relation / Note 增加 Project identity guard。
- ZIP 校验 CRC、重复规范路径、本地头/中央目录一致性；目录包具备稳定 fingerprint 和 replay conflict。
- 浏览器目录导入改为 Upload Session + 原始字节流；staging 位于 Project `.creative-os/import-staging`，Session 元数据可供进程重启后恢复。
- 旧 Base64 JSON 目录入口返回 410；URL 默认只保存，不自动抓取。

### H1：Resource 理解生命周期

- Schema v8 增加持久化 `resource_analysis_jobs` 和 `resource_policies`。
- 分析任务支持 claim、lease、retry、complete、failed；进程关闭后不依赖内存队列保存任务真相。
- Descriptor semantic hash 排除 `analyzedAt` 和用户 Annotation；用户备注进入 Policy/Annotation 存储。
- 分析任务绑定明确的 source Revision；Revision 不存在时由 FK 拒绝。

### H2：Context 与资源选择

- 中英文/NFKC token matcher，分数相同时按 Resource/Artifact identity 稳定排序。
- `suggested / approved / executable` 三层分离；Suggested 不会静默进入 ContextManifest。
- ContextManifest 不再自动猜测 Target；Run revise 必须显式提供 Target。
- 单项 32K、总量 128K 字符预算；文件内容使用 untrusted-context delimiter。

### H3：Canonical Run

- Schema v9 保存 `requestedProvider`、`outputIntent`、`returnGroupId`；Provider 支持 WorkBuddy/Codex。
- `create / revise / analyze` 进入 Canonical Run 合同；只有 revise 要求显式 Target/Base Revision。
- HTTP 创建 Run 只持久化 `created + planned`，显式 dispatch，避免请求线程同步执行 Provider。
- Provider 状态仍只存在 RuntimeBinding，不进入 Canonical Run status。

### H4：Codex Pull Worker

- Light Bridge schema v3 增加 `leaseExpiresAt`、`lastHeartbeatAt`、`attemptCount`。
- `worker run-once` 原子 claim + start 一个 Codex Task；`worker heartbeat` 续租；`worker watch` 持续取件。
- 过期 claimed/running Task 可重新认领，attempt 递增；错误 worker 不能 start/heartbeat 他人租约。

## 验证结果

- `npm run check:fast`: PASS
  - Web: 121 tests
  - Local Core: 169 tests
  - Domain: 5 tests
  - Contracts: 4 tests
  - Architecture: 27 tests
  - TypeScript build/Vite production build: PASS
- `npm run test:integration`: 5/5 PASS
- Light Bridge `pytest`: 27/27 PASS（1 条第三方 Starlette/httpx deprecation warning）
- `npm run audit:manifest:verify`: PASS，527 files
- `git diff --check`: PASS

Lint 有既存 warnings，无 error；本 Slice 新增的 upload path control-character warning 属规则表达提示，不影响检查结果。

## 明确未冒充完成的能力

- Codex Pull Worker 负责可靠取件，不会自动操控 Codex GUI，也不替 Agent 生成或提交结果。
- `create/analyze` 已能建 Run 和派发合同，但其多文件/零文件 Return Group → LCOS Artifact Truth 的采用 UI/完整 ingestion 仍需后续 Slice；现有 revise Draft/Accept 生命周期保持可用。
- Runtime 的自动后台 reconciler 尚未作为 Local Core 常驻服务启动；当前使用显式 dispatch/recover/sync。
- Upload Session 使用 Project 内持久化 `session.json` 作为轻量 journal，尚未增加独立 SQLite import journal 表。
- Resource 分析已在导入时入队；所有其他 Current Revision 变更的统一 post-commit hook 仍需在后续 Domain Event Slice 收敛。

## 回滚点

- H4: `393e328`
- H3: `99d9faf`
- H2: `5d2c363`
- H1: `5f83a36`
- H0C: `b5dfaba`
- H0B: `9804806`

各 Slice 均为独立提交，可使用普通 `git revert <commit>` 审查式回滚；不得 reset 或覆盖用户工作。
