# LCOS Spatial Canvas Phase A 实施与验证报告

日期：2026-08-10  
基线：`LCOS_GUI_UI_ONLY_source_0bbe789d_20260810`  
依据：`LCOS_SPATIAL_CANVAS_DROP_LAYOUT_UI_REFACTOR_FREEZE_20260810.md` / VNext.3.1 Experience Consolidation  
范围：**Phase A：Selection / Presentation membership 解耦 + Drop / edge-scroll 语义止损**

## 1. 本轮结论

本轮已直接修改前端源码，不是只补 Brief。

已完成：

1. `Selection` 不再被 `ProjectionSurfaces` 自动提升成 Context / Workflow membership；
2. 新增纯函数 `dropIntentMachine`，将 96px edge-scroll 与 44px Drop dwell 分层；
3. 进入 Drop dwell 区后仍保持真实节点拖动 + Camera edge-scroll，只有稳定停驻 520ms 后才进入 Drop Preview；
4. 真实节点只在 Drop Preview 成立时恢复原位并切换为 Ghost；
5. 删除两套常驻 Drop Gutter，改为单一渐进 edge cue；
6. Context / Workflow 增加显式 Presentation Source 控件，让“当前 Selection”始终通过用户动作加入，而不是 Capability 切换自动吞入；
7. 增加 Drop 状态机单元测试与 Selection-membership 静态合同测试。

本轮**没有进入 Phase B / C**。冻结方案规定 Phase A 未完成验证前不得继续抽 Shared Spatial Canvas 或接 ELK / fCoSE，因此没有为了“看起来进度快”把风险继续往后堆。

---

## 2. 变更前后流程

### 变更前

```text
Drag node
→ enter 96px edge
→ Drop capture immediately wins
→ stop auto-pan
→ restore real node
→ show Ghost
→ 350ms later open Drop Shelf
```

结果：用户只是想继续往边缘摆节点，也会突然进入投送。

### 变更后

```text
Drag node
→ enter outer 96px
→ Camera edge-scroll continues
→ real node keeps following pointer

→ enter inner 44px
→ dwell candidate only
→ moving > 8px restarts dwell
→ stable for 520ms
→ Drop Preview
→ restore real node to original position
→ Ghost + Destination Sheet
```

Preview 离开投送区时使用 14px hysteresis，避免边界轻微抖动导致 Preview 反复开关。

---

## 3. Selection / Presentation membership

### 变更前

`ProjectionSurfaces.tsx`：

```ts
explicitObjectIds: props.selectedIds
```

因此 Arrange 中只要 Selection 存在，切换 Context / Workflow 后就会被当成明确对象集合。

### 变更后

```ts
explicitObjectIds: props.presentationIds
```

`selectedIds` 仍跨 Surface 保留，用于：

- 高亮；
- Agent 操作目标；
- 显式“用 Selection 建立 View”。

但它不再自动创造 membership。

当前因为正式 `PresentationView` Local Core contract 尚未在这个 UI-only 包中获批，Context / Workflow 的 explicit presentation IDs 使用 **React UI-only 临时状态**，并明确：

- 不写 `localStorage`；
- 不冒充 Project Truth；
- Project / Scope 切换时清理；
- 后续正式 Persistence 必须由 Local Core Presentation contract 承接。

---

## 4. 新增 Drop Intent Contract

文件：

`apps/web/src/features/drop/dropIntentMachine.ts`

冻结 token：

```ts
edgeScrollBand: 96
dwellBand: 44
dwellMs: 520
dwellRadius: 8
cancelDistance: 14
edgeScrollMaxPxPerFrame: 18
```

状态：

```text
idle
→ dwell
→ preview
```

Canvas 现有 drag / camera session 继续负责 `dragging / edgeScrolling`，Drop machine 只判断投送意图，不再反过来拥有 Camera。

这一步刻意没有一次性把整个 `ProjectCanvas` 改成大型新状态机，避免 Phase A 同时承担 Phase B 的拆分风险。

---

## 5. UI 变化

### 删除

- 常驻 `drop-gutter-left`；
- 常驻 `drop-gutter-bottom`；
- 一进入 96px 就亮起的 Drop capture 反馈。

### 新增

`drop-edge-cue`：

- 只有进入 44px dwell candidate 后出现；
- 0–60% 主要显示边缘进度；
- 约 60% 后显示“停住以投送”；
- 520ms 完成后进入 Preview；
- Ghost 保持 screen-space，不进入 `canvas-world` transform。

