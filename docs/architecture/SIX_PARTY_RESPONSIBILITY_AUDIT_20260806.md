# 六方分工重叠审计（2026-08-06）

## 结论

按 Dz 给出的六方分工图逐项核对真实代码后，消除了一批重复职能，并确认其余
边界成立。全部改动行为不变（除一个空目录渲染崩溃修复）。

## 各方当前职责（以代码为准）

| 方 | 实体 | 职责 | 禁止 |
|---|---|---|---|
| Core | apps/local-core（43121） | 项目/画布/上下文/提案/Run Review/对话/资源/连接器，SQLite + SSE | 不直接派活给 provider |
| Bridge | tools/light-bridge-kernel（43122，Python） | 任务租约/认领/定向/心跳/结果信封（15 条 REST） | 不碰画布与 SQLite 业务表 |
| MCP Agent | mcp-server.mjs（45 工具） | 会话内项目/上下文/提案/Run 管理/对话检索/资源 | 不直连 Bridge（全部走 Core） |
| MCP Executor | executor-tools.mjs（8 工具） | claim/start/heartbeat/fail/get-task/get-context/input/submit | 不暴露画布写工具 |
| CLI | tools/lcos-agent/cli.mjs | 人/脚本批处理：项目/画布/对话/资源/Run 管理/检查 | 不再承担 worker 生命周期 |
| Web | apps/web（5173） | 人机界面，SSE 订阅，Review 交互 | 不直接写 SQLite/文件 |
| Skill | packages/skills（5 个） | Agent 行为协议 | 不重复实现业务逻辑 |

## 本轮消除的重叠

1. **CLI worker 模式 = Executor MCP 的 1:1 复制**：
   `lcos run claim/start/heartbeat/fail/ask` 与 `lcos task claim/submit` 走的
   全是 Core `/executor/*` 同一组端点，代码内无调用方。已删除，保留
   `run input/answer/context`（管理/检查）与 `task show`（检查）。
   规则：Codex worker 走 lcos-executor MCP；Buddy/手动 worker 走
   `lcos-bridge task claim-next / submit-result`。
2. **Skill 三份游离在 ~/.codex**：backend-flow / frontend-loop /
   workbuddy-orchestrator 已入仓 `packages/skills/`，安装脚本扩展到 5 个托管
   skill；内容与本地一致时自动“收养”为托管，不一致才拒绝覆盖。
3. **server.ts 服务装配未收敛**：抽为 `compose.ts`（`composeLocalCoreServices`），
   server 只负责生命周期与分发。
4. **qa-fixtures 仍在 src 树**：物理移入 `apps/web/tests/qa-fixtures/`，
   生产 src 零引用（边界测试强制）。
5. **launcher detached 启动崩溃**：Windows 下 detached 父进程 spawn `npm.cmd`
   必抛 EINVAL，`spawnLogged` 现在经 `shell:true` 启动，并保留 ignore 兜底；
   dev:stop 恢复对整栈的管理权。
6. **空目录启动崩溃（真回归）**：Phase 2 移除 fixture 项目种子后，
   `activeProject` 可能为 undefined，浏览器渲染读 `.label` 崩溃；已加合成兜底。

## 核对后确认成立的边界（无需改）

- MCP 双面都走 Core 的 `/executor/*` 网关，不直连 Bridge 业务。
- Bridge 只拥有任务租约/结果信封；看门狗（orchestrator）只负责派活与会话绑定；
  双同步（RuntimeAutoSyncService 收结果 + 看门狗派活）互补，不叠第三套。
- Web 只经 Core 代理（vite proxy 注入 token），不直接写 SQLite/文件。
- Core 只绑 127.0.0.1；能力注册表 ownership 条款与代码一致。

## 待决策候选（未动，避免误砍）

- MCP Agent 45 工具中部分与 CLI 同名（如 list/create run、conversation 检索），
  但按“CLI-first 白名单”口径它们是会话内工具面，不是批处理替代；若要继续瘦身，
  建议以“该操作是否只在会话内发生”为唯一判据再砍一批，需 Dz 确认。
- `compose.ts` 已收敛装配；`LocalCoreServerOptions` 仍定义在 server.ts，
  后续可移到 compose 侧，纯整理。

## 全量回归

```text
check:fast（lint/typecheck/web 134/core 252/domain/contracts/架构 70/build）✅
smoke:gatef-core ✅
test:lcos-mcp-e2e（agent 45 / executor 8，claim→running→review 全链）✅
Bridge pytest（33 项）✅
smoke:schema-v18 ✅
lcos:install-skill（5 个 skill 全部托管）✅
真实栈：Core 43121 / Bridge 43122 / Web 5173（代理返回真实项目 JSON）✅
```
