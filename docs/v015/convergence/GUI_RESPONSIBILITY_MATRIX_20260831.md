# LCOS v0.15 · GUI 全量同类问题排查与修改责任矩阵
## Production Path / Owner / Renderer / Overlay / Composer / Text / Assembly

日期：2026-08-31  
基于：当前上传 RC 源码静态全仓排查 + 用户实机截图 + Lovart / Trae / TapNow 交互参考

---

# 0. 分工定义

### GPT（当前对话）可直接修
适合：
- product truth 已冻结；
- 根因是确定性的 wiring / stale fallback / dependency / owner；
- 不依赖肉眼反复调布局；
- 可以从源码直接证明正确/错误。

我可以在上传 RC 上直接改代码，输出 patch / zip / closeout。

限制：
- 不能直接写用户 `E:\...` 真仓；
- 当前环境不能可靠运行完整 Windows / Electron / native drag；
- npm 依赖若本环境不存在且网络受限，full test 必须本地补跑。

### TRAE 本地最适合
适合：
- 需要 live browser / HMR / screenshot compare；
- geometry / typography / overlay placement / motion；
- Assembly / Text / Glyth 的最终视觉手感；
- 用户边看边纠偏。

### Codex 本地最适合
适合：
- repo-wide owner cleanup；
- 大规模 API wiring / dead-path retirement；
- lint/static gate；
- browser/desktop E2E；
- CI / release convergence；
- final exhaustive audit。

---

# 1. 本次全仓扫描发现的“系统性证据”

不是推测，当前源码静态事实：

| 类别 | 当前事实 |
|---|---:|
| production `createPortal(...)` 文件 | **9 个**（A10 使用 Base UI `Menu.Portal`，没有新增 literal `createPortal(...)` production owner） |
| 实际使用 `registerOverlay(...)` 的 production 文件 | **4 个**（A10 group menu 已接 overlayStack） |
| `DialogsHost` 可同时 render 的 dialog slot | **18 个** |
| 默认仍 wired 到 `openProjectInNewTab` 的入口 | **A07 已退役：0 个 production 入口** |
| Selection Strip | **A10 已完全退役：0 个 production DOM/CSS owner**；单对象由 Universal ObjectOrbit，Main 多选由 Selection Field `SelectionGroupActions` 承接 |
| ExecutionItem action fallback | **A06 已退役：0 个 status-derived production owner** |
| Text `selected => full` | **1 条明确规则** |
| 普通单击已选节点自动开 Composer | **A04 已退役：Click 只做 Selection** |
| Selection 被合并进 execution references | **A05 已退役**：4 个 production consumer 已拆成 Selection foreground context + explicit Reference |
| projection fork workaround | **A08 已退役**：普通 Runtime Text 直接写 canonical revision；Fork/Duplicate 只保留显式动作 |
| 未限定 `.sr-only` class | **1 处**，且仓库真正定义的是 `.lcos-sr-only` |
| Active Context effect | **A01 已修**：effect 依赖稳定 primitive，不再依赖每 render 新对象 |
| Surface Reach effect | **A01 已修**：callback/ref 与语义依赖拆开 |
| Generic Canvas geometry | `CanvasCard` 仍默认持有 `node.width / node.height` + resize/drop；A12 已退普通节点常驻 Relation notch，只在 explicit Relation intent 时挂 temporary source port；Workspace notch 仍是 legacy debt |

这已经足以证明：

> 当前不是“UI 个别不好看”，而是 Final Convergence 没完成。

---

# 2. P0-A · 我可以直接修的确定性问题

这些不需要 TRAE 重新设计，产品答案已经冻结。

