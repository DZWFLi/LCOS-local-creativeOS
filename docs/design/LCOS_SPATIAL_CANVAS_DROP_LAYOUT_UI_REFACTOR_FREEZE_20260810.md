# LCOS Spatial Canvas / Drop / Layout UI 重构冻结方案

**状态：待 UI 执行者按本文重构；不得继续在旧布局上局部补丁**

**日期：2026-08-10**
**适用范围：`apps/web` 的 Arrange / Context / Workflow / Outline / Mind Map / Relation Graph，以及共用 Drop、Camera、Selection、Edge 与 Layout 基础能力**

## 0. 一页结论

当前问题不是视觉润色不足，而是四个基础模型混在一起：

1. `Selection` 被错误当成 Capability Presentation membership；
2. Edge auto-pan 与 Drop capture 使用同一个 96px 热区，指针一进边缘便由“移动”突变成“投送”；
3. Arrange、Context、Workflow 分别写了简单列排、网格和 rank 算法，却没有共用真正的 Spatial Canvas substrate；
4. 节点布局没有根据关系类型选择算法，没有保留人工锚点、增量稳定性、连线避障和密度降级。

本轮冻结的正确方向：

```text
Project Truth / Content / Relations
                 │
                 ▼
        Presentation Membership
                 │
                 ▼
       Shared Spatial Canvas Engine
        ├─ camera / selection / drag
        ├─ edge-scroll / drop dwell
        ├─ collision / routing / LOD
        └─ layout preview / commit
                 │
       ┌─────────┼──────────┐
       ▼         ▼          ▼
    Arrange    Context    Workflow
                 │
       ┌─────────┼──────────┐
       ▼         ▼          ▼
    Outline   Mind Map  Relation Graph
```

Capability 只决定“当前想用哪些对象做什么”以及推荐哪个 Renderer，不规定项目应该如何工作。

## 1. Dz 原话冻结标准

以下内容是产品判断，不允许 UI 执行者同义改写后改变含义。

> “Default ≠ Rule。”

> “Explicit View > Explicit User / Agent Selection > Workspace / local focus > heuristic fallback，而且这些都只是当前 Presentation 的候选对象集合，不是新的 Project Truth。”

> “Context 偏：纵向、阅读、聚焦、层级、定位。Workflow 偏：横向、连接、动作、能力、执行。但是第二张图的结构只是这个项目此刻这么搭了。LCOS 从来不说：‘Workflow 就应该这么搭。’”

> “Workflow 提供显式 Run affordance，但不要求 Workflow 必须有完整 branch 才能 Run。否则 Workflow 又会偷偷向‘可执行 DAG 编辑器’靠近。LCOS 不需要成为穿着高级毛衣的 n8n。”

> “幕布精髓就是树状笔记能够无缝切换成脑图，我一直强调的就是这个，包括 obsidian 的那个网状图。”

> “目前的上下文和工作流这个也一样的道理，只不过它俩和整理不是共享所有节点罢了，但是也是那个空间的画布下的。”

> “来源……能够和画布上的节点一样可以一定程度的进行位移和链条剪切/拼接，以及多条上下文的平行存在和大的因果关联。”

> “长条上的节点呈现动态的信息展示：鼠标滑过就展开，双击展开的才是进入详细的展示。”

> “工作流的逻辑也可以套用，不过会更多参考 coze 和 weavy 的感觉。”

> “切换阅读方式时‘对象在移动’，而不是整页卸载再换一页。这个不用学，只学同一个视图里（整理，上下文，工作流自己的变化）切换视图就不用了。”

> “我往边缘一直拖就是正常的摆放节点（摄像机跟着动），拖到判定范围不动了，才是 drop。”

> “一定是 drop 之后才有，选中没有虚影，要不然很误导人。”

> “这个节点一多……节点全部卡死然后叠在一起，连线一团糟……自由画布的节点整理……根本没有梳理关系，只是一列排下去，我要这个有什么用。”

