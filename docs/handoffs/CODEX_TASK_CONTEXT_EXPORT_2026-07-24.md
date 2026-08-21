# Codex Task Context Export — Local Creative OS Backend

> 日期：2026-07-24  
> 范围：本 Codex 任务从创建到本次导出的完整上下文，不是仅 Phase 2 子任务  
> 当前停点：暂停 Bridge 协作线，回到 Local Creative OS 后端主线；尚未开始下一轮实现

## 1. 任务最初授权与硬约束

任务最初是 Local Creative OS 的后端 / Local Core 接手工作。首轮被严格限制为：确认集成基线、比较 `v0.6.0` 前端候选包与主仓、核对 Fixture 与 Domain / Contracts、生成 Backend Takeover Bundle、提交 Phase 0 方案后停止。

明确约束：

- 当时 `apps/local-core` 不存在；
- 主仓工作区不干净；
- `v0.6.0` 候选包不等于已经合入 Git，也不能把主仓 `apps/web` 当作它的可靠副本；
- 首轮不得接 SQLite、Bridge、Watcher、真实用户文件写入，也不得修改业务代码、锁文件或提交 / Push；
- 后端负责范围是 `apps/local-core`、`packages/domain`、`packages/contracts`、后端测试与文档；Web 不直接读写本地文件，Local Core 只监听 `127.0.0.1`。

## 2. 已完成的基线与接手整理

本任务早期完成了仓库状态、候选包、合同与 Bridge 现状的核对，并生成 Backend Takeover Bundle。核心结论是：Git HEAD、主仓未跟踪实现、`v0.6.0` 候选包属于三套不同来源；根测试还可能收集候选展开目录，存在“虚假通过”风险。

推荐路径因此调整为：先由前端 owner 整合 `v0.6.0`、隔离测试范围并形成新基线提交；后端再从该基线创建独立干净 worktree / 分支。后续对话中用户表示新基线与 worktree 已建立，并允许同步更新接手文档。

已存在或本任务生成过的接手材料包括：

- `docs/backend-takeover/00_TAKEOVER_INDEX.md` 至 `08_RECOMMENDED_BACKEND_PHASE_0.md`
- 本任务后续产生的 Phase 1A、运行 / 验收与审计类 handoff（以仓库现存文件为准）

## 3. 绿区开发阶段

用户随后批准了绿区工作，并提供“自主性与审查规则”。可直接推进的范围包括固定开发端口、Vite proxy、`dev:web` / `dev:local-core` / `dev:stack` 脚本、只读 Runtime Client、Health / Catalog / Root Validation、在线 / 离线提示、诊断页、浏览器集成检查及只读测试报告查看。

之后用户确认：浏览器验证无需每个小切片执行；为节省 token，采用“相关切片批量实现 → 一次针对性检查 → 里程碑浏览器验证 → 阶段性完整质量链”的频率。也要求写一个简短 OS 后端流程 skill；该 skill 现为：

- `C:/Users/1/.codex/skills/local-creative-os-backend-flow/SKILL.md`

该 skill 固化了：后端分工、绿 / 黄 / 红区、一个核心文件一个 owner、批量验证与诚实 handoff。

开发期间曾发现默认 Web 端口 `5173` 被外部进程占用；没有擅自结束该进程。后来用户要求开启常驻测试窗口，相关运行状态不应被误记为产品功能已验收。

## 4. 黄区开发阶段

用户批准将黄区一并推进，但要求本轮先不重复审计 / 测试，直到黄区与后续红区边界处理完再做一轮集中验收。黄区主题包括：诊断放置方式、dev proxy/API 版本、Fixture 与 Runtime 并存、轻量 Contract 扩展、开发依赖和测试报告生成；每项需先有短方案（目标、文件、前后流程、合同变化、测试、风险、回滚）。

这一阶段的原则是：不把 Fixture、CopyOnly 或 Buddy Task 冒充真实 Runtime；不扩大到 Scope persistence、Watcher、Bridge、SSE、真实用户文件写入或 localStorage 正式迁移。

## 5. Phase 2 Lite 授权、完成与证据状态

用户晚间将范围升级为 **Phase 2 Lite**，明确允许 SQLite 仅保存 disposable 测试项目的元数据，并要求：

- schemaVersion 与最小 migration；
- 持久化 `Project`、`Workspace`、Canvas camera / zoom、`Artifact`、`ArtifactView`、`Relation`；
- Local Core 最小读写接口与浏览器 Runtime 数据读取；
- 完成“保存 → 关闭 Local Core → 重启 → 恢复”；
- 用 disposable PortaSplit 项目验证；
- SQLite 不存大 BLOB，删除 View 不删除 Artifact，Fixture 不得静默写入正式库；
- 不做 Scope / Note / Revision / Checkpoint / Preview / Watcher / Bridge / 文件导入 / 真实用户文件写入 / localStorage 正式迁移。

