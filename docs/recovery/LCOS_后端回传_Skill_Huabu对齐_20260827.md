# LCOS 后端回传 · Skill × Huabu 对齐实况核查（20260827 深夜）

> 回应前端五问。**先给最重要的诚实结论：bf79821 之后没有新一轮「Skill × Huabu」施工**——你手里的 203.9MB 包就是当时的全部。你要的答案不在"新代码"里，在**已有代码的实况核查**里。本问五条全部按代码逐条核实（含一处对我自己昨日工作的纠错）。
>
> 最新 HEAD：`2b0383c`（比 bf79821 多一个小修，见 §六）。你基线 `b98ebee` → 最新共 **9 个提交**。

---

## 一、Q1 Skill 稳定身份：**包身份 ✅ 已齐 / 画布实体身份 ❌ 没做** —— Round +3/+4 维持原预估

逐字段核实（`tools/lcos-agent/commands/skill-layers.mjs`，任务四 P2 落地，huabu loader 同构）：

| 你问的字段 | 实况 | 载体 |
|---|---|---|
| skillId | ✅ 目录名即 ID | system: `packages/skills/<id>/`（canonical）；user: `<项目根>/.creative-os/skills/<id>/` |
| system / user identity | ✅ 三态 source | `lcos skill list` → `[{id, source: 'system'\|'user'\|'merged'}]`；同 id 双层 = merged（system 原文 + `## User extensions` + user 正文，system frontmatter 是 canonical 身份） |
| revision / version | ✅ frontmatter version | 如 lcos-project-context `1.2.0`；Curator 路由包另有 skill.index.yaml `version: 2.1.0` |
| resolvable address | ✅（CLI 侧） | `lcos skill read <id> [--ref <subpath>]`；目录沙箱（`..`/反斜杠/盘符逃逸 = SkillPathEscapeError）；坏 user skill warn+skip 不 brick |
| **画布可寻址实体** | ❌ **不存在** | Skill 不是 artifact/view，无 membership、无 viewId、不可拖不可绑。MCP 无 skill 工具面（CLI-first 纪律） |

**对你们 Round 的直接影响（诚实评估，不给你虚假乐观）**：
- **Round +3 Assembly：范围不变**。Skill 在装配台仍是「看得到、有稳定包身份可列出/预览，但没有 usage 合同就不可装配」。你们已有的降级处理（不假装 draggable）继续是对的。
- **Round +4 Skill-first Layout：可以小赚**。skillId+source+version 三元组已经稳定，前端做 Skill 面板/引用展示/版本标注**不需要等后端**——这些用包身份就够了。真正卡脖子的只有 usage-binding 本身。
- 0.2 usage-binding 的 resourceRef 一侧（Skill 变体）所需字段**已经凑齐**：`{kind:'skill', id, source, version}` 就是现成的引用形状——届时是纯增量契约，不用动存量。

**结论：没有"提前 usage-binding"的空间。半套合同=半成品，这条红线我们两边是同一条。**

## 二、Q2 ChangeSet / Keep / Revert：**真做了一半——"内容写回"半边是完整的，"spatial edits"半边各通道不一** —— 你要的字段逐条对照

### 已真实存在（全部可 HTTP 调用 + 测试背书 + 数据库实证）

端点：`GET /projects/{id}/change-sets`、`GET .../{csid}`、`POST .../revert`、`POST .../reapply`

你点名的字段 → `MutationChangeSetV1`（contracts/curation-patch.ts）实况：

| 你要的 | 实况 |
|---|---|
| changeSetId | ✅ `id` |
| targetRef | ✅ 按 item 类型内嵌（presentationId / artifactId / viewId / relationId） |
| operation[] | ✅ `changes[]` 六种 item：`presentation_state` / `relation_upsert` / `relation_update` / `relation_delete` / `artifact_text_update` / `artifact_text_create` |
| before/after | ✅ 版本指针（beforeRevisionId/afterRevisionId、beforeVersion/afterVersion）+ presentation 侧 stateSnapshot 全量逆快照 |
| expectedVersion | ✅ 写入侧契约（CurationPatchPresentationV0.expectedVersion / ActiveContext CAS / reorganize baseVersion） |
| unsafeToRevert | ✅ 语义等价物：`artifact_text_create` 是 **undo-only**（正文被后人改过即阻断 revert，409）；`artifact_text_update` revert 前校验 current 指针（陈旧 409）；reapply 陈旧 409（FORWARD_STATE_UNAVAILABLE） |
| conflict | ✅ agent 写通道 CAS 两态结构化 409：`not-read` / `stale` + expectedRevisionId/currentRevisionId + hint（huabu buildConflictHint 直译） |
| status | ✅ `applied \| reverted` + revertedAt/reappliedAt |
| actor 归因 | ✅ actorKind(agent/web/core) + actorId（库里实证：`agent/b2-run-N` × 22、`agentlet-canvas-organizer-*` × 2） |