| ID | 问题 | 已确认根因 | GPT可直接修 | 本地必须补验 | 推荐本地Owner | 验收 |
|---|---|---|---|---|---|---|
| A01 | 项目标记按钮文字竖排 | `sr-only` 写错，真实 class 是 `.lcos-sr-only` | **是** | screenshot/a11y | Codex | 隐藏文案不可见，screen reader label 保留 |
| A02 | 默认点 Project 新开标签 / 回不来 | **A07 已完成**：Drive / Assembly 均改走 canonical `openProject()`；旧 `openProjectInNewTab` owner 已退役 | **已修** | Browser E2E 已补，当前依赖环境待跑 | Codex | 普通点击 same-tab continuity；New Tab 不再是默认动作 |
| A03 | Link `.link.md` 被渲染成 TEXT/Markdown | persistence extension 泄漏进 visual identity | **是** | reload E2E | Codex | URL reload 后仍为 Link Artifact |
| A04 | Execution HUD 自己猜 Cancel/Retry/Answer | **A06 已完成**：App / WorkRail / WorkSurface / DeliverSurface 全部 fail-close，仅消费 `ExecutionItemV1.availableActions` | **已修** | Browser/manual 仍因本地依赖缺失待补 | Codex | ExecutionItem 缺失时 actions=[]；Review truth 独立 |
| A05 | 单击已选节点自动开 Composer | **A04 micro-patch 已完成**：普通 Click 无权创建 Composer | **已修** | Browser regression 已补，当前依赖环境待跑 | Codex | Click = Selection only |
| A06 | Selection 自动成为本次 Reference | **A05 已完成**：`explicitExecutionReferenceIds(referenceIds...)` + `mergeExecutionContextIds(selectionIds, referenceIds...)` | **已修** | P0 composer E2E 已补 | Codex | Selection count 与 Reference count 独立 |
| A07 | 普通 Text Projection 编辑前弹“复制并编辑” | **A08 micro-patch 已完成**：Web 接通 Core `PUT /curation/text`，编辑前先读取 current canonical body | **已修** | 双次 revision Browser E2E + Core restart 待依赖环境补跑 | Codex | 正常编辑直接生成 canonical revision |
| A08 | 老 `confirmForkProjection` 留在正常文本路径 | **A08 micro-patch 已完成**：`forkPromptId / confirmForkProjection / originTextIdsRef` production owner 全退役 | **已修** | regression 已补，当前依赖环境待跑 | Codex | Duplicate/Fork 只保留显式动作 |
| A09 | Selection Strip「在哪/整理这些/…」仍活着 | **A10 完成最终 retirement**：A09 先接 Universal ObjectOrbit / 退单对象；A10 将真实 multi group actions 迁至 Selection Field owner 并删除残余 Strip | **已修** | Browser/manual 依赖环境待跑 | Codex + TRAE看视觉 | 不把 multi-selection 塞进 single ObjectOrbit |
| A10 | Orbit mouseleave 300ms 自动消失 | **A02 已完成**：pointerleave timer owner 已删除 | **已修** | real browser pointer E2E 已补，当前依赖环境待跑 | Codex | click-open 后只由 action/outside/Esc/selection change 关闭 |
| A11 | Orbit `anchorRef={{current:...}}` 每 render 新对象 | **A03 已完成**：稳定 anchor ownership + listener 不依赖 caller ref identity | **已修** | browser orbit E2E 待依赖环境补跑 | Codex | listener 不因 parent render 重挂 |
| A12 | Active Context request storm | **A01 已完成**：稳定 primitive dependency | **已修** | request-count E2E 已补，当前依赖环境待跑 | Codex | 静置不重复写 `/active-context` |
| A13 | Surface Reach 重复请求 | **A01 已完成**：effect 不再依赖 whole `surfaceExecution` object | **已修** | request-count E2E 已补，当前依赖环境待跑 | Codex | selection idle 不反复 `conversationReach` |
| A14 | `onReadReach` inline callback 每 render 新函数 | **A01 已完成**：稳定 `useCallback` owner | **已修** | same as A13 | Codex | stable callback |
| A15 | `setSurfaceReachCount` 无 equality guard | **A01 已完成**：相同 count fail-noop | **已修** | render/request guard 已补 | Codex | same value 不触发 state update |
| A16 | stale 注释继续误导开发 | **A08 已清除 Text fork / `text-revision API 未落地` production 注释**；其余 stale 注释继续随 owner cleanup 排查 | **部分已修** | static gate | Codex | authoritative comments 与真实 Core 一致 |

### 当前 micro-patch 状态

截至 A12：A01 Render/Request、A02 Orbit lifecycle、A03 Orbit anchor、A04 Selection/Composer、A05 Selection/Reference、A06 Execution fail-close、A07 Project navigation、A08 Canonical Text Edit、A09 Universal ObjectOrbit Coverage、A10 Selection Group Action Ownership、A11 Universal Right-click、A12 Main Relation Intent Ownership 均已按单命题推进；A12 不代表跨三 Surface Relation 完成。

A08 额外修正了一个此前审计未显式列出的 canonical-read 缺口：Primary ArtifactView 的 curation read 现在跟随 `Artifact.currentRevisionId`，否则第二次编辑会重新读到 primary view 创建时的旧 revision。Explicit additional View 仍可保持历史 revision。

