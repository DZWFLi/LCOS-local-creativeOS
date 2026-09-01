# LCOS v0.15 · Lost Source Provenance Ledger
## Raw Source 丢失 / Reconstructed Authority 登记

日期：2026-08-31
状态：**ACTIVE / REPOSITORY-LEVEL PROVENANCE**

> 本文件记录“原始文件已经丢失”这一事实，以及允许继续施工时所依赖的可审计权威链。
>
> 它不是原文恢复稿，不得被引用成 verbatim original source。

---

# LS-001 · 2026-08-21 三大独立视图组件化详细施工总稿 v0.3

## Lost source

`LCOS_0.1_三大独立视图组件化详细施工总稿_v03_对话选择与承接全链补齐_20260821.md`

## Loss status / reason

```text
RAW_SOURCE_LOST
CACHE EVICTED / no recoverable full original currently available
```

2026-08-31 用户确认：历史会话可以被搜索到，但原文缓存已经无法取回。

## Nature of the source

8/21 时点的三 Surface / Component / Conversation Receiver / Handoff **construction consolidation master**。

不是 LCOS 三 Surface 产品定义的唯一创世来源。它汇总并施工化了此前/同期已经存在的多份专题定义，后续又被 8/29–8/31 的 explicit Freeze 与差分审计继续展开、修订和覆盖。

## Surviving upstream / peer authorities

至少包括：

- `LCOS_0.1_INTERFACE_PRODUCTIZATION_CODEX_CONSTRUCTION_PLAN_20260816.md`
- `LCOS_三大视图组件体系筛选表_v01_20260821.md`
- `LCOS_Malleable_Spatial_Surface_Glyph_AgentComposer_大范围参考研究_20260821.md`
- 8/21 同期 Conversation / Active Receiver / Handoff 专题施工材料（若对应域触及则按 Context Index 回源）

这些 surviving sources 独立保留了：

- Shared Spatial primitive / direct manipulation；
- Structure / Evolution / Relationship 的 Component 定义；
- Context / Workflow 作为自由工作现场而非数据库页 / DAG builder；
- Entity/Project Truth 与 Surface projection 分离。

## Downstream superseding / expanding authorities

- `LCOS_v0.15_UX冻结_同一套物理三个语义现场与Assembly_20260829.md`
- `LCOS_v0.15_R3D_SkillArtifact_SkillBuilder_CrossSurface_Freeze_20260830.md`
- `LCOS_v015_三Surface交互同构硬规则_20260831.md`
- `LCOS_v015_Context_Workflow_Component_CameraFocus_审判与收敛_20260831.md`
- `LCOS_v015_原文回源审判索引_当前GUI问题对照最初裁决_20260831.md`
- `LCOS_v015_原文到后续施工计划_差分审计_20260831.md`
- 当前 Mandatory Context / Final Frozen SOP

这些材料不是单纯 citation：它们重新展开、覆盖和冻结了 Main / Context / Workflow 的 shared physics / distinct semantics、Component admission、Workflow action scene、Assembly、Skill 等当前产品 truth。

## Delta-audit evidence

8/31 差分审计确认：8/27 之后真正损失的是一部分 8/21 的**细粒度施工动词 / Acceptance 密度**，不是整个三 Surface 产品定义。

因此 LS-001 的主要不可恢复债务是：

- 当时某些逐项 Done / Acceptance 的原始措辞；
- 某些组件行为的历史施工展开顺序；
- 原文逐字 provenance。

不等同于：

- 当前 Main / Context / Workflow 定义丢失；
- Shared Spatial Kernel 定义丢失；
- 当前 Component taxonomy 必须依赖 v0.3 才能判断。

## Current code / test evidence

当前 A00–A12 merged RC 与 v0.15 validators 已经把大量 owner / shared-interaction invariants 写进 production path / regression gates。

对于 A13：

- Main 已存在 `Orbit → Relation` canonical physical chain；
- Context / Workflow 已共享 `ProjectObjectOrbit`；
- Context / Workflow canonical persistence truth 与 Workflow Step→Step action truth 在源码中可区分；
- A12 Closeout 明确把 Cross-surface Relation gesture parity 留给下一微包。

## Latest user adjudication

2026-08-31 用户明确裁决：

> 对 v0.3 不再要求不存在的原文永久阻塞；应通过后续详细施工、Freeze、审计、源码和当前用户裁决交叉验证。

并授权：

```text
更新 SOP
→ 正式落 A13
```

## Recoverability

```text
verbatim original: LOW / LOST
current product truth: HIGH
historical construction acceptance: MEDIUM–HIGH via cross reconstruction
```

