# Task Protocol V3

## LCOS Slice B identity extension

The legacy provider lifecycle below remains compatible. LCOS-created tasks add
the following persisted identity fields:

```text
contract_version = bridge-task-v0
lcos_run_id
idempotency_key = lcos_run_id
request_fingerprint
runtime_input_pack_path
```

`request_fingerprint` is SHA-256 over canonical UTF-8 `TaskEnvelopeV0` after
removing the fingerprint field. Object keys are sorted, array order is
preserved, insignificant whitespace and ASCII escaping are omitted, and
absolute path separators/dot segments are normalized before hashing.

Replay behavior:

```text
same lcos_run_id + same identity + same fingerprint
→ return the original task with replayed=true

same lcos_run_id + different identity or fingerprint
→ IDEMPOTENCY_CONFLICT
→ no new task
```

Creation uses one atomic `tasks.json` update inside the single Bridge server
process. Running multiple Bridge server processes against the same Runtime Root
is unsupported.

Recovery is read-only:

```text
get_task_by_lcos_run_id(lcos_run_id)
→ zero or one persisted Bridge Task
```

Provider state remains Provider state. It must not be copied directly into an
LCOS Canonical Run.

## 目标

定义 Bridge 对任务的主数据结构、生命周期和异常处理规则。

## 当前冻结项

1. 生命周期主链路：
   - `created -> queued -> assigned -> running -> review -> completed`
2. 异常状态：
   - `failed`
   - `timeout`
   - `retrying`
   - `cancelled`
3. 验收归属：
   - WorkBuddy 负责 `running -> review`
   - Codex 负责 `review -> completed`
4. 返工策略：
   - V3 使用 `retrying`
   - 不引入 `revision task`

## 建议最小字段

```json
{
  "task_id": "",
  "project_id": "",
  "session_id": "",
  "created_by": "codex",
  "executor": "workbuddy",
  "task_type": "",
  "status": "created",
  "priority": "normal",
  "report_mode": "short",
  "instruction": "",
  "context": {},
  "input_files": [],
  "expected_outputs": [],
  "result_summary": null,
  "artifact_ids": [],
  "retry_count": 0,
  "retry_reason": null,
  "cancel_reason": null,
  "superseded_by_task_id": null,
  "heartbeat": {
    "last_at": null,
    "source": null
  },
  "timeout_seconds": null,
  "dependencies": [],
  "created_at": "",
  "updated_at": "",
  "queued_at": null,
  "assigned_at": null,
  "started_at": null,
  "reviewed_at": null,
  "completed_at": null,
  "error": null
}
```

## report_mode

V3.1 新增：

- `full`
- `short`
- `silent`

规则：

1. `Task` 决定回传粒度
2. 不由 Agent 临场自由发挥
3. 代码类任务默认应优先使用 `short` 或 `silent`
4. 文档 / 研究 / 创意类任务默认应优先使用 `full`

## 状态职责

### Bridge

- 保存任务主数据
- 维护完整状态机
- 记录超时、重试、取消等异常态

### WorkBuddy

- 接收执行指令
- 执行任务
- 产出结果
- 将任务推进到 `review`

### Codex

- 设置任务边界和验收标准
- 读取 artifact 与 summary
- 决定进入 `completed` 或 `retrying`

## 待实现点

1. `create_task` 从 `pending` 升级为 `created -> queued`
2. `claim_task` 升级为 `assigned`
3. watcher 投递后明确写入 `running`
4. `submit_result` 默认进入 `review`
5. 增加 `finalize_task_review` 或等效能力用于 `review -> completed/retrying`
6. 增加 `cancel_task(task_id, reason)`：对 `created/queued` 任务必须立即标记 `cancelled`，并从消息队列与项目 inbox 移除，避免 watcher 恢复后误执行旧任务。
7. 增加 `supersede_task(old_task_id, new_task_id, reason)`：新任务取代旧任务时写入双向关联；旧任务若尚未执行，按取消处理。对于 `assigned/running` 任务只发出协作式取消标记，不伪造已停止。
8. watcher 和 WorkBuddy 收单前必须忽略 `cancelled` 或带 `superseded_by_task_id` 的任务；任务列表、Console 与 metrics 需保留其审计记录。
