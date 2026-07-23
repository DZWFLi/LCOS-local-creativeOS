# PortaSplit Golden Path and Failure Path

## 1. 证据等级

| 等级 | 含义 |
|---|---|
| PASS | 同一正常链、真实交互和真实状态证据 |
| PARTIAL PASS | 独立模块或 Fixture 证明局部状态 |
| FAIL | 正常链出现明确缺陷 |
| UNREACHABLE | 上游阻断导致未执行 |

当前 PortaSplit 仅是前端 Fixture；不证明 Local Core、Bridge、文件或持久化。

## 2. Golden Path

```mermaid
flowchart LR
    A["打开 Project"]
    --> B["恢复 Workspace / Scope / Camera"]
    --> C["查看 Artifact / Relation"]
    --> D["Preview / Note"]
    --> E["选择 Target + Context"]
    --> F["Command + Confirm"]
    --> G["ContextSnapshot + Run"]
    --> H["queued / running"]
    --> I["waiting_input"]
    --> J["review + Changed Files"]
    --> K["Artifact Return Pending"]
    --> L["Accept / Continue / Retry"]
    --> M["Checkpoint"]
    --> N["重启恢复"]
```

## 3. 当前证据

| 步骤 | Candidate 证据 | 判定 | 后端缺口 |
|---|---|---|---|
| Project Drive / Tabs | 搜索、打开、多项目 ID 隔离 | PASS（Fixture） | Catalog / Session 未实现 |
| Workspace 创建与刷新 | 新 Workspace 刷新后存在 | PARTIAL | localStorage，不是正式恢复 |
| Scope | Child 4 节点/3 边可显示并返回 | FAIL | 返回父层无 Container；合同未冻结 |
| Artifact / Relation | Canvas Fixture | PARTIAL | 无 Artifact Index / Relation Repository |
| Preview / Note | 占位 Preview | PARTIAL | 无文件、页级 Note 未接 |
| Target / Context | 单选/多选推断可见 | PARTIAL | 无不可变 ContextSnapshot |
| Command Confirm | 确认前不创建 Process | PASS（前端） | 无 Command Repository |
| Run | 正常到 Running | PARTIAL | 内存定时器，不是 Runtime |
| waiting_input | 35% 选项可继续 | PASS（Fixture） | Bridge 无此状态 |
| review / Compare | 正常进入且 Rail 单实例 | PASS（Fixture） | 无 ChangedFile hash / event |
| Continue Modify | Composer 聚焦并填前缀 | PASS（前端） | 无 continueRun |
| Accept | 独立 accepted Fixture 可显示 | PARTIAL | 正常链未验收；无 Revision 接受 |
| Checkpoint | Banner / 按钮 | PARTIAL | 无 snapshot/persistence |
| 重启恢复 | Workspace localStorage | PARTIAL | 无 SQLite/Run recovery |

## 4. Failure Path

| 场景 | 当前可见证据 | Phase 目标 |
|---|---|---|
| 文件缺失 / 路径移动 | UI 可显示 unavailable 占位 | Local Core 结构化 `NOT_FOUND/MISSING` |
| Preview 失败 | UI error / unavailable | Preview Adapter 诚实降级，释放资源 |
| Bridge 断线 | disconnected Fixture | Runtime `UNAVAILABLE` + replay recovery |
| Codex 不可用 | 未真实执行 | `EXECUTOR_UNAVAILABLE` |
| waiting_input 超时/取消 | 未真实验证 | persisted pause、cancel、恢复 |
| 文件冲突 | conflict Fixture | hash mismatch → waiting_input |
| 路径逃逸 | 未实现 | project-root containment 拒绝 |
| 无权限 / 文件占用 | 未实现 | 稳定 error code + 不写入 |
| 自动归位失败 | Pending UI 语义 | Pending Return Zone，人工选择 |
| SQLite migration 失败 | 不存在 | 备份/回滚/恢复说明 |
| 本地路径变化 | 不存在 | Project unavailable / rebind，不静默迁移 |
| 磁盘不足 | 不存在 | <10GB 警告，<5GB 停大型 Preview |
| 外部修改 | conflict Fixture | External Change，不归因最近 Run |
| 重启非终态 Run | 不存在 | reconcile / recovery-required |

## 5. PortaSplit Reset 样例要求

真正后端 Golden Path 前需建立 disposable、可 Reset 的样例项目：

- 明确 root；
- 固定 MD、图片、PPT/PDF 小样；
- expected hashes；
- 不含真实用户文件和凭证；
- reset 不使用未知目录递归删除；
- Fixture、Runtime、外部修改证据分开；
- 每轮可验证 Project、Workspace、Artifact、Run、Return、Checkpoint 和重启。

本 Phase 未创建样例目录或 Reset 脚本。