### 建议
后续继续按 micro-patch，不把剩余 P0-A 一 commit 全吞。A10 已将 multi-selection group actions 迁到 Selection Field owner 并彻底删除 Selection Strip；A11 已收普通对象/当前选择的 shared right-click owner；A12 已退休 Main 普通对象的隐蔽 Relation notch 主入口。下一步仍需跨 Surface Relation owner census，不能直接宣布 Relation parity。

---

# 3. P0-B · 我能改代码，但必须由 TRAE 做实时视觉验收的问题

这些不是“我不会”，而是正确性包含肉眼与空间手感，不能只靠源码证明。

| ID | 问题 | 源码现状 | GPT能做 | TRAE必须做 | 验收 |
|---|---|---|---|---|---|
| B01 | Text 选中后突然塞全文 | `documentSemanticLevel`: selected → full | 可改 state policy | **必须在 25/35/60/100/150% zoom 看** | selection 不改变对象物种 |
| B02 | Text 远处巨大空框 + tiny text | content LOD 有，geometry LOD 没有 | 可设计/实现第一版 geometry policy | **必须看屏幕 footprint** | far zoom footprint 同步变 compact |
| B03 | Text inline edit 像另开一个 Editor | `InlineNoteEditor` 是 body portal + scrim | 可改 same-face architecture | **必须实时验证编辑/scroll/selection** | 可见正文直接在 node face 编辑 |
| B04 | 长文何时进入 immersive | 当前普通 edit 与 detail 层混杂 | 可定状态机 | **要调 active/detail threshold** | visible edit，overflow/detail 才 immersive |
| B05 | Glyth 小身体 + 巨大透明矩形 | Generic CanvasCard geometry | 可拆 frame owner | **必须调 actual visual bounds / hit slop** | Selection Field 包 Glyth 本体 |
| B06 | Text/Link/File 都隐约有 generic card feeling | CanvasCard 是 species-agnostic wrapper | 可做 capability split | **需要每物种 visual QA** | body 像自己，不像通用卡片 |
| B07 | Toolbar/Composer/Popover 总压在对象上 | 只有 viewport clamp，没有 free-space placement | 可实现 placement engine | **必须现场看四角/Dock/Rail/Minimap** | contextual UI 去邻近空白 canvas |
| B08 | Overlay motion/出现方向没有因果 | placement 与 transition 未统一 | 可给 motion token/anchor semantics | **必须调动画手感** | UI 看起来从 trigger 长出来 |
| B09 | Link Compact/Rich morphology | 基础 link renderer 有但层级不完整 | 可补结构 | **必须视觉验收** | Compact 无大白卡；Rich 才展开 |
| B10 | OS-like File Artifact | generic fallback 仍有 LCOS 自绘 card 倾向 | 可实现 icon-first | **必须看 Windows/macOS 心智是否自然** | icon + filename 为默认 |
| B11 | ResultSlot loading/materialization | contract 已有，motion 未统一 | 可接 state | **必须调 skeleton/slot transition** | 空位先出现，内容原地填入 |
| B12 | Selection Field / visual bounds | 当前大量逻辑使用 persisted node rect | 可改 geometry API | **必须看多物种** | selection ≠ generic rectangle |

### 这里最适合的工作方式

GPT：
- 先做 architecture patch / state machine / capability split。

TRAE：
- 开真实页面逐对象调；
- 每个状态截图；
- 不自己重新发明产品语义。

---

# 4. P0-C · 必须由本地 TRAE / Codex 主施工的问题

原因不是“我不能看代码”，而是它们涉及大范围 production UI 和真实运行环境，离线 patch 不适合做最终 owner。

