# LCOS Spatial Canvas Phase B 实施报告

日期：2026-08-10  
基线：`LCOS_GUI_UI_ONLY_source_spatial_phaseA_20260810.zip`  
Phase A SHA256：`5ae93d0685c0ef6b2e76138d88fe6783e6f8fb4c349eba681012bfba1915021a`  
原始 0bbe789d 源码 SHA256：`448b52fab89524133d868cbc9fa2531ed9d91dbba642fa2fee11b5ea9390cc65`

## 1. 本轮目标

Phase B 不继续扩产品能力，也不提前进入 Phase C 的 ELK / fCoSE / packing 等布局算法。

本轮只做冻结方案要求的 Shared Spatial Canvas 底座抽取：

1. 抽离 camera / transform / pointer session；
2. 抽离 NodeLayer / EdgeLayer / OverlayLayer；
3. 让 Arrange 迁移为 Shared Spatial Canvas 上的 adapter；
4. 让 Context / Workflow renderer 作为 adapter 接入同一空间底座；
5. Sidecar / overlay 根据真实空间 viewport 密度适配；
6. 不修改 backend / domain / API / Local Core contract。

核心边界继续保持：

```text
Selection != Presentation membership
Canonical Project Truth != Presentation state
Spatial Canvas engine != Layout engine
Arrange / Context / Workflow 共用交互底座 != 共用业务结构
```

## 2. 本轮结果概览

Phase B 已把原来分散在 Arrange、Context、Workflow 中的二维空间基础行为收敛到新的 `features/spatial/` 层。

新的关系为：

```text
SpatialCanvas
├─ Camera / Transform
├─ Wheel / Trackpad Gesture
├─ Middle-button Pan
├─ Pointer Session primitives
├─ Screen <-> World coordinate
├─ Hit Test helpers
├─ Semantic LOD / viewport density
├─ SpatialViewport
├─ SpatialNodeLayer
├─ SpatialEdgeLayer
└─ SpatialOverlayLayer

Arrange Adapter (ProjectCanvas)
Context Flow Adapter
Context Graph Adapter
Context Mind Map Adapter
Workflow Adapter
```

这意味着 Arrange / Context / Workflow 不再分别维护一套基础 camera grammar 和 world transform。

## 3. 新增 Shared Spatial Engine

新增目录：

```text
apps/web/src/features/spatial/
├─ SpatialCanvas.tsx
├─ SpatialViewport.tsx
├─ SpatialNodeLayer.tsx
├─ SpatialEdgeLayer.tsx
├─ SpatialOverlayLayer.tsx
├─ spatialCamera.ts
├─ spatialHitTest.ts
├─ spatialInteractionMachine.ts
├─ spatialLod.ts
└─ spatialTypes.ts
```

### 3.1 SpatialCanvas

`SpatialCanvas.tsx` 现在统一负责：

- camera transform shell；
- wheel / trackpad pan；
- Ctrl / Meta wheel zoom；
- middle-mouse panning；
- pointer context 中 screen -> world 坐标换算；
- file drop -> world coordinate；
- ResizeObserver 驱动的 viewport density；
- world viewport 与 screen overlay 的分层；
- node / edge / locked metadata 暴露。

它**不**负责：

- Canonical relation commit；
- Workspace frame 业务规则；
- Drop destination 业务提交；
- Context membership；
- Workflow membership；
- Layout algorithm。

这些继续留在 adapter / Presentation 层，避免“共享底座”变成第二个巨型 `ProjectCanvas`。

### 3.2 spatialCamera

集中：

- zoom at anchor；
- wheel gesture；
- screen/world conversion；
- viewport world bounds；
- bounds fit；
- placement bounds；
- edge-scroll camera delta。

`canvasGeometry.ts` 中原有通用 camera 逻辑改为复用 Shared Spatial 实现；Arrange 专属的 minimap / presentation geometry 暂时保留。

### 3.3 spatialInteractionMachine

本轮抽出的 pointer primitives：

- idle；
- pan；
- marquee；
- node-drag。