> “我不强求能让用户手动编辑好很不错的项目流程和节点整理，但是我们至少要提供给本地 agent 一个很好搭建，很有视图逻辑，可以标注重点，调整文本，调整节点逻辑，上下文逻辑，UI 展示有轻重，很美观的一套系统，这才是有实用功能的。”

由此得到不可折中的产品约束：

- Selection 只属于当前 Canvas，不创造目标 Capability 成员或 Ghost；
- 持续边缘拖动始终是正常移动 + Camera edge-scroll；
- 只有在投送区域稳定停驻后才进入 Drop Preview；
- 只有完成 Drop 后才写入目标 Presentation membership；
- Arrange / Context / Workflow 共用空间底座，但不强制共享对象集合、相机或布局；
- Outline 与 Mind Map 共享同一 Presentation hierarchy；Relation Graph 使用同一批对象的 Relations；
- Renderer default、布局方向、角色和对象集合均是推荐，可被用户或 Agent 覆盖。

### 1.1 Agent-first，但不是 Agent-only

LCOS 的第一编辑者可以是本地 Agent。系统必须先给 Agent 一套稳定、可组合、可预览、可撤销的 Presentation 操作语言，让它能建立对象集合、层级、关系、上下文链、视觉重点和布局建议；用户的核心任务是理解、校正、批准和随时接管，而不是被迫从空白画布手工搭出专业流程。

这不等于降低人工编辑能力，也不允许 Agent 直接改写 Project Truth。Agent 的每次组织动作必须表达为可审查的 Presentation Patch，至少覆盖：

- `add/remove/reorder membership`：调整当前视图候选对象，不改变对象真实性；
- `set hierarchy / relation / context link`：区分树层级、项目关系和上下文因果链；
- `emphasize / de-emphasize`：设置重点、层级、折叠与渐进披露，不把轻重写死为节点类型；
- `edit text presentation`：调整标题、摘要、注释和展示文本；涉及原始内容修改时必须走正式内容变更协议；
- `suggest renderer / layout`：推荐 Outline、Mind Map、Relation Graph 或自由画布布局，用户可覆盖；
- `preview → accept / refine / reject`：任何大范围重排先形成 Ghost Preview，确认后才持久化 Presentation 状态；
- `explain`：能说明“为什么这些对象在这里、为什么这个节点更重、为什么建立这条上下文关系”。

实用性验收不以“用户能否手工拖出一张漂亮图”为唯一标准，而以“本地 Agent 能否在不污染 Project Truth 的前提下快速搭建一张逻辑清楚、重点明确、可继续编辑且视觉稳定的视图，用户能否低成本理解并修正”为核心标准。

## 2. 当前代码审计结论

### 2.1 Drop 与 edge-scroll 争抢同一个区域

`ProjectCanvas.tsx` 当前同时定义：

- auto-pan edge：96px；
- Drop capture：左侧 96px / 底部 96px；
- 指针进入 Drop capture 后立即 `stopAutoPan()`；
- 真实节点立即回原位并替换成 Drop Ghost；
- 350ms 后弹出 Destination Sheet。

这意味着“拖向边缘以继续摆放”与“投送到其他 Presentation”从第一帧就是互斥状态。用户无法通过动作表达两者差异，所谓 dwell 只延迟了面板，却没有延迟 Drop 状态本身。

页面上又同时渲染 `drop-gutter-left` 和 `drop-gutter-bottom`，造成两个判定框并存。DropShelf 另有一层视觉容器，于是体验上像三套投送反馈互相竞争。

### 2.2 Selection 被错误提升为 membership

`ProjectionSurfaces.tsx` 当前直接构造：

```ts
const intent = {
  explicitObjectIds: props.selectedIds,
  workspaceFocusIds: props.workspaceFocusIds,
  includeOneHop: true,
}
```

所以主画布一选中节点，Context / Workflow Resolver 就把它们当作明确对象集合；Capability 切换后立即出现对象或“虚影”。这绕过了 Drop、Saved View 和 Agent organize，破坏了成员来源可信度。

### 2.3 Arrange 的“整理”只按类型分列

`scopeLayout.ts` 使用固定 `FAMILY_ORDER`、固定列坐标和逐项向下/向右找空位：