### 你问的「Agent spatial edits → one ChangeSet → preview → Keep/Revert」——**逐通道拆开说，不打包票**：

| 通道 | ChangeSet 记账 | 预览 | 可逆 |
|---|---|---|---|
| agent 写文本（create/update，带 sessionId） | ✅ artifact_text_* | ❌ 无 live preview（写即记账，revert 兜底） | ✅ revert/reapply + 防覆盖 409 |
| relation 增删改 | ✅ relation_* | ❌ | ✅（带快照 restore） |
| presentation 变更（成员/层级/边/强调/钉） | ✅ presentation_state（MutationSafetyService，含逆快照） | ❌ 直接 PUT 无预览 | ✅ |
| **reorganize（移动/重排/分组/布局/删除提案）** | ✅ apply 后链 `changeSetId` | ✅ **服务端强制 PREVIEW**（counts + destructive 标志） | ✅ rollback 状态机 + proposal 状态（pending/previewed/applied/accepted/rejected/rolled_back） |
| Keep All / Revert All 批量端点 | ❌ 不存在（逐条 revert/reapply） | | |

**诚实结论**：你们 Skill-first Layout 想少造的临时状态，**reorganize 通道已经全给你了**（positionPatch/hierarchyPatch/relationPatch/emphasisPatch/layoutIntent{elk,fcose,manual,preservePinned} + PREVIEW + rollback + changeSetId——contracts/reorganize.ts 全字段在）；但「agent 直接 spatial edit 也全走 ChangeSet」**没有**——agent 的 spatial 变更必须经 reorganize proposal（这正是 G5 structural=preview 的门语义）。这不是缺陷是设计：spatial 变更一律先 PREVIEW。

## 三、Q3 Selection / Spatial Context 的 truth vs candidate：**已冻结的部分给你映射表**

| 层 | 实况 | truth 强度 |
|---|---|---|
| explicit selection | `<selected_nodes>` L1 阶梯进 prompt（`aabea46`；selectionArtifactIds 优先于 cachePlan.focusArtifactIds，attention wins） | **attention truth**（进 manifest 即冻结为任务输入） |
| pinned refs | manifest `stableItemIdentities`（Saved Context 钉定 revision，缓存稳定前缀） | **truth**（revision 级冻结） |
| current surface | ActiveContext（scopeId/viewport/version CAS） | **attention truth**（活版本，非冻结） |
| spatial neighborhood | manifest `siblingContextArtifacts`（**target 邻域** scope 兄弟，上限 12） | candidate（结构关系入选，非距离） |
| related refs | graph relations kind=reference → manifest reference items | candidate |
| retrieved refs | resourceRefs（matcher 按指令+policy 过滤；`layer==='suggested'` **被丢弃**不进 manifest） | candidate（过 policy 门的才升 truth） |

**你们的纪律 = 我们的纪律，且是结构保证不是文案**：距离从不进 manifest（邻域靠 scope 隶属结构，不是坐标半径）；suggested 层资源默认丢弃；冻结发生在 run 创建（ContextManifest 不可变，MCP instructions 明文禁止 mutate frozen manifest）。前端继续坚持 Explicit > inferred 没有任何阻碍——后端没有任何"AI 神秘看了一堆东西"的通道。

## 四、Q4 Skill → Spatial mutation 能力 census（READY/PARTIAL/MISSING + 真实通道）