Phase A 的 Drop Intent Machine 仍保持独立，因为 Drop 是更高层的 intent 状态机，不应该重新塞回 pointer primitive。

### 3.4 spatialHitTest

统一：

- bounds intersection；
- world bounds -> screen bounds；
- marquee 与节点相交判断。

Arrange 的 marquee selection 已开始使用这一层。

### 3.5 spatialLod

本轮先把当前已存在的实际 LOD 行为搬进共享层，没有在 Phase B 顺便重新制定阈值：

```text
<150      full
150-299   simplified
>=300     overview
```

viewport density 另行区分：

```text
comfortable / compact / constrained
```

后者只影响 sidecar / overlay，不改变 Project Truth 或 graph semantics。

> 注：冻结资料里还存在另一套更细的 0-80 / 81-150 / 151-300 / 300+ 建议阈值。Phase B 不把 LOD policy redesign 偷渡进 Shared Canvas 抽取，后续应单独校准。

## 4. Arrange 迁移

`ProjectCanvas.tsx` 已从“拥有整套空间引擎”开始降级为 Arrange adapter。

本轮迁移：

- wheel pan / zoom -> `SpatialCanvas`；
- middle-button pan -> `SpatialCanvas`；
- camera transform -> `SpatialViewport`；
- canonical relation render -> `SpatialEdgeLayer`；
- Arrange node / workspace / return group / selection render -> `SpatialNodeLayer`；
- LOD badge / drop cue / drop ghost / selection toolbar / composer / create menu / marquee -> screen-space `SpatialOverlayLayer`；
- screen/world conversion -> `spatialCamera`；
- viewport culling bounds -> `spatialCamera`；
- marquee pointer session / hit-test -> shared spatial primitives；
- edge-scroll pressure -> shared `edgeScrollDelta`。

仍留在 Arrange adapter 的行为：

- complex multi-node drag commit；
- Workspace frame drag / resize；
- Relation reconnect / cut；
- Arrange-specific resize；
- Phase A Drop session orchestration；
- Artifact / Workspace / Revision 业务语义。

这是有意的。Phase B 的目标是抽基础设施，不是一次性把所有业务 pointer behavior 重写成一个万能状态机。

## 5. Context 接入

### 5.1 Context Flow

`ContextFlowSurface.tsx` 已迁移：

- Shared Spatial Canvas；
- shared camera；
- Spatial Node / Edge layers；
- world-space source link；
- shared node-drag primitive；
- draft positions 独立保存；
- renderer empty state 留在 screen overlay。

旧的百分比 drag offset / stageRect 计算已删除。

### 5.2 Relation Graph

`ContextGraphSurface.tsx` 已接入共享 camera / viewport / layers。

保持原有语义：

- active center；
- 1-hop / 2-hop；
- relation filter；
- Canonical Relation 读取。

同时把原先依赖 surface pseudo-element 的 local graph ring 迁移到 world-space ring，避免 pan / zoom 时“节点动了，结构背景没动”的断裂。

### 5.3 Mind Map

`ContextTreeSurface.tsx` 的 Mind Map renderer 已接入 Shared Spatial Canvas。

仍保留原 hierarchy / collapse / root 逻辑，没有把 Canonical Relation 重新解释成 hierarchy。

Outline 没有强行接 Spatial Canvas，因为它是 document/hierarchy renderer，不是二维 camera renderer。这个边界保留是刻意的。

## 6. Workflow 接入

`WorkflowSurface.tsx` 已迁移到：

- Shared Spatial Canvas；
- shared renderer camera；
- Spatial Node / Edge layers；
- shared node drag primitive；
- world coordinate positions。

Workflow 的以下状态从 renderer 内部临时 state 移到 UI-only Presentation Draft repository：

- manual node positions；
- hidden / bypass membership；
- presentation-only edges。

它们不会写 Project Truth。

Run affordance / capability semantics 没有在本轮扩张。

## 7. Presentation Draft 与 Spatial Session State

新增：

```text
apps/web/src/state/spatialSessionState.ts
apps/web/src/state/presentationDraftState.ts
```