当前记录显示，Phase 2 Lite 已在后端 worktree 中完成并形成两个提交：

- `4cf0b82 feat: persist disposable phase 2 lite metadata`
- `5fc56be docs: clean phase 2 lite handoff`

其实现结论为：SQLite 仅保存 disposable 元数据，覆盖 Project / Workspace / Artifact / ArtifactView / Relation，并做过保存与重启恢复的本地验证。下一位执行者应以该 worktree 与提交实际 diff 为准重新确认，而不是仅依赖本段文字。

## 6. Buddy / Bridge 验收线及为何停止

为了独立验收 PortaSplit 的创建、节点摆放、camera / Relation 保存、关闭 Web 与 Local Core、重启并原样恢复，曾安排 Buddy 验收。

时间线：

1. 创建旧任务 `task_a0f954a1`。
2. watcher 在任务被 claim 后约 0.017 秒错误调用 `start_task`，使它显示 `running`，但没有真实 headless worker、heartbeat、执行记录、结果或产物。
3. 问题被确认是 Bridge watcher 状态机 bug，不是 Buddy 执行失败；watcher 规则被修正为只推进至 `assigned`，仅真实执行器能 `start_task`。
4. 旧任务被标为修复前遗留的伪 running / 僵尸单，不能作为验收证据。
5. 新任务 `task_1c2fd75e` 创建后正确停在 `assigned`，但用户随后要求停止该值守。

因此，Bridge 验收没有形成有效的独立 Buddy PASS 证据；它不否定已记录的 Lite 本地验证，但也不能补强为独立验收通过。用户已明确要求先不处理 Bridge，回到 OS 开发主线。

## 7. 当前已知仓库事实

- 主仓 `E:\Codex 项目\OS开发` 是脏工作区；历史检查提到 `index.html`、`package.json`、`package-lock.json` 有修改，另有 `apps/`、`packages/`、`tests/e2e/`、`docs/backend-takeover/` 等未跟踪内容及证据文件。
- `apps/local-core` 在最初接手审计时确实不存在；后续 Phase 2 Lite 在独立后端 worktree 中完成，是否已回流到主仓必须通过当前文件系统和 Git 重新核验。
- `packages/domain` 与 `packages/contracts` 在最初审计时已有最小纯 TypeScript 合同；其真实当前实现同样须以代码为准。
- 主仓、未跟踪实现与 `v0.6.0` 候选包不能混为一个可信基线。

## 8. 当前批准边界

用户一度提出“完整 Backend Phase 2”，允许：SQLite、migration ledger、WAL / transaction、Project / Workspace / Artifact / ArtifactView / Relation / Note / Revision / Checkpoint Repository、Local Core CRUD、浏览器 Runtime 数据、重启恢复与 disposable PortaSplit 验证。

但以下仍为红线，遇到即停并产出 ADR / handoff：

- Scope / Child Scope persistence；
- 真实用户文件写入；
- Watcher、Preview、文件解析、Bridge / Run / waiting_input / SSE；
- AI Return 自动 Current；
- localStorage 自动迁移；
- 非 loopback / 任意 CORS；
- 大改 Canvas、Work Rail、Inspector、Command 主流程。

在用户最近一次转向后，首要动作不是直接实施完整 Phase 2，而是先重读仓库与开发背景，确认基线与已落地状态。

## 9. 建议的重新开工顺序

1. 执行 Git 状态检查，确认当前主仓、后端 worktree 和提交的对应关系。
2. 阅读：`README.md`、`AGENTS.md`、`CODEX_START_HERE.md`、`docs/DEVELOPMENT_REQUIREMENTS.md`、最新 handoff、PRD / UI 冻结稿、GUI ADR、Storage / Cache Budget、Frontend Contract Handoff、Bridge Audit。
3. 检查 `packages/domain`、`packages/contracts`、`apps/local-core` 及 Web Runtime 接入点的当前代码。
4. 用当前真实 diff 判定：Phase 2 Lite 哪些已经存在、哪些仅在独立 worktree、哪些尚未回流。
5. 若继续完整 Phase 2，先写黄色项短方案，再按 2A Schema/Migration → 2B Repository → 2C API → 2D Browser Runtime → 2E Restart Recovery → 2F Regression 推进。

## 10. 后续执行者的最短交接结论

不要从 Bridge 开始，也不要把 Buddy 任务状态当作 OS 功能状态。先以 Git 与代码还原真实基线；确认 Phase 2 Lite 是否已在目标 worktree 可用；随后在用户已批准的完整 Phase 2 范围内继续，且始终保持 SQLite 仅存元数据、仅 disposable 测试项目、无 Scope / Watcher / Preview / Bridge / 真实用户文件写入。