## Current-domain impact

```text
A13 Relation gesture: VERY LOW risk
Phase A remaining shared interaction: LOW risk
Phase B Object Species: LOW risk
Phase C Context / Workflow recovery: LOW–MEDIUM risk
```

Phase B/C 触及具体组件时，仍必须用 surviving authority chain + current code/test + latest L0 做对应域 Source-Diff；不能因为本 Ledger 判 PASS 就跳过阶段全文阅读。

## Blocking status

```text
RECONSTRUCTED_AUTHORITY = PASS
A13_BLOCKING = NO
GENERAL_PERMANENT_BLOCKER = NO
CONFLICT_ON_FUTURE_DOMAIN = USER_ARBITRATION_REQUIRED
```

## Confidence

`HIGH` for current product truth reconstruction.

---

# Ledger rule

新增 lost source 时必须增加新的 `LS-xxx` 项，不得覆盖旧记录。

如果未来找回真实原文：

1. 标记 `RAW_SOURCE_RECOVERED`；
2. FULL READ；
3. 与 reconstructed authority 做 diff；
4. 有冲突则按 Truth Priority 裁决；
5. 保留本 Ledger 的历史记录，不删除曾经发生过的 provenance gap。

---

# 2026-09-01 Recovery Update · W0-2

The historical loss event above remains preserved. Current recoverability has changed.

## LS-001 current source state

`LCOS_0.1_三大独立视图组件化详细施工总稿_v03_对话选择与承接全链补齐_20260821.md`

```text
HISTORICAL_2026-08-31 = RAW_SOURCE_LOST / CACHE EVICTED
CURRENT_2026-09-01 = RAW_SOURCE_RECOVERED_EXTERNAL
REPO_LOCAL_EXACT_BYTES = NO
LOCAL_VENDOR_PENDING = YES
RECONSTRUCTED_AUTHORITY = PASS / remains active until exact repo-local vendoring + FULL READ
```

Evidence on 2026-09-01:

- the full file object is again discoverable in the user's File Library under the exact original filename;
- the file can be opened through the File Library retrieval path;
- the current construction runtime cannot export that File Library object as exact bytes into this extracted RC;
- therefore **no excerpt/snippet was fabricated into `convergence/original/`**.

This changes the provenance classification from “permanently lost” to “externally recovered, local vendoring pending”.

## Exact repo-local raw sources recovered from existing context-library bytes

The following sources were already present byte-for-byte inside `docs/v015/context-library/`, although some filenames were mojibake/duplicated. W0-2 copied the exact bytes into canonical `docs/v015/convergence/original/` paths and verified SHA-256 against `context-library/MANIFEST.md`:

```text
E31CC1D56A3DFBF76A42FF9E589C8156A18D2D1B3D11CAEB60000418EA71653C
→ LCOS v0.15 GUI 感知层重构与前端施工规划.md

64A2320FA7E8B19DDD770515D773254418E6FEB61850AABEA950B1FA1D6FF8FC
→ LCOS v0.15 UX 架构第二轮收口与施工清单.md

2D7C9E50F30E341E285FFFC9F79FAFB790D41512AAB6DB32BD2EE7B70DD119E6
→ LCOS_v0.15_UX冻结_同一套物理三个语义现场与Assembly_20260829.md

C94F852BAAACD40205FBB48440EAE496469F867A645C51F0A4089CE2A3F98A69
→ LCOS_v0.15_R3D_SkillArtifact_SkillBuilder_CrossSurface_Freeze_20260830.md
```

## Additional 8/21 external recovery evidence

The following original file objects are also discoverable in File Library and must no longer be described as certainly lost:

```text
LCOS_三工作现场_通用Glyph_项目承接_Git协作_基于最新仓库实施规划_20260821.md
LCOS_Malleable_Spatial_Surface_Glyph_AgentComposer_大范围参考研究_20260821.md
```

Their exact repo-local bytes remain pending.

`LCOS_三大视图组件体系筛选表_v01_20260821.md` is still **NOT RECOVERED AS AN EXACT LOCAL FILE** in W0-2; do not fabricate it.

## Updated rule

```text
raw source exact local bytes available
→ FULL READ local original

raw source externally recovered but exact local bytes unavailable
→ RAW_SOURCE_RECOVERED_EXTERNAL
→ record provenance
→ keep reconstructed-authority safety net
→ vendor exact file when available
→ FULL READ + diff immediately after vendoring

raw source actually lost
→ RAW_SOURCE_LOST
→ reconstructed-authority gate
```
