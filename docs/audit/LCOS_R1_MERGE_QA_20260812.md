# LCOS R1 Vision-Assisted Patch｜Merge + QA 报告（Codex 全仓）

> 日期：2026-08-12
> 分支：`codex/r1-vision-merge-20260812`（基于 `research/huabu-gap-audit-20260811`）
> 提交：`99dede8`（R1 patch 原样合并）+ `c4c281d`（merge 修正）
> 来源：`LCOS_VISION_ASSISTED_FRONTEND_R1_20260812.patch`（20 文件）+ 视觉辅助 Handoff

## Status

**FUNCTIONAL QA PASS / VISUAL HUMAN ACCEPTANCE PENDING**

P0 全部闭环（代码 + targeted test + 真实浏览器证据）；视觉层级部分由视觉模型审阅过截图，但最终人眼判断留给用户明天的 Human Golden Test。真实 Agent 协作循环（Selection → 自然语言 → Ghost → Apply → 续句 → Revert）未在本环境验（需要真实本地 Agent），如实标注。

## 1. P0 核查（每项 code + test + browser evidence）

### 1.1 Presentation identity（切 Scope 不串台）

- code：`presentationViewState.ts` 的 SessionCore 由 `useMemo([projectId, scopeId, capability, renderer])` 重建，不再 useRef 一次性。
- test：`presentationViewState.test.ts`（R1 新增）+ 全量 web 通过。
- browser：Golden 项目 root 拖动 img-01（1764,48 → 2202.07,530.68）→ 进入子 scope ctx-a（双击容器）→ 拖动 conv-client → 返回 root → 位置保持 2202.07,530.68 → reload 后仍一致。数值证据见 QA 输出（r1-05 截图）。

### 1.2 Presentation fail-closed（Core 不可用不得假装保存）

- code：`load()` 失败 → `ready=false` + 恢复到 `#committedView` + `emitPresentationPersistenceNotice`；`patch()` 在 !ready 时拒绝；`flush()` drain 循环 + CAS stale 一次性 rebase；App 监听 `lcos:presentation-persistence` 显示提示。
- browser：停 Core → 拖动 img-02（乐观显示 1850,108）→ 重启 Core → reload → 位置回到 1764,48。**未写 fake truth。**

### 1.3 空 committed state 能清空旧 optimistic

- code：`presentationViewState.ts` / `presentationDraftState.ts` 恢复逻辑以 committed 为准，空 `[]/{}` 视为有效 truth（R1 修改）。
- test：`presentationViewState.test.ts` 覆盖。

### 1.4 Reorganize 无物理删除（前后端）

- frontend：`ReorganizePanel` 无 confirmDelete checkbox；`applyReorganize(..., false)`；删除候选只显示「建议单独清理 / 整理不会物理删除内容」。
- backend：`reorganize-service.ts` apply 不执行 Artifact hard delete；`reorganize-service.test.ts` 有 `broad apply never hard-deletes artifacts` 用例（apply 后 `metadata.getArtifact` 仍存在）。
- browser：打开 Reorganize 面板断言无「确认删除/不可恢复」，有非破坏文案与 Apply 路径。

### 1.5 Late-binding 清理

- `workContext.ts`：`canBeTarget` 只用 mechanical facts（editable / managed + revision + !historical），无 working/generated/decision 推断；`isContextCandidate` 只排除 disabled。
- `CapabilityPopover.tsx`：无 `/reference|参考|feedback|script/` 标题正则（rg 无命中）。
- 视觉兼容：NodeKind 仅保留 bounded visual family（shrink-only）。

### 1.6 Relation 三层 scope 显式

- `runtimeBridge.ts` / `App.tsx` / `ContextFlowSurface.tsx` / `WorkflowSurface.tsx` 显式赋 `domain / presentation / runtime`。
- test：`relationScopeContract.test.ts`（R1 新增）。
- browser：canvas 22 条 domain 边带 `edge-scope-domain` class。

### 1.7 Preview materiality（真实内容优先，不造假）

- R1 修复 `fileType` 掩盖 `previewMimeType`（`visualFamilyFor` 增加 mime 输入、`DocumentObject` thumbnail 判断优先 previewMimeType）。
- **merge 中发现的真 bug**：同一 revision 存在旧 `card→unsupported` 与新的 `thumbnail→ready` 两条记录时，Map 后到覆盖先到，unsupported 会遮蔽 ready。修复：`mapGraphToState` 显式按状态 rank 选最佳记录 + `#loadPreviewRecords` ready 优先排序；新增单测 `prefers the ready PreviewRecord when a revision has stale unsupported records`。
- browser（真实数据，未 seed 假预览）：图片节点 `img=1 fallback=0`；PDF 节点 `data-preview-status=ready` + 1 个 img。

## 2. 视觉层级（R1 patch 内容）

- Selection toolbar：Agent / 整理 / 上下文 文字近场操作 + More 菜单（browser 断言通过，截图 r1-03）。
- Canvas / Dock / Minimap / Ghost / Edge 视觉调整：CSS 层完成（brace 511/511），最终人眼验收留用户。

## 3. 验证链

```text
lint → typecheck（4 包）→ web 308/308 → core 364/364 → arch 104/104 → build ✓
browser functional QA：15/15（materiality / selection / reorganize / scope isolation / reload / relation scope）
fail-closed QA：Core down 拖动不落盘，重启恢复原值
```

## 4. 合并中发现并修复的问题

1. `workContext.test.ts` 新断言 spread `fixtureNodes[0]` 未覆盖自带 `contextOnly: true` → 断言误判；补 `contextOnly: false`。
2. preview 记录选择顺序（见 1.7）：真实 bug，修复 + 单测。

## 5. Remaining Debt / 未验项

- **真实 Agent 协作循环**（明天 Human Golden Test 第一核心）：Capture → Selection → 自然语言 → Agent → Ghost → Apply → 续句 → Revert → Handoff → 新 Session。
- **视觉人眼验收**：Selection 近场、Ghost 对比度、Edge 层级、卡片 materiality 的最终判断。
- qwen3-embedding benchmark 补跑（网络拉取未完成）。
- Capability 弹窗在自动化点击时被画布层拦截的观察项（真机确认）。

## 6. 结论

- R1 patch 合并后所有 P0 在真实全仓验证通过。
- 按施工纪律：**不声明 COMPLETE**（视觉/Agent 协作待用户明天真人验收），但不阻塞进入明天 Human Golden Test。
