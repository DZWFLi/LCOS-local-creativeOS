# Frontend / Backend Contracts

## 1. 总体判断

`packages/domain` 与 `packages/contracts` 是真实的纯 TypeScript 最小实现，且与 v0.6.0 候选包内容相同；它们不是持久化、REST、SQLite、文件系统、Preview 或 Bridge 的实现。

候选 Web 同时使用：

- 自有 `apps/web/src/model.ts`；
- `fixtures.ts`；
- `PersistedPrototypeState version: 9`；
- `fixtureAdapter.ts` 对 Domain / Contracts 的局部适配。

因此当前是“双模型 + Fixture Adapter”，不是正式前后端合同已接通。

## 2. 逐项矩阵

| 对象 | 真实实现 | Fixture / Mock / localStorage | 前端已使用字段 | 冲突 / 占位 | 接管 |
|---|---|---|---|---|---|
| Project | Domain：`id,name,rootPath,createdAt,updatedAt` | Candidate `ProjectPackage` 与 Catalog localStorage | `id,label,localPath,updatedAt,pendingCount,rootScopeId` | `name/label`、`rootPath/localPath`；时间与 pending 为 UI 模型 | Local Core：Catalog、root 校验；Web 保留展示 |
| Workspace | Domain 完整最小语义视口 | Candidate v9 localStorage | `scopeId,camera,visibleLayers,focusedNodeIds,contextPolicy` | `viewport/camera`、`name/label`；Candidate 新增 Scope 语义未进 Domain | Local Core：正式持久化；Web：高频内存态 |
| Artifact | Domain 真实类型，无 Repository | CanvasNode Fixture | `artifactId,title,fileType,pageCount,current,draft` | CanvasNode 把内容身份与 View/视觉状态混合 | Local Core：身份、路径、availability；Web：节点显示 |
| ArtifactView | Domain：workspace、revision、referenceKind、position/size/display | CanvasNode + v9 localStorage | `viewOf,workspaceIds,scopeId,positionLocked,displayMode` | Domain 没有 `scopeId`；Candidate 没有独立 View 实体 | Local Core 接管正式 View；Scope 需先决策 |
| ArtifactRevision | Domain：parent、path、hash、source、run、status | `revisionId/revisionOf/followsCurrentRevision` Fixture | Draft/Current/父版本视觉 | `localPath` 重复；Candidate 字段为字符串占位 | Local Core：Revision / Current；Bridge 只回传证据 |
| Relation | Domain 未定义 | `CanvasEdge` Fixture + v9 localStorage | `id,from,to,kind,active` | 核心实体缺失；命名只有 reference/generate/modify/feedback | Local Core 接管 Graph；Domain Phase 0 补最小类型 |
| Note | Domain 真实类型 | Candidate 只有 `note` 节点语义和 UI 占位 | 文件 / 页级 UI 文案 | Domain 有 artifact_view，冻结稿还预留 region；Candidate 未接正式 Note | Local Core 接管；region Alpha 后置 |
| Command | Domain 真实类型 | Candidate Composer / ActiveRun 内存 | instruction、target/context 推断、commandId | `outputMode` 候选 UI 未形成正式对象；delivery 不在 Domain Alpha | Local Core 保存 Command；Web 负责草稿与确认 |
| Conversation | Domain 只有 id/project/createdAt | 前端几乎未形成一等对象 | Run UI 连续性 | 缺 summary / updatedAt / external mapping | Local Core 保存容器；Bridge 不拥有项目真相 |
| ContextSnapshot | Domain 真实不可变引用模型 | Candidate `contextSnapshotId` 与 contextIds 为 Fixture | targetIds/contextIds、推断说明 | Candidate 没有内容哈希清单和快照实体 | Local Core 构建/持久化；Bridge 只引用 |
| Run | Domain 真实类型与 7 状态 | Candidate `ActiveRun` 内存定时器 | id,status,command,targetIds,contextIds,changedFiles | Candidate 缺 `cancelled`；`changedFiles` 只是文件名字符串；ID 硬编码/生成 | Bridge 接管生命周期；Local Core 映射 |
| RunEvent | Domain 真实类型 | 前端未真实消费；无 SSE | 状态切换 UI | payload 过宽；无 transport/replay 实现 | Bridge 接管事件；Local Core Adapter 转发 |
| ChangedFile | Domain 真实类型 | Candidate `string[]` Fixture | 文件名列表 | 缺 action、相对路径、before/after hash | Bridge 回传；Local Core 校验 containment/hash |
| ArtifactReturn | Domain 真实最小类型 | Generated CanvasNode Fixture | pending artifact、Accept/Continue | 候选不是一等 Return；无 MIME/availability/summary | Bridge 回传；Local Core 映射 Revision/Artifact |
| Checkpoint | Domain 真实类型 | Candidate 只有 boolean Banner/按钮 Fixture | Accept 后建议创建 | 没有真实 snapshot、change set 或 persistence | Local Core 接管；Web 只触发 |

## 3. 状态标签

### 真实实现

- Domain branded IDs、Project、Workspace、Artifact/View/Revision、Note、Command、Conversation、ContextSnapshot、Run/Event、ChangedFile、ArtifactReturn、Checkpoint；
- `resolveArtifactReturnPlacement()`；
- terminal Run status 规则；
- Contracts 的 Result/Error、Workspace、Preview、Project、Artifact、Context、ExecutionRuntime 边界；
- Domain / Contracts 包级测试。

### Fixture

- Project/Workspace/Scope/Canvas Graph；
- Preview 内容；
- Run 自动推进、waiting_input、review、failed/conflict；
- Changed Files；
- Artifact Return、Accept、Checkpoint；
- Project Catalog 示例。

### Mock

无独立 Mock server；前端用内存 Fixture 和 URL `?state=` 状态夹具。应标为 Fixture，不得称 Runtime。

### localStorage

候选 v9 保存 Project Graph、节点、边、Workspace、Scope、active IDs、Work Rail；Catalog 使用另一个 key。这违反正式架构，只能作为可丢弃 Prototype 状态。

### 未实现

Repository、REST/SSE、SQLite、migration、文件导入/哈希、Watcher、Preview、Context 构建、Revision 接受、Checkpoint、Bridge Adapter、恢复。

## 4. 最小合同修正建议（Phase 0）

不扩张为完整平台，只补阻断 Local Core 骨架的合同：

1. 增加 `Relation` / `RelationId`；
2. 决定 Candidate `CanvasScope` 是否进入 Alpha 正式 Domain；当前前端合同称其完整，但冻结 PRD 的 Sub-canvas 默认后置，且回归未通过；
3. Project 命名统一为 `name/rootPath`，UI Adapter 负责 `label/localPath`；
4. Workspace 正式字段统一为 `viewport`；UI Adapter 可继续叫 camera；
5. 明确 `Artifact.localPath` 在 Source 链接与 Revision 路径之间的唯一语义；
6. `ChangedFile` 保持 project-relative path + hash，不接受只含文件名字符串；
7. canonical `RunId` 与 legacy Bridge `task_id` 明确分离；
8. `ContractError` 后续补 `RECOVERY_REQUIRED`、`PROJECT_ROOT_INVALID` 等稳定错误，但不在未批准时扩写。