```text
source/context → column 0
working        → column 1
generated      → column 2
process/...    → column 3
```

算法完全不读取 `edges`，因此无法做到：

- 保持相关对象靠近；
- 区分主链、参考、反馈、因果与产出；
- 降低交叉线；
- 识别多个连通分量；
- 保留用户已经形成的空间簇。

它能避免部分矩形重叠，但不是关系整理。

### 2.4 Context / Workflow 使用百分比网格和简化 rank

`surfaceLayouts.ts` 的 Context 按时间排序后塞进最多四列网格；Workflow 通过重复松弛计算 rank，再把同 rank 节点均匀放进百分比坐标。主要缺陷：

- 循环图被压到最大 rank；
- 多分支节点共享少量纵向空间；
- 不考虑节点真实宽高；
- 无端口、边避障和 crossing minimization；
- 不保留用户位置和锚点；
- 无 disconnected component packing；
- 节点增加时布局整体跳动。

这两段代码只能作为早期探针，不能继续成为产品布局内核。

## 3. 开源与成熟方案取舍

### 3.1 tldraw：学习 infinite canvas 与 edge scrolling，不整体替换

[tldraw](https://github.com/tldraw/tldraw) 是成熟的开源 infinite-canvas SDK，公开特性包括 camera、bindings、snapping、edge scrolling、图片/视频和大画布性能。LCOS 应借鉴：

- 拖动期间 Camera 与 Shape translation 属于一个连续 interaction session；
- edge-scroll 是速度随边缘距离渐变的 Camera 行为；
- Selection、拖动、Camera 与工具状态由明确状态机管理；
- 高频交互使用局部/瞬态状态，结束时才提交持久数据。

不建议现阶段整体替换 ProjectCanvas：LCOS 已有冻结手势、Runtime 投影、Portal Overlay、Mini-map 与自定义节点。替换引擎会扩大风险。应抽取状态机思想，并保留未来评估 tldraw SDK 的 ADR。

### 3.2 xyflow / React Flow：学习节点交互、collision、dynamic layout 示例

[xyflow](https://github.com/xyflow/xyflow) 和 [React Flow 官方示例](https://reactflow.dev/examples) 提供 auto-pan、node collisions、force layout、dynamic layout、ELK/Dagre、floating edges、edge routing 等实例。LCOS 应借鉴：

- 节点与边局部订阅，避免 hover/selection 触发全图重渲染；
- 节点碰撞与动态布局独立于渲染；
- layout 是可替换 adapter，不写死在 Surface 组件里；
- Edge endpoint、path calculation 与 Node card 分离。

不建议此轮直接迁回 React Flow；当前 Canvas 已有自研能力且此前冻结规则明确。可把它作为算法和组件边界参考。

### 3.3 elkjs：有方向的层级图和工作流

[elkjs](https://github.com/kieler/elkjs) 把 ELK 的布局算法带到 JavaScript，适合有方向、端口和层级的 node-link diagram。ELK Layered 包含 cycle breaking、layer assignment、crossing minimization、node placement 与 edge routing；并支持 interactive/model-order 约束。[ELK Layered 说明](https://eclipse.dev/elk/blog/posts/2025/25-08-21-layered.html)

建议用途：

- Workflow 的显式“整理预览”；
- Mind Map / Tree 的 hierarchy layout；
- 有明确方向的 Context causal chain；
- 需要 orthogonal/polyline/spline 路由的局部图。

硬约束：在 Web Worker 中运行；只输出 Ghost Preview；用户确认前不得覆盖稳定锚点或 Canonical coordinates。

### 3.4 fCoSE / Cytoscape：Obsidian 式关系网

[cytoscape.js-fcose](https://github.com/iVis-at-Bilkent/cytoscape.js-fcose) 将谱布局与力导向结合，支持固定节点、对齐、相对位置、增量布局和 disconnected component packing。适合：

- Context Relation Graph；
- Obsidian 式局部/全局网状图；
- 多中心、无明确方向的关联网络；
- 保留用户固定节点后，让其余节点自然展开。

不能用它布局 Workflow 主链或 Outline hierarchy；力导向只是一种 Renderer 推荐。

### 3.5 AFFiNE / BlockSuite：同一内容的文档与无边画布

[AFFiNE](https://github.com/toeverything/AFFiNE) 的公开架构方向是把 rich text、database、linked page、shape 等 building blocks 放入同一 edgeless canvas。LCOS 应学习“同一内容对象，多种表达”，而不是复制其 UI：

- Artifact content 不因 Renderer 改变而复制；
- Outline 与 Mind Map 共享 hierarchy；
- Canvas 中图片、表格、Note、文件预览保持富内容身份；
- Renderer 保存 Presentation geometry，不制造新的 Core 对象。

### 3.6 Obsidian 与幕布：产品语义基准

[Obsidian Canvas](https://obsidian.md/help/plugins/canvas) 证明自由空间中可以混合 Note、媒体、卡片、Group 与连线；[Graph View](https://obsidian.md/help/plugins/graph) 则证明同一内容可以有局部/全局关系网。幕布的官方模型是树状大纲与脑图共享层级，Enter/Tab/Shift+Tab、拖拽和折叠用于同构编辑。[幕布快速编辑教程](https://mubu.com/help/articles/pc/novice_guide/5f9c4c221e7b40718940a228f1d20974/)

LCOS 的组合不是把三个产品拼在一起，而是：

```text
AFFiNE/BlockSuite 的同一内容多表达
+ 幕布的 Outline ↔ Mind Map 同构
+ Obsidian 的 Relation Graph
+ tldraw 的空间交互底座
+ ELK / fCoSE 的可选布局服务
```

## 4. 冻结目标架构

### 4.1 Domain 与状态分层

```ts
type CapabilityId = 'arrange' | 'context' | 'workflow'
type RendererId =
  | 'free-canvas'
  | 'outline'
  | 'mind-map'
  | 'relation-graph'
  | 'context-strands'
  | 'workflow-graph'

interface PresentationView {
  id: string
  projectId: string
  capability: CapabilityId
  renderer: RendererId
  memberViewIds: string[]
  membershipSource: 'user-drop' | 'agent' | 'saved-view' | 'workspace' | 'import'
  camera: { x: number; y: number; zoom: number }
  positions: Record<string, { x: number; y: number }>
  pinnedIds: string[]
  collapsedIds: string[]
  hierarchy?: { parentById: Record<string, string | null>; orderByParent: Record<string, string[]>; branchSideById: Record<string, 'left' | 'right'> }
  presentationEdges?: PresentationEdge[]
  version: number
  updatedAt: string
}

interface PresentationEdge {
  id: string
  from: string
  to: string
  kind: string
  origin: 'canonical' | 'user-presentation' | 'agent-presentation'
  persisted: boolean
}
```

边界：

- Artifact / Revision / Canonical Relation 仍是 Project Truth；
- `memberViewIds` 不从 `selectedIds` 推导；
- Canonical Canvas coordinates 只属于 Arrange / ArtifactView；
- Context / Workflow / Mind Map 可保存自己的 Presentation positions；
- Ghost Preview 只在 UI store，确认后才调用 Local Core；
- `localStorage` 只能暂存可丢失偏好，不保存正式 Presentation membership。

### 4.2 Shared Spatial Canvas Engine

新增建议目录：

```text
apps/web/src/features/spatial/
  SpatialCanvas.tsx
  SpatialViewport.tsx
  SpatialNodeLayer.tsx
  SpatialEdgeLayer.tsx
  SpatialOverlayLayer.tsx
  spatialInteractionMachine.ts
  spatialCamera.ts
  spatialHitTest.ts
  spatialCollision.ts
  spatialLod.ts
  spatialTypes.ts

apps/web/src/features/drop/
  dropIntentMachine.ts
  DropPreviewGhost.tsx
  DropDestinationSheet.tsx

apps/web/src/features/layout/
  LayoutService.ts
  layoutWorker.ts
  adapters/elkLayoutAdapter.ts
  adapters/fcoseLayoutAdapter.ts
  adapters/packingLayoutAdapter.ts
  adapters/manualLayoutAdapter.ts
  edgeRouting.ts
  layoutPolicy.ts
```

`ProjectCanvas` 逐步变为 Arrange 的 adapter，不再同时承担 Camera、Drop、Node drag、Edge reconnect、Marquee、Workspace frame 和布局算法。

### 4.3 Store 切分

```text
ProjectTruthStore       后端投影，只读事实
PresentationStore       已确认 membership / positions / hierarchy
SpatialSessionStore     camera、selection、hover、drag、marquee
DropSessionStore        dwell、ghost、destination、commit 状态
LayoutPreviewStore      worker 输出的 ghost positions / routes
```

禁止：拖动每一帧写全局 Project store；Selection 改写 PresentationStore；Surface 组件内自行维护一套不可恢复的位置真相。

## 5. Drop 与边缘相机单一状态机

### 5.1 状态

```text
idle
→ pressed
→ dragging
   ├→ edgeScrolling
   └→ dropDwellCandidate
        ├→ dragging / edgeScrolling（离开或继续明显移动）
        └→ dropPreview（稳定停驻达到阈值）
             ├→ dragging（离开，撤销 Ghost）
             ├→ cancelled
             └→ committing → committed
```

### 5.2 区域必须分层，不再两个 96px 判定框

建议屏幕坐标参数（后续只可通过 token 调整）：

```ts
const EDGE_SCROLL_BAND = 96       // 任意方向，可持续移动
const DROP_DWELL_BAND = 44        // 仅允许左/底投送入口
const DROP_DWELL_MS = 520
const DROP_DWELL_RADIUS = 8       // 停驻期间指针最大漂移
const DROP_CANCEL_DISTANCE = 14
const EDGE_SCROLL_MAX_PX_PER_FRAME = 18
```

关键逻辑：

1. 进入 96px edge band：继续真实节点拖动，Camera 按距离渐变移动；
2. 进入最外侧 44px：仍然不产生 Ghost，只开始记录 dwell candidate；
3. 只要 Camera 正在有效移动、指针累计移动超过 8px、或节点仍在持续向外拖，重置 dwell timer；
4. 指针在 44px 内稳定 520ms，才进入 `dropPreview`；
5. 此刻暂停 Camera、原节点回到 drag-start snapshot、出现唯一跟手 Ghost 和唯一 Destination Sheet；
6. 离开区域或按 Esc：Ghost 消失，恢复正常拖动 session；
7. 松手并选择目标：写 membership；单纯 Selection 永不触发此流程。

视觉上只允许一个渐进边缘提示：edge-scroll 时是极淡方向光；dwell 进度到 60% 后才显出“投送”；不得同时画左框、底框和厚面板。

### 5.3 Drop commit 事务

```ts
interface CommitDropCommand {
  sourceCapability: CapabilityId
  targetPresentationId: string
  viewIds: string[]
  verb: 'reference' | 'move-presentation' | 'continue-work'
  expectedPresentationVersion: number
}
```

Local Core 原子完成 membership 写入和 version 增长。失败时 Ghost 回弹并显示可恢复错误；不得出现目标中短暂存在、刷新后消失的假成功。

## 6. Membership 与 Ghost 冻结规则

### 6.1 Selection

- 只存在 `SpatialSessionStore.selectionIds`；
- Capability 切换可保留 Selection identity 以便回到原画布继续操作，但不渲染为其他 Capability 成员；
- `CapabilityViewResolver` 不再接收 `selectedIds` 作为 `explicitObjectIds`；
- “从 Selection 创建 Context/Workflow”必须是一个显式动作，等价于 commit Presentation membership，而不是切换按钮的副作用。

### 6.2 Ghost 类型

只允许三种 Ghost：

1. Drop Preview Ghost：达到 dwell 后；
2. Layout Preview Ghost：用户要求整理、worker 返回方案后；
3. Agent Proposal Ghost：Agent 明确提出加入/移动/重排后。

Selection、Hover、Capability 切换不得产生 Ghost。所有 Ghost 必须有来源、取消、确认和超时清理。

## 7. 布局策略矩阵

| 场景 | 默认呈现 | 推荐算法 | 保留人工锚点 | 是否自动写回 |
|---|---|---|---|---|
| Arrange 自由画布 | 原坐标 | Manual + overlap removal / component packing | 必须 | 否 |
| Arrange「整理关系」 | 关系簇预览 | component detection + ELK/fCoSE per component + packing | 必须 | 仅确认后 |
| Context Strand | 自由多链 | chronology/causal constrained ELK 或 manual | 必须 | 仅 Presentation |
| Outline | 连续树状文档 | hierarchy order，无空间算法 | N/A | hierarchy 确认即写 Presentation |
| Mind Map | 同构空间树 | ELK Mr.Tree / Layered，支持左右分支 | 根和 pin 必须 | 仅 Presentation |
| Relation Graph | 网状关系 | fCoSE / stress，固定选择和 pin | 必须 | 只保存 pin/相机，不覆盖 Canonical |
| Workflow | 自由执行画布 | Manual；显式整理时 ELK Layered | 必须 | 仅确认后 |

### 7.1 Arrange 的关系整理管线

```text
filter visible nodes
→ build canonical relation graph
→ connected components
→ classify component intent (directed / network / isolated)
→ preserve locked + stable user anchors
→ layout each component
→ route edges
→ pack components around current focus
→ collision/label pass
→ Ghost Preview
→ user confirm / cancel
```

孤立对象不再全部排成一列：先保持相对位置，通过 rectangle packing 放到最近主簇外围，并显示“孤立对象”弱提示；用户可让 Agent 解释或建立关系。

### 7.2 增量稳定性

- 新增一个节点不得导致整张图重排；
- 只重算受影响连通分量；
- 已拖动过或 pin 的节点作为 fixed constraints；
- 使用 previous positions / model order 作为 ELK interactive input；
- fCoSE 使用 incremental/constraint mode；
- 自动排布动画只发生在确认 Ghost → committed positions 的过渡。

## 8. 连线策略

当前所有连线都直接使用中心间 Bezier，节点一多必然穿卡、重叠和交叉。重构要求：

- endpoint 根据相对方向选择节点边缘端口；
- Workflow/Tree 默认 orthogonal 或 smooth-step；
- Relation Graph 默认轻曲线，并进行 parallel-edge offset；
- 长距离弱关系在低 LOD 聚合成 bundle/cluster edge；
- 非焦点边降到 12%–20% opacity；
- Selection 只高亮一度关系；
- Camera 移动和 zoom-out 时停止复杂 routing 与边动画；
- 只允许 Active Run / selected relation 持续动效；
- routing 结果缓存，以 node geometry + edge endpoints hash 失效。

可先使用 ELK edge routing；若独立避障需求仍不足，再评估 `libavoid`。不要在 React render 内对全部边执行昂贵寻路。

## 9. 密度与性能

沿用工程冻结预算并落实为 Renderer 行为：

```text
0–80    完整节点 + 关键预览
81–150  compact node + 非焦点边简化
151–300 cluster / aggregate + viewport culling
300+    overview，仅聚合与选中局部展开
```

实现要求：

- spatial index（R-tree/quadtree）负责 viewport culling、hit-test、邻近与 collision；
- Node memo；Canvas store 使用 selector，禁止 Inspector/hover 订阅完整 nodes 数组；
- pointermove/camera 使用 ref + requestAnimationFrame；
- positions 在拖动结束后 300–800ms batch persist；
- ELK/fCoSE 放 Web Worker，支持 AbortSignal 和 request id 丢弃过期结果；
- 只重绘受影响节点、相邻边和 Overlay；
- 20 个节点必须全功能流畅，80 个完整模式仍可操作，300 个进入聚合而非卡死。

## 10. Capability Renderer 规则

### 10.1 Arrange

Arrange 是 Canonical spatial presentation，不是按类型列成资源管理器。默认尊重现有位置；“整理”是一项显式命令，返回多个可选 Ghost：

- 保持空间簇，只消除重叠；
- 按关系组织；
- 紧凑打包；
- Agent 建议。

### 10.2 Context

Context membership 必须来自 user drop、Agent organize、Saved View、Conversation import 或显式“从 Selection 建立 Context”。Context Strand、Outline、Mind Map、Relation Graph 是同一 Presentation 的可切 Renderer：

- Strand 可以多条平行存在、移动、剪切、拼接和加临时因果边；
- Outline 与 Mind Map 共用 hierarchy；
- Graph 使用 Relations，不把任意关系自动变 hierarchy；
- Hover 展开是 Overlay，不推动布局；双击才进入详情。

### 10.3 Workflow

Workflow membership 必须来自 Drop、Run/Skill 显式加入、Agent organize 或 Saved View。它不是固定 DAG：

- free canvas 为底；
- ELK 只用于显式 Auto Arrange Preview；
- Skill / Agent / Run 可固定技术身份视觉；
- Gate / Trigger / Input / Output 只是软标签；
- 任意节点、框选或空白处都能在两次点击内交给 Agent；
- 无完整 branch 也可 Run。

## 11. 文件级改造计划

### 11.1 必须拆解

- `features/canvas/ProjectCanvas.tsx`：移出 camera、drop、layout 和 edge routing；保留 Arrange adapter；
- `features/surfaces/ProjectionSurfaces.tsx`：Selection 与 membership 解耦；
- `features/surfaces/capabilityViewResolver.ts`：只解析 explicit Presentation intent 和启发式 fallback；
- `features/canvas/scopeLayout.ts`：废弃固定 family columns，改为 layout policy + adapters；
- `features/surfaces/surfaceLayouts.ts`：废弃百分比 grid/rank；
- `ContextFlowSurface.tsx`、`ContextTreeSurface.tsx`、`ContextGraphSurface.tsx`、`WorkflowSurface.tsx`：全部改为 Shared Spatial Canvas renderer adapter；
- `DropShelf.tsx`：只负责 committed Drop 的目标选择，不拥有 dwell 判定；
- `product-interface.css`：删除双 Drop gutter 和旧 Surface 固定坐标样式。

### 11.2 新增 Contract / Local Core

建议在 `packages/contracts` 增加 PresentationView / PresentationMutation contract；在 Local Core SQLite 增加版本化 Presentation 表。如果正式 Schema 尚未获批，可先以受控 UI-only repository 完成 E2E，但必须标注为临时且不得用 localStorage 冒充正式保存。

### 11.3 依赖建议

建议单独批准后引入：

- `elkjs`：MIT/EPL 体系需最终许可证复核；用于 Web Worker 布局；
- `cytoscape` + `cytoscape-fcose`：许可证需最终复核；用于 Relation Graph layout service；
- 轻量空间索引库或自研小型 RBush adapter。

不建议当前直接引入 tldraw/AFFiNE 全栈；它们是架构与交互参考，不是 UI 组件包。

## 12. 实施顺序

### Phase A：先修语义与 Drop

1. Selection 与 membership 解耦；
2. 建立 `dropIntentMachine`；
3. edge-scroll 与 dwell 分层；
4. 删除两个常驻判定框，只保留单一渐进提示；
5. Drop commit 真实写入并可恢复。

### Phase B：建立 Shared Spatial Canvas

1. 抽 camera / transform / pointer session；
2. 抽 NodeLayer / EdgeLayer / OverlayLayer；
3. Arrange 迁移；
4. Context、Workflow 作为 adapter 接入；
5. 确保 sidecar 动态适配。

### Phase C：关系布局服务

1. LayoutService interface + worker；
2. overlap removal / component packing；
3. ELK adapter；
4. fCoSE adapter；
5. edge routing/cache；
6. Ghost Preview / confirm / cancel。

### Phase D：Renderer 同构

1. Outline ↔ Mind Map hierarchy；
2. Relation Graph；
3. Context Strand；
4. Workflow free/arranged；
5. 富内容、Hover Overlay、双击详情。

### Phase E：集中验收

完成大批次后再执行 lint → typecheck → unit → build → smoke → real-browser manual acceptance，不在每个 CSS 小改后重复消耗。

## 13. 真实浏览器硬验收

### Drop / Camera

- 拖节点连续绕画布四边 10 秒，Camera 必须平滑跟随且节点始终在指针下；
- 连续移动进入最外 44px 不得出现 Ghost；
- 稳定停驻达到阈值后才出现唯一 Drop Preview；
- 离开、Esc、pointercancel 均清理 Ghost，原坐标正确；
- Drop 后目标 Capability 可见，刷新与重启后仍在；
- 只 Selection 后切 Context/Workflow，目标不得出现节点或 Ghost。

### 20 节点基线

- `LCOS_VNext3_体验` 的约 20 个对象不得重叠；
- “按关系整理”能形成至少两个可理解对象簇，而不是单列；
- 5 个 Skill、2 条 Workflow、2 份工况备注能在 Workflow Presentation 中表达两条临时链；
- 非焦点线弱化，选中任意节点可清楚读出一度关系；
- 新增第 21 个节点不引发全图跳动。

### Context / Mind Map / Graph

- 15 轮 Conversation 可在 Outline 与 Mind Map 间无损切换；
- hierarchy 编辑在两种 Renderer 中同步；
- Relation Graph 不把所有关系强塞成树；
- 2% 总览、局部聚焦、进入主题和返回均正常；
- 多条 Strand 可并存、移动、剪切、拼接，且不修改 Canonical Relation。

### 性能与可访问性

- 20 节点快速选择 20 次无明显延迟；
- 拖动 10 次无粘住、跳动或 pointer capture 残留；
- reduced motion 下无持续布局动画；
- keyboard focus、Esc 分层退出和输入框快捷键优先级正常；
- 1366×768 sidecar、1440×900、1920×1080 手操通过。

## 14. 停止条件与回滚

遇到以下情况立即停止，不得继续“先做出来再说”：

- 需要让 Selection 自动成为 membership；
- 需要自动覆盖 Canonical Canvas coordinates；
- 需要把 Context/Workflow 固化为一种业务结构；
- 需要把任意 Relation 自动解释成 hierarchy；
- Layout Worker 结果无法取消或过期结果可能覆盖新坐标；
- Drop 失败不能恢复；
- 需要用 Mock/Screenshot 冒充真实 Runtime membership。

回滚单位按 Phase 保持独立。旧 `scopeLayout` 可在 Phase C 完成前作为 feature flag fallback，但不得继续作为默认“按关系整理”。

## 15. UI 执行者交付要求

UI 执行者开始前必须提交：

1. Drop 状态机图；
2. Shared Spatial Canvas 组件图；
3. Presentation 数据流；
4. Layout adapter 选择表；
5. 文件变更清单与依赖许可证；
6. 每 Phase 的回滚点；
7. 基于 `LCOS_VNext3_体验` 的真实浏览器验收录像/截图和命令结果。

不得只交截图、只交 CSS、只交 build passed，或把节点减少到 4 个后宣称完成。

## 16. 参考源

- tldraw infinite canvas SDK: https://github.com/tldraw/tldraw
- xyflow / React Flow: https://github.com/xyflow/xyflow
- React Flow examples: https://reactflow.dev/examples
- elkjs: https://github.com/kieler/elkjs
- ELK algorithms: https://eclipse.dev/elk/reference/algorithms.html
- ELK Layered phases: https://eclipse.dev/elk/blog/posts/2025/25-08-21-layered.html
- fCoSE: https://github.com/iVis-at-Bilkent/cytoscape.js-fcose
- AFFiNE: https://github.com/toeverything/AFFiNE
- Excalidraw: https://github.com/excalidraw/excalidraw
- Obsidian Canvas: https://obsidian.md/help/plugins/canvas
- Obsidian Graph: https://obsidian.md/help/plugins/graph
- 幕布快速编辑： https://mubu.com/help/articles/pc/novice_guide/5f9c4c221e7b40718940a228f1d20974/
- 幕布思维导图转换： https://mubu.com/help/articles/pc/novice_guide/6acfea1c4ec1469a92ce3fc4a53e1313/