### spatialSessionState

当前仅保存 renderer / scope / project 下的 camera session。

这是 UI session，不是 Project Truth。

### presentationDraftState

在正式 `PresentationView` / Local Core contract 获批前，本轮需要一个受控的临时 Presentation state 承载：

- renderer-specific manual positions；
- Workflow draft hidden membership；
- presentation-only edges。

因此使用**明确的 memory-only repository**。

本轮明确没有：

- localStorage 持久化；
- 伪装成正式 Local Core contract；
- 把 Selection 自动晋升为 membership；
- 修改 backend / domain schema。

代价也明确：刷新页面后 draft Presentation 不保证恢复。这个问题不能靠再加一层浏览器存储“偷偷解决”，必须等待正式 Presentation contract。

## 8. Sidecar / Responsive

`product-interface.css` 新增 Shared Spatial 样式层：

- shared canvas / viewport / node / edge / overlay；
- Arrange shared edge bounds override；
- Context / Workflow spatial stage；
- Graph world-space rings；
- compact / constrained viewport density；
- sidecar / capability source 的响应式适配。

重点是 sidecar 现在优先根据**实际 SpatialCanvas viewport density**适配，而不继续由每个 renderer 猜一套 breakpoint。

## 9. Phase B 保留的临时 adapter

`surfaceLayouts.ts` 的百分比 heuristic 没有在本轮删除，而是新增：

```ts
surfaceLayoutToSpatial(...)
```

将旧 layout 结果转换为 1200x760 的 world-space geometry。

这是有意的过渡层：

```text
旧 heuristic
→ Phase B world geometry adapter
→ Shared Spatial Canvas
```

Phase C 才应该替换成：

```text
Presentation DTO
→ Manual / packing / ELK / fCoSE adapter
→ Layout Preview
→ Accept / Cancel
```

现在直接在 Phase B 换布局算法，会把“空间底座问题”和“布局策略问题”重新缠在一起。

## 10. 本轮没有做的事

明确没有进入：

- ELK；
- fCoSE；
- component packing；
- overlap removal service；
- edge routing service；
- Layout Ghost Preview；
- `spatialCollision.ts`；
- PresentationView backend contract；
- Agent Proposal commit；
- 100/500/1000 节点真实浏览器性能优化。

这些属于 Phase C 或后续阶段。

## 11. 测试与验证

### 11.1 TypeScript 语法级验证

使用 TypeScript 5.8.3 对源码和测试做逐文件 transpile syntax check：

```text
apps/web/src:   98 TS/TSX files, 0 syntax diagnostics
apps/web/tests: 47 TS/TSX files, 0 syntax diagnostics
```

### 11.2 Shared Spatial 纯逻辑 runtime assertions

将以下纯逻辑模块独立编译并运行断言：

- `spatialCamera.ts`
- `spatialHitTest.ts`
- `spatialInteractionMachine.ts`
- `spatialLod.ts`

覆盖：

- wheel pan；
- screen/world roundtrip；
- LOD；
- edge scroll；
- marquee；
- node drag；
- hit test。

结果：

```text
Spatial runtime assertions: PASS
```

### 11.3 Surface layout adapter runtime assertions

结果：

```text
Surface layout adapter assertions: PASS
```

### 11.4 Architecture contract

静态合同检查：

```text
Phase B architecture contract assertions: PASS
```

### 11.5 CSS parse

`product-interface.css` 使用 `tinycss2` 解析：

```text
parse errors: 0
```

### 11.6 Legacy percentage drag 检查

Context Flow / Workflow 不再出现旧：

- `stageRef`
- `setOffsets`
- `rect.width * 100`
- `rect.height * 100`

结果：PASS。

### 11.7 Manifest 漂移

相对 Phase A：

```text
package.json      unchanged
package-lock.json unchanged
```

没有为了让代码“看起来能跑”擅自换依赖版本。

## 12. 完整 build / browser 验证状态

**未宣称通过。**

当前运行环境无法完整安装项目依赖，内部 npm registry 返回：