| ID | 区域 | 当前真实状态 | 推荐Owner | 为什么必须本地 |
|---|---|---|---|---|
| C01 | Assembly Spatial Presentation | Core/warehouse/source tabs 有；最终 UI 仍是左 Project list + 右 Source Bay | **TRAE 主视觉，Codex 收 contracts/E2E** | 需要持续 HMR + drag + target/source 真实手感 |
| C02 | Overlay 全量 convergence | 9 个 production portal，只有 3 个 registerOverlay 使用者 | **Codex 架构 + TRAE视觉** | 不能机械删除 portal，要逐个分类 |
| C03 | DialogsHost top-owner/mutual exclusion | 18 个 dialog slot 平铺 render | **Codex** | 涉及全局状态 ownership |
| C04 | SpatialOverlayPlacement | 当前没有统一 occupied-rect planner | **TRAE+Codex** | 需要真实 DOM measurement |
| C05 | CanvasCard → Species Frame 大拆分 | generic frame 控制所有 node geometry/affordance | **Codex** | 横跨 selection/drag/resize/relation/minimap/layout |
| C06 | Assembly direct semantic drag/use | 当前 shell 与最终 spatial warehouse 有结构差距 | **TRAE + Codex** | 真实 pointer/drag E2E 必须一起做 |
| C07 | HTML Interactive Preview Host | 目前可 import/search，不能安全运行 | **Codex** | Local Core host + security + Electron/browser |
| C08 | Remote Link Live View | 设计冻结，runtime 未完整落 | **Codex** | CSP/X-Frame/fallback/browser open |
| C09 | Native file icon provider | 产品裁决明确，但 OS-specific API 未统一 | **Codex/Desktop** | Windows/macOS native mapping |
| C10 | Windows native QA | OLE drag/DPI/tray/AOT/Edge extension | **TRAE/人工 + Codex harness** | 我当前环境无法替代真 Windows |
| C11 | Full browser/Desktop E2E | 当前测试分层不完整 | **Codex** | 必须在真 repo/npm/electron 跑 |
| C12 | Release/CI convergence | old Phase2.5 gate 不能代表 v0.15 | **Codex** | repo/CI ownership |

---

# 5. Composer / Reference 是一个独立的 P0 类，不要混进 Text/UI polish

当前源码已经证明它不是“看起来复杂”，而是语义真的回退。

## 已确认的 5 个同类问题

| ID | 当前错误 | 源码证据 | 谁修 |
|---|---|---|---|
| CP01 | 二次点击 Selection 自动开 Composer | **A04 已修**：ordinary Click cannot open Composer | GPT/Codex |
| CP02 | Selection 被 merge 进 execution references | **A05 已修**：ordered References only consume explicit Reference Set | GPT/Codex |
| CP03 | Composer 默认显示“当前选择/长期材料/这次会参考” | `UnifiedExecutionComposer.tsx` | GPT 定语义，TRAE收视觉 |
| CP04 | selected items 即使没有 explicit reference 仍提示“会一起使用” | **A05 已改文案**：Selection = 直接处理对象，不自动记入参考 | GPT/Codex |
| CP05 | Reference Pick Mode 已有 state，但 presentation 仍不够像 Lovart 的临时模式 | `referencePickActive` 已存在 | TRAE |

## 正确链

```text
Click Artifact
→ Selection only

Ctrl/Cmd + Click
→ quick Reference

Glyth / target → Speak
→ compact Composer

Composer → Add Reference
→ temporary Reference Pick Mode
→ click objects
→ reference strip updates
→ Esc leaves pick mode
→ Composer remains
```

### 关键 E2E

```text
Selection count != Reference count
```

必须成为硬断言。

---

# 6. Overlay 类问题，全仓必须逐个归类

当前 production `createPortal()` 文件共有 9 个：

1. `NodeInfoPopover.tsx`
2. `CreateContentDialog.tsx`
3. `OcrImage.tsx`
4. `CommandPalette.tsx`
5. `SurfaceComponentImmersive.tsx`
6. `SurfaceComponentShelf.tsx`
7. `InlineNoteEditor.tsx`
8. `MindMapEditor.tsx`
9. `ObjectOrbit.tsx`

注意：

> 不是所有 Portal 都错。

正确排查应该分类：

### 可以是 Global Portal
- CommandPalette
- true immersive surface
- OCR overlay（如果只是 visual alignment）

### Object-local transient
必须进入 OverlayStack / Spatial Placement：
- NodeInfoPopover
- ObjectOrbit
- contextual composer
- toolbar
- source picker

### 不应再是独立 Portal body
优先改 same-face：
- InlineNoteEditor
- 普通 text edit

### Dialog
可以 Portal，但必须进入 top-owner policy：
- CreateContentDialog
- destructive confirmation
- import dialogs

---

# 7. Legacy / Dead Owner 排查，不是删带“legacy”字样的所有代码

有些 legacy 是 migration compatibility，不能删。

必须区分：

## KEEP · 历史数据兼容
例如：
- legacy spatial region → Colony migration
- old project schema migration
- old presentation state migration

这些是 canonical migration，不是 GUI owner。