| 操作 | 状态 | 通道（真实存在的那条） | 备注 |
|---|---|---|---|
| create（带坐标文本节点） | **READY** | Core `POST /curation/text`（x/y）；CLI `node create-text`；curation apply `createTexts` | B-2 六 Run 实证；label/坐标 policy 已挂 skill |
| edit（正文） | **READY** | Core `PUT /curation/text`（viewId+sessionId）；CLI `node update-text` | CAS not-read/stale 409 + ChangeSet |
| move（位置） | **READY** | reorganize proposal `positionPatch`（PREVIEW+rollback+changeSetId） | presentation 层 only，不动实体身份 |
| resize | **MISSING** | 无任何通道 | 节点尺寸不在任何 patch 契约里 |
| group / hierarchy | **READY** | presentation `setHierarchy`；reorganize `hierarchyPatch` | presentation_state ChangeSet 记账 |
| connect | **READY** | curation apply `relations`；MCP `create_lcos_relation` | relation_* ChangeSet |
| emphasis / pin | **READY** | presentation `setEmphasis` / `pin` / `unpin` | |
| remove（presentation 移除） | **READY** | reorganize `removeMemberViewIds`（两级删除的轻级） | PREVIEW 标 destructive |
| remove（artifact 删除） | **PARTIAL** | 仅 reorganize `artifactDeleteCandidates`（proposal + 强制 PREVIEW）；**无独立 delete 端点；MCP 无删除工具（agent 构造性 deny）** | 见 §五的自我纠错 |
| reorganize / 布局提案 | **READY** | proposals + preview + apply + rollback；`layoutIntent{elk,fcose,manual}` + preservePinned | |
| membership（Context 成员） | **READY** | MCP `apply_lcos_context_command`（expectedVersion CAS） | |

**没有一项是靠 Skill 文案撑着的**——上表每行都对应可调用的 HTTP/CLI/MCP 面。

## 五、自我纠错（对你、对我都重要）

昨日我给 CLI gate 写的 `curation apply` 检查里有个 `patch.deleteTexts` 分支——**CurationPatchV0 根本没有 deleteTexts 字段**（createTexts+relations+presentation 三件而已），该分支永不触发，属误导性死代码。已删除并提交 **`2b0383c`**（gate 测试 12/12 复验绿）。真实删除路径唯一：reorganize `artifactDeleteCandidates` + 服务端强制 PREVIEW。这正是你说的"不能靠文案把 MISSING 写成支持"——我自己差点犯了。

## 六、Q5 增量交付（拒绝继续当 U 盘 😑）

- **你的 bf79821 包仍然有效**，唯一新增是 `2b0383c`（1 文件 6 行小修）。
- 增量 patch 已生成：**`LCOS_bf79821_to_2b0383c.patch`（1.8KB，收口目录根下）**——`git apply` 即可，或者干脆手改（就是把 curation-command.mjs 那个死分支换成恒 reversible 判定 + 注释）。
- 你包里有完整 `.git`，`git diff b98ebee..HEAD` 随时可自取——以后默认走这条路，除非有大迁移再谈包。

## 七、九个提交总账（b98ebee → 2b0383c）

| Commit | 内容 | 新契约 | 迁移 |
|---|---|---|---|
| `aabea46` | `<selected_nodes>` L1 阶梯进 prompt | — | — |
| `8a78618` | task-recipes cookbook（executor skill） | — | — |
| `ef4e74f` | `/space/search` 检索原语（不记 lease） | SpaceSearchNodeV0/ResultV0 | — |
| `6170d84` | selected-nodes e2e | — | — |
| `1ee6af5` | Session 七态 + Execution Gate taxonomy | session-lifecycle.ts / execution-gate.ts | — |
| `98affb1` | Phase 5 Live Session Binding（HTTP 面+事件） | SessionLifecycleStateV1 | **041** |
| `36f1676` | Phase 6 三入口 gate + GUI 词汇对齐 | — | — |
| `bf79821` | **身份桥 + 出生谱系（你们的两个 P0）** | conversation-identity.ts；receiver +conversationSessionId | **042** |
| `2b0383c` | gate 死分支纠错 | — | — |

**测试账**：local-core 112 文件 / 578 全绿；contracts 18 全绿；三包 typecheck 零错。
**前端消费点速查**：`active-receiver-identity` / `artifacts/{id}/birth` / `change-sets{,/revert,/reapply}` / `session-lifecycle{,/recover}` / `<selected_nodes>`（runtime-input-pack） / `permissionGate.riskLabel`。
**明示后置**：usage-binding（0.2，skillRef 字段已凑齐）、Skill 画布实体身份（0.2）、resize（无计划——需要你们先定义交互）、Keep All/Revert All 批量端点（需求出现再做）、conversation 粒度 lifecycle（0.15 后第一刀）。

---

**一句话总结给 Round +3/+4 排期**：Skill 身份没有惊喜（包身份够面板用、usage 合同等 0.2）；ChangeSet 有真货但按通道分布——**reorganize 通道是你 Skill-first Layout 的完整地基（PREVIEW+rollback+ChangeSet 三全），文本写回通道是 CAS+可逆的，直接 presentation PUT 无预览**。你们的预估不用调乐观，但 Round +4 里"Skill 引用展示"那部分可以直接开工，不用等任何人。
