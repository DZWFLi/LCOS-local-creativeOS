# MVP Runtime Slice B Review

日期：2026-07-29
分支：`codex/mvp-fast-build`
基线：`5eddaea feat(runtime): add canonical execution schema v6`

## 1. Decision

Slice B 已完成 Bridge Identity / Recovery Contract，但没有接入 Local Core
Adapter，也没有启动 WorkBuddy。

冻结合同：

```text
bridge-task-v0
bridge-result-v0
```

Bridge 继续只是 Provider Task Gateway。LCOS Canonical Run、Context、Return、
Revision 和 Current 仍由 Local Core 持有。

## 2. 实际范围

已实现：

- TaskEnvelopeV0 / ResultEnvelopeV0；
- canonical JSON 与 SHA-256 request fingerprint；
- 路径规范化后再计算 fingerprint；
- Bridge 重新计算并验证 caller fingerprint；
- `lcos_run_id + idempotency_key + fingerprint + contract_version` 身份；
- 同一 Bridge 进程内跨 RuntimeStorage 实例的原子幂等创建；
- 并发兼容重放只产生一个 Task；
- 不兼容重放返回 `IDEMPOTENCY_CONFLICT`；
- `get_task_by_lcos_run_id` 只读恢复查询；
- Bridge 重启后恢复持久化映射；
- Health contract version / capabilities；
- Runtime Root 和存储路径对外脱敏；
- Runtime 存储损坏结构化失败，不再把损坏 Task 库当成空库；
- Windows 原子 JSON 发布使用唯一临时文件与有限共享冲突重试；
- Task / Result 脱敏 Fixture；
- 旧 Provider Task 生命周期保持兼容。

未实现：

- Local Core Adapter；
- RuntimeDispatch 状态同步；
- WorkBuddy Runner；
- Watcher / Companion / Route C；
- Result Ingestion；
- ArtifactReturn / Draft Revision 创建；
- Accept / Reject / Retry；
- HTTP API 或前端接线。

## 3. 变更流程

变更前：

```text
create_task
→ 读取 tasks.json
→ append 随机 Task
→ 写回

同一 LCOS Run 重放
→ 可能创建第二个 Task
```

变更后：

```text
TaskEnvelopeV0
→ 规范化路径
→ canonical JSON
→ Bridge 重新计算 fingerprint
→ 原子检查 lcos_run_id
   ├─ 首次：创建 Task，replayed=false
   ├─ 完全一致：返回原 Task，replayed=true
   └─ 不兼容：IDEMPOTENCY_CONFLICT

Bridge 重启
→ get_task_by_lcos_run_id
→ 找回同一 Task
```

## 4. Fingerprint Contract

Fingerprint 输入是移除 `requestFingerprint` 后的 TaskEnvelopeV0：

1. 规范化 Windows drive / UNC 或 POSIX 路径分隔符和 dot segments；
2. 对象 key 递归排序；
3. 数组顺序保留；
4. UTF-8；
5. 不输出无意义空白；
6. 不 ASCII escape；
7. 禁止 NaN / Infinity；
8. SHA-256 lowercase hex。

LCOS Task 的行为只来自不可变 RuntimeInputPack 和 Expected Outputs。旧
`instruction/context/input_files/acceptance_criteria/priority/capability`
不能成为 fingerprint 外的隐藏执行语义。

## 5. Idempotency and recovery

持久化 Task 至少保存：

```text
task_id
lcos_run_id
idempotency_key
request_fingerprint
contract_version
status
runtime_input_pack_path
created_at
updated_at
```

恢复查询返回：

```text
taskId
lcosRunId
status
requestFingerprint
contractVersion
createdAt
updatedAt
```

查询不写存储、不改变 `updated_at`、不创建 Task。

## 6. Capability declaration

Health 当前声明：

```text
idempotentCreate    true
lookupByLcosRunId   true
structuredResult   true
cancel              true
finalize            true
eventsAfterSeq      false
```

Health 不返回 Runtime Root 或单个 Runtime 文件绝对路径。

## 7. Structured errors

Slice B 使用稳定错误形状：

```text
CONTRACT_UNSUPPORTED
INVALID_TASK_ENVELOPE
INVALID_RESULT_ENVELOPE
INVALID_REQUEST_FINGERPRINT
IDEMPOTENCY_CONFLICT
TASK_NOT_FOUND
RUNTIME_ROOT_UNSET
RUNTIME_STORAGE_CORRUPT
```

MCP 响应中的 `httpStatus` 是合同元数据，不代表 FastMCP 传输层真的返回了对应
HTTP 状态。

## 8. 测试

Bridge 定向测试：

```text
python -m unittest discover -s tests -v
20/20 PASS
```

覆盖：

- 首次创建；
- 兼容重放；
- 不兼容重放；
- 32 路并发、跨 RuntimeStorage 实例只创建一个 Task；
- 单一 delivery message / metric；
- Bridge 重启恢复；
- 查询不修改存储；
- fingerprint key 顺序、Unicode 与路径规范化；
- forged fingerprint；
- unknown field；
- ResultEnvelope 仅允许 `created`；
- Runtime 存储损坏；
- Health capabilities 与路径脱敏；
- 脱敏共享 Fixture；
- 旧 Task 生命周期。

并发测试额外连续运行五轮：

```text
5 × 19 tests
PASS
```

实际 MCP 工具 smoke（使用原 Bridge 已审计 venv，仅导入当前代码）：

```text
create_task first/replay
get_task_by_lcos_run_id found/not-found
health_check
PASS
```

安全启动门：

```text
AI_BRIDGE_RUNTIME_ROOT unset
→ rejected

--host 0.0.0.0
→ rejected
```

LCOS Architecture：

```text
npm run test:architecture
27/27 PASS
```

格式检查：

```text
git diff --check
PASS
```

本 Slice 没有修改 TypeScript 产品代码或 Web UI，因此没有重复运行完整
`check:fast`；沿用 Dz 批准的纵向 Slice 集中测试节奏。

## 9. Browser / Runtime 可见变化

浏览器无可见变化。Local Core 尚未调用 Bridge。

Bridge 工具级变化：

- LCOS 身份参数可进入 `create_task`；
- `get_task_by_lcos_run_id` 可用；
- Health 可读取合同和能力；
- Runtime Root 未配置或存储损坏时明确失败。

## 10. 风险

- 并发原子性保证范围是一个 Bridge server process。禁止多个 Bridge 进程共享同一
  Runtime Root；当前不是跨进程数据库。
- RuntimeInputPack 在 Slice C 中必须按 Run 物化为不可变文件；Slice B 只冻结路径
  合同，没有创建该文件。
- ResultEnvelopeV0 已冻结和验证，但还没有进入 LCOS Result Ingestion。
- `eventsAfterSeq=false`，MVP 后续采用轮询 Provider 状态。
- WorkBuddy 是否能真实消费 TaskEnvelope 尚未验证，必须由 Slice B.5 提前确认。

## 11. 回滚

Revert Slice B Commit。它没有修改 LCOS SQLite Schema、Project Truth 或用户文件，
也没有导入 Runtime 历史或启动外部执行器。

## 12. 下一步

停止在 Slice B Review。

下一批准点：

```text
Slice B.5 Buddy one-shot Contract Gate
```

使用本轮脱敏 Fixture，验证 WorkBuddy：

```text
读取 RuntimeInputPack
→ 不修改输入
→ 只创建 Expected Output
→ 返回 ResultEnvelopeV0
```

Slice B.5 不等于 Watcher、后台 Harness 或 Route C 恢复。