## RETIRE · 已有新 owner，旧 UI 仍在 production
目前确认：
- `openProjectInNewTab` 默认 wiring
- fork-before-edit normal path
- status-derived Execution actions
- second-click auto Composer
- selection→reference merge semantics
- stale text-revision UI assumption

## AUDIT · 需要确认是否仍有 runtime consumer
- old `SurfaceComposerBar.tsx`（目前没有真实 JSX consumer，只有说明引用）
- old v0.7 `webPane` capability vocabulary
- v05/v052/v053 CSS 层（当前 App shell 是 `lcos-reconstructed`，不能仅因文件存在就删）
- old prototype storage compatibility

Codex 做 dead-code analysis 后再删，不要关键词式大清洗。

---

# 8. 我建议的实际施工批次

## Batch 1 · GPT 可直接施工：Truth / Wiring Cleanup

我可以直接出 patch：

- A01 sr-only
- A02 same-tab project open
- A03 Link identity precedence
- A04 ExecutionItem fail-close — **DONE by A06 micro-patch**
- A05 Click only selects
- A06 Selection ≠ Reference — **DONE by A05 micro-patch**
- A07/A08 canonical text edit wiring + retire fork confirm
- A10/A11 Orbit lifecycle/ref stability
- A12–A15 render/request storm
- A16 stale comments

### 这批的目标

> 不做美化，只让“正确的东西成为 production owner”。

---

## Batch 2 · Codex 本地：Owner Retirement + E2E

接 Batch 1：

- Selection Strip retirement — **DONE by A10 micro-patch**
- Dialog top-owner
- overlayStack audit
- all production path regression tests
- render/request count tests
- composer semantics tests
- project continuity tests
- link identity restart tests

---

## Batch 3 · TRAE：Text / Glyth / Overlay Visual Convergence

只做：

- text geometry LOD
- same-face editing
- Glyth visual bounds
- object-local Orbit
- free-canvas overlay placement
- typography/readability
- motion causal continuity

每做一类就给截图，不许顺手重构 backend。

---

## Batch 4 · TRAE + Codex：Assembly

TRAE：
- Spatial warehouse/target/interaction presentation。

Codex：
- 保持现有 service truth；
- 接 direct semantic use/drop；
- browser E2E。

---

## Batch 5 · Codex：Universal File/Web Capability + Final E2E

- OS-like File
- Link Rich/Live
- HTML Web Artifact Host
- native open/reveal
- Desktop/native QA
- release gate

---

# 9. 优先级总表

| 优先级 | 内容 | 原因 |
|---|---|---|
| **P0-STOP** | render/update storm | 不先修，所有 UI 行为都不可信 |
| **P0-1** | production owner/wiring cleanup | 大量正确能力目前没成为真路径 |
| **P0-2** | Selection/Reference/Composer semantics | 当前直接违反冻结交互 |
| **P0-3** | canonical text edit | 后端已做，前端仍跑旧 workaround |
| **P0-4** | Orbit stable lifecycle | object-local action layer是后续收敛基础 |
| **P0-5** | Text/Glyth geometry & same-face edit | 当前最影响实际可用性 |
| **P0-6** | Overlay ownership/placement | 否则所有新 UI 继续打架 |
| **P0-7** | Project navigation continuity | Project 核心心智不能断 |
| **P1-1** | Assembly final presentation | shell 有，最终体验没收 |
| **P1-2** | Link/File/HTML universal artifact | 通用能力，价值高但不挡当前 GUI稳定 |
| **P1-3** | motion token / result materialization | 在 owner 稳定后统一 |
| **P1-4** | visual polish | 最后才做 |

---

# 10. “全部查出来”之后仍必须留的动态排查

静态源码能查的是 owner / wiring / contract。

以下必须本地运行时再全量抓：

### Console
- Maximum update depth
- aborted request storm
- unhandled promise
- hydration mismatch
- ResizeObserver loop

### Network
按 10 秒 idle window 统计：
- `/active-context`
- `/attention/runtime`
- `/conversation-reach`
- `/execution-items`
- `/events`

正常 idle 不应持续重复写。

### DOM
每次 selection 后统计：
- visible dialogs
- visible portal overlays
- visible transient toolbars
- composer count
- orbit count

原则：

> 一次普通 Selection 不应制造多于一个 dominant transient layer。

### Geometry
每个 species：
- visual rect
- hit rect
- selection rect
- persisted layout rect

必须能区分。