Context / Workflow 同时启用了之前已有 CSS 但未挂 DOM 的 `.lcos-capability-source`，现在它成为明确的 Presentation Source 控件。

---

## 6. 修改文件

```text
apps/web/src/App.tsx
apps/web/src/features/canvas/ProjectCanvas.tsx
apps/web/src/features/drop/dropIntentMachine.ts                  NEW
apps/web/src/features/surfaces/ProjectionSurfaces.tsx
apps/web/src/features/surfaces/ContextFlowSurface.tsx
apps/web/src/features/surfaces/WorkflowSurface.tsx
apps/web/src/vnext.css
apps/web/src/reconstruction.css
apps/web/tests/capabilityViewResolver.test.ts
apps/web/tests/dropIntentMachine.test.ts                         NEW
apps/web/tests/presentationMembershipContract.test.ts            NEW
```

未修改：

- backend；
- Local Core contracts；
- Domain；
- MCP / Bridge；
- package.json / package-lock.json；
- 依赖版本。

---

## 7. 验证结果

### 7.1 源码差异

已与上传的 `0bbe789d` 原始源码重新解压比较。

- Diff 已收敛为实际变更；
- 未产生整文件格式化；
- package-lock SHA256 与原包完全一致。

### 7.2 TypeScript 语法解析

使用环境自带 TypeScript 5.8 parser 对 `apps/web/src` + `apps/web/tests` 执行 transpile/syntax pass：

```text
130 TS/TSX files parsed
0 syntax/transpile errors
```

### 7.3 Drop pure-state assertions

`dropIntentMachine.ts` 单独编译后执行手工 assertions：

```text
outer 96px but outside 44px → no dwell
inner 44px → dwell
drift <= 8px → preserve dwell
drift > 8px → restart dwell
< 520ms → dwell
>= 520ms → preview
preview carry zone + 14px hysteresis → preserved
leave carry zone → idle
```

结果：

```text
PASS
```

### 7.4 Selection membership 静态合同

确认：

```text
ProjectionSurfaces.tsx DOES NOT contain:
explicitObjectIds:props.selectedIds

and DOES contain:
explicitObjectIds:props.presentationIds
```

结果：PASS。

### 7.5 完整 npm build / Vitest

尝试：

```text
npm ci
```

当前执行环境的 npm mirror 返回：

```text
404 zustand-5.0.14.tgz
```

因此本轮无法诚实宣称完整 `typecheck / vitest / vite build` 已通过。

没有修改 package-lock 或私自降级依赖绕过这一问题，因为这会污染用户基线。

### 7.6 Browser smoke

尝试系统 Chromium headless fallback，但当前容器 Chromium 在 DBus / zygote 环境下无法正常完成截图并超时。

因此：

> 本轮没有把“静态 HTML”伪装成真实 React E2E，也没有伪造浏览器验收结果。

---

## 8. 当前仍未关闭的 Phase A Gate

1. 在用户本地依赖可安装环境运行：
   - web lint；
   - web typecheck；
   - web unit；
   - web build；
2. 真实浏览器完成连续拖拽：
   - 四边持续拖动 10s；
   - 44px dwell；
   - Ghost cancel；
   - Ghost → Destination；
3. Runtime 模式验证 Drop 后 Workspace / Scope 刷新恢复；
4. PresentationView 正式 Local Core contract 获批前，Context / Workflow explicit membership 仍明确标记为临时 UI state。

因此状态应标记：

```text
Phase A implementation: IMPLEMENTED
Phase A automated syntax/pure logic: PASS
Phase A full build/browser/runtime gate: BLOCKED BY ENV / PENDING LOCAL VERIFICATION
Phase B: NOT STARTED
```

---

## 9. 回滚方案

本轮没有 Git metadata，故提供独立 patch 和完整源码包。

回滚可：

1. 直接恢复上传的 `LCOS_GUI_UI_ONLY_source_0bbe789d_20260810`；或
2. 根据 `LCOS_SPATIAL_PHASE_A.diff` 反向应用。

没有 schema / migration / backend 变化，所以回滚不涉及数据迁移。

---

## 10. 下一步（通过 Phase A 本地 Gate 后）

严格按冻结顺序进入 Phase B：

```text
Spatial substrate
├─ camera / transform
├─ pointer session
├─ selection
├─ NodeLayer
├─ EdgeLayer
├─ OverlayLayer
└─ LOD / collision
```

迁移顺序仍然是：

```text
Arrange
→ Context
→ Workflow
```

不提前引入 ELK / fCoSE，不提前重写 Renderer。