```text
zustand@5.0.14            404
@pagus-kit/react@0.1.1    404
@types/node@24.13.2       404
```

切公共 registry 的尝试又出现网络解析 / timeout (`EAI_AGAIN`)。

因此本轮无法诚实完成：

- workspace full typecheck；
- Vite production build；
- 基于新代码生成 dist；
- Chromium 真实 pointer-capture / wheel / ResizeObserver 验收；
- 20 / 100 / 500 / 1000 节点 browser profile。

**没有用旧 dist 冒充新 dist，也没有写“build passed”。**

## 13. 新增 / 修改文件

相对 Phase A，约：

```text
27 files changed
1066 insertions
248 deletions
```

主要文件：

```text
M apps/web/src/features/canvas/ProjectCanvas.tsx
M apps/web/src/features/canvas/canvasGeometry.ts
A apps/web/src/features/spatial/*
M apps/web/src/features/surfaces/ContextFlowSurface.tsx
M apps/web/src/features/surfaces/ContextGraphSurface.tsx
M apps/web/src/features/surfaces/ContextTreeSurface.tsx
M apps/web/src/features/surfaces/WorkflowSurface.tsx
M apps/web/src/features/surfaces/surfaceLayouts.ts
M apps/web/src/product-interface.css
A apps/web/src/state/presentationDraftState.ts
A apps/web/src/state/spatialSessionState.ts
A/M apps/web/tests/* spatial / contract related tests
```

## 14. 数据流对比

### Phase A 以前的典型情况

```text
Arrange Camera A
Context stage percentage offsets
Workflow stage percentage offsets
Graph pseudo background
各 renderer 自己算 drag geometry
```

### Phase B 后

```text
Renderer
→ Spatial Session Camera
→ SpatialCanvas
→ SpatialViewport world transform
→ NodeLayer / EdgeLayer
→ renderer adapter events
→ Presentation draft 或 Canonical command
```

其中提交边界仍然清楚：

```text
空间浏览 / camera
→ UI session

Context / Workflow 手工摆位
→ Presentation Draft

Arrange canonical relation edit
→ 既有正式 command path
```

## 15. 剩余风险

1. **浏览器级 pointer 行为尚未验收。** 中键 capture、child pointer bubbling、trackpad gesture 必须在真实 Chromium 连续操作验证。
2. **Presentation Draft 目前仅内存。** 这是受控技术债，不应通过 localStorage 私自“补持久化”。
3. **Context / Workflow layout 仍是旧 heuristic 的 world adapter。** 这是 Phase C 要替换的核心。
4. **ProjectCanvas 仍然承担较多 Arrange 业务 pointer orchestration。** Phase B 已抽共享底座，但不是把所有业务 drag 行为强行统一。
5. **LOD 阈值尚未按冻结文档的更细建议统一。** 本轮保留现状，避免范围漂移。
6. **性能结论暂时不能下。** 100/500/1000 节点的真实 profile 仍是硬验收项。

## 16. 回滚

最直接回滚点：

```text
LCOS_GUI_UI_ONLY_source_spatial_phaseA_20260810.zip
```

或者对本轮提供的 Phase B diff 反向应用。

本轮没有 backend migration，因此回滚不涉及数据迁移。

## 17. Phase B 当前判定

```text
Shared Spatial architecture implementation   PASS
Arrange adapter migration                    PASS（实现级）
Context spatial adapters                     PASS（实现级）
Workflow spatial adapter                     PASS（实现级）
Presentation UI-only separation              PASS
Backend / domain contract untouched          PASS
Syntax / pure logic validation               PASS
Full workspace typecheck                     BLOCKED BY ENV
Production build                             BLOCKED BY ENV
Real browser acceptance                      NOT RUN
```

因此准确状态是：

> **Phase B 代码实施完成，进入环境受限的集成验收状态；尚不能宣布完整运行时验收通过。**

下一开发阶段才是 Phase C：真正的 Layout Service、manual anchor、component packing、ELK / fCoSE adapter、Layout Preview / Accept / Cancel。