### Screenshots
矩阵：
- zoom 25/35/60/100/150
- rest/hover/selected/compose/edit/detail
- canvas 四角
- Rail/Dock/Minimap 邻近
- Main/Context/Workflow/Assembly

---

# 11. 最终责任判定

## 可以直接交给 GPT 修完再让本地合入
- 确定性 production wiring
- stale workaround
- semantic ownership
- effect dependency loop
- fail-close
- selection/reference semantics
- Orbit close policy
- Core/Web API seam

## 必须让 TRAE 修/验
- typography
- text footprint
- geometry LOD
- same-face editing视觉
- overlay blank-space placement
- motion/easing
- Assembly最终空间手感
- Glyth/Artifact visual morphology

## 必须让 Codex 修/验
- repo-wide owner retirement
- CanvasCard species frame split
- Dialog/Overlay global state architecture
- HTML host / Desktop integration
- full browser/Desktop E2E
- CI/release gates
- native/runtime exhaustive regression

---

# 12. 一句话施工纪律

> **GPT 先把“谁是真 owner、哪条是真 path”收干净；TRAE 再把真实对象和交互做顺；Codex 最后做全仓 retirement、E2E 和 release convergence。**

反过来做，会继续出现：

> 新东西做了 → 旧壳还活着 → TRAE 修旧壳 → Codex 又补新 path → GUI 再次分叉。

这正是当前必须停止的循环。

---

# 13. A11 owner update · Right-click / Semantic Drop

| Domain | Canonical owner after A11 | Retired / forbidden owner | Status |
|---|---|---|---|
| Ordinary Project Object right-click | `CanvasSceneHost` + `SurfaceContextMenu` capability projection | per-Surface bespoke object menus / node contextmenu suppression | SOURCE/STATIC PASS |
| Multi Project Object Selection right-click | same shared `CanvasSceneHost` owner over current Selection | fake Selection Entity / MultiObjectOrbit | SOURCE/STATIC PASS |
| Blank surface right-click | existing `SurfaceContextMenu` blank actions | object menu pretending to be blank menu | KEEP |
| Single object high-frequency actions | `ProjectObjectOrbit` / `ObjectOrbit` | moving all management into Orbit | KEEP |
| Explicit Reference | `SharedComposerCommandState.referenceIds` | Selection auto-reference / Conversation receiver as ordinary ref | KEEP |
| Pin | canonical Spatial Marker provider | local Pin store | KEEP |
| Context/Workflow remove projection | exact Presentation member/entity-ref removal | Project Entity delete | SOURCE/STATIC PASS |
| Secondary click | right-click management candidate | immediate Semantic Drop contextmenu guard | RETIRED |
| Secondary drag >4px | Semantic Drop | normal management context menu after drag | KEEP |

Scope note:

> Workflow Step / Surface Component / relation-edge domain menus are not declared complete by A11.

A09 historical source correction: `onFocusNode` was missing from `ProjectCanvas` destructuring until A11. Do not cite A09 source/static PASS as runtime/type proof.


---

# 14. A12 owner update · Relation initiation

| Domain | Canonical owner after A12 | Retired / forbidden owner | Status |
|---|---|---|---|
| Main ordinary Project-object relation intent | `ProjectObjectOrbit` optional Relation capability → `ProjectCanvas.beginRelationIntent` | permanent/hover ordinary `CanvasCard` relation notch | SOURCE/STATIC PASS |
| Main relation persistence | existing `ProjectCanvas` edge/connect path | second Relation store | KEEP |
| Main source presentation | temporary `relation-source-port-*` only while intent active | rest/hover/selection relation chrome | SOURCE/STATIC PASS |
| Main blank create-and-connect | existing `anchor-create-menu` after explicit Relation intent | removing useful empty-space path | KEEP |
| Workspace relation source | legacy Workspace notch | claiming it is already migrated | OPEN DEBT |
| Context physical Relation gesture | unresolved shared adapter over Context canonical truth | pretending Main `connect()` is universal semantic truth | IMPLEMENTATION_GAP |
| Workflow physical Relation gesture | unresolved shared adapter over Workflow action/material/domain truth | flattening Workflow relation semantics into Main edges | IMPLEMENTATION_GAP |
| Conversation Glyth Relation | fail-close / no Relation satellite yet | guessing receiver binding/body-drop mapping is ordinary Relation | SEMANTIC OWNER UNPROVEN |

A12 updates the stale R2-D Light-Notch gate because that assertion represented a superseded implementation owner, not current product truth. Historical R2-D evidence remains history-only provenance.
