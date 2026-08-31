# LCOS v0.15 · GUI Production Path / Renderer Owner / Overlay 回归审计
## 基于当前 RC 源码 + 2026-08-30 用户实机截图

日期：2026-08-30  
性质：**前端 Final Convergence P0 审计**  
结论：当前主要问题不是“缺一轮 UI polish”，而是 **新旧 Presentation Owner 半迁移、Web/Core wiring 缺口、Text LOD/Geometry policy 错误、Overlay ownership 未收敛**。

---

# 0. 总结

当前 GUI 回归可分成三类：

## A. 新实现已经存在，但旧 Owner 没退役

典型：
- ObjectOrbit 已存在，但 Selection Strip 源码明确写着 “B-6 Orbit 就绪后整条退役”，实际仍在 production path。
- OverlayStack 已存在，但 InlineNoteEditor / 多数 Dialog 仍绕过它自行 portal。
- `openProject()` 同标签 Project Continuity 路径已存在，但 Project Drive / Assembly 仍硬接旧 `openProjectInNewTab()`。

## B. Core 已有真实能力，Web 未接线

最典型：
- Local Core 已有 `PUT /projects/:id/curation/text`
- `CurationCommandService.updateText()` 已支持 GUI 无 sessionId 的直接 canonical text revision
- 本地测试已经覆盖 user direct edit
- 但 Web `localCoreClient.ts` 没有 text revision method
- App 仍相信旧注释 “text-revision API 未落地”
- 因而双击 Project Text Projection 会弹出“复制并编辑”的过时确认框

这不是视觉问题，是 **backend truth 已前进、frontend workaround 没退休**。

## C. Renderer 已经挂上，但 Presentation Policy 错

最典型：
- Text/Markdown 已经走 `CanvasNodeVisual → DocumentSemanticBody`
- 不是旧 renderer 没挂
- 但 `documentSemanticLevel()` 写死：
  `selected => full`
- 即使 camera zoom 只有 35%，只要选中就渲染全文
- 同时 CanvasCard 继续使用持久化 `node.width / node.height`
- LOD 只改变正文密度，不改变巨大 world box
- 所以得到：
  “巨型空白节点 + 细小文字”
  或
  “选中后突然全文塞进巨大节点”

---

# 1. 截图：项目卡右侧文字竖排溢出

## 用户现象

项目入口卡片右侧出现：

`调整演示项目标记`

被挤成竖排，甚至溢出卡片。

## 精确根因

文件：

`apps/web/src/features/project/ProjectVisualProfileControl.tsx`

当前：

```tsx
trigger={
  <>
    <Palette size={13}/>
    <span className="sr-only">
      调整 {projectLabel} 项目标记
    </span>
  </>
}
```

但当前 CSS 真正定义的是：

```css
.lcos-sr-only { ... visually hidden ... }
```

不是：

```css
.sr-only
```

因此 accessibility 文本根本没隐藏，被渲染进 26px 左右的小按钮，自然一字一行。

## 判定

**100% production wiring bug。**

不是字号问题，不应该给按钮加宽。

## 修复

统一只允许一个 visually-hidden primitive：

- `.lcos-sr-only`
- 或 Base UI / React VisuallyHidden

并做 lint/static gate，禁止未定义 `sr-only` 再出现。

---

# 2. 截图：项目点出去后回不进来 / Project Continuity 被旧 Launcher 语义截断

## 精确根因

`App.tsx` 里同标签打开能力其实已经存在：

```ts
const openProject = useCallback((projectId) => {
  ...
  setProjectOpen(true)
}, ...)
```

它会：
- 保存当前 Project navigation state
- 切 RuntimeBridge
- loadProject
- 恢复 project state
- 进入当前 project

但下方仍保留旧 Phase A：

```ts
// Phase A: Project Home 是 Launcher —— 卡片点击在新标签页打开项目，实例互不干扰。
const openProjectInNewTab = useCallback(...)
```

真正 UI wiring：

```ts
assembly.onOpenProject = openProjectInNewTab
drive.onOpen = openProjectInNewTab
```

## 判定

这是非常典型的：

> **新 Project Continuity path 已存在，旧 Phase-A Launcher owner 仍在主路径。**

## 修复语义

普通 Project click / Assembly double click：

```text
→ openProject(projectId)
→ same-tab continuity
```

“新标签打开”如仍需要：

```text
More / context action
→ explicit Open in New Tab
```

不能继续当默认行为。

## A07 closeout · 2026-08-31

已完成：

```text
ProjectDrive.onOpen       → openProject
Assembly.onOpenProject    → openProject
openProjectInNewTab       → production owner retired
```

Assembly / Capture 中选择真实 Project 后，由同一 `openProject()` 在加载成功时关闭 Assembly shell 并进入 `/projects/:id`；普通打开不会再 `window.open(..., _blank)`。

Browser continuity E2E 已加入 `tests/e2e/project-navigation-continuity.spec.ts`；当前提取 RC 缺依赖，runtime 执行仍记 `BLOCKED_ENV`。

---

# 3. Assembly：不是 renderer 没挂，而是当前生产实现本身仍是旧/半成品 Work Shell

文件：

- `apps/web/src/features/assembly/AssemblyCaptureWorkspace.tsx`
- `AssemblyProjectWarehouse.tsx`
- `AssemblySkillSource.tsx`

当前真实结构：

```text
Assembly
├─ Header
├─ 左侧 aside
│  ├─ 当前目标
│  ├─ 装配到哪里
│  └─ Project button list
└─ 右侧 Source Bay
   ├─ Project
   ├─ Capture
   ├─ Sources
   └─ Skills
```

也就是说用户截图中：

> 左项目管理列表 + 右 SaaS Source Panel

就是当前 production implementation 本身。

仓内没有另一套已经完成、只是没挂上的“最终 Spatial Assembly renderer”。

## 判定

这里不能甩锅给 mount。

Assembly 的：
- service
- source tabs
- capture materialization
- warehouse contract

已经有。

但最终 **Spatial Assembly Presentation** 没真正收完。

## 应恢复的产品形态

Assembly 是项目级共用 Workspace：

```text
进入 Assembly
→ 当前 target 轻量显示
→ 中央是 warehouse spatial field / sources
→ 对象以 Artifact 自己形态存在
→ Drop = 装配到当前 target
```

只有在确实需要 target/source 对照操作时，才进入 contextual split。

不是默认永远左边项目列表、右边库存管理。

---

# 4. Text Renderer：新 renderer 已挂上，真正错误是 LOD + Geometry

生产链：

```text
ProjectCanvas
→ CanvasCard
→ CanvasNodeVisual
→ ContentObject / NoteObject
→ DocumentSemanticBody
```

所以“文本 renderer 没挂上”这一点不成立。

真正的问题有两个。

---

## 4.1 selected 强制 full，不看 zoom

`apps/web/src/features/spatial/documentSemanticZoom.ts`

```ts
export function documentSemanticLevel(input) {
  if (input.selected || input.density === 'expanded') return 'full'

  if (input.zoom !== undefined) {
    if (input.zoom >= .72) return 'full'
    if (input.zoom >= .36) return 'outline'
    return 'title'
  }
}
```

于是：

```text
zoom 35%
unselected → title

同样 zoom 35%
selected → full
```

这就解释了截图中：

- 未选中只剩小字
- 一点选中，状态突然变
- 全文被塞进远处大节点
- 可读性反而更差

Selection 不应该凌驾于 camera readability。

---

## 4.2 LOD 只改内容，不改巨大 world geometry

`CanvasCard` 永远：

```tsx
style={{
  left: node.x,
  top: node.y,
  width: node.width,
  height: node.height,
}}
```

持久化节点曾经多大，远缩放后仍占同样 world rectangle。

虽然内部 `DocumentSemanticBody` 从 full → outline → title，
外框不会跟着收成 compact presentation。

于是：

```text
巨大 world box
+
只有一行 tiny title
```

完全对应用户截图。

---

## 4.3 现有 performance LOD 还主要按 node count，不是 readability

当前性能 proxy 更关心：

```text
画布有多少节点
```

不是：

```text
这个对象当前在屏幕上还能不能读
```

因此只有几个节点时，哪怕 camera 已经缩到 35%，系统依然允许巨大 canonical geometry 参与普通 presentation。

## 正确方向

为文本建立真正的 presentation state：

```text
Resting Compact
Active Reading
Inline Editing
Immersive Detail
```

而不是：

```text
full / outline / title
+
selected 强行 full
```

同时明确：

```text
canonical layout bounds
≠
far-zoom visual bounds
≠
interaction bounds
```

---

# 5. 文本编辑：源码说“就地”，实际上是 portal 覆盖伪装成就地

文件：

`apps/web/src/features/ui/InlineNoteEditor.tsx`

注释：

> 编辑层精确覆盖节点卡片，像在卡片上直接写字。

实现：

```ts
measureNodeRect(node.id)
```

每帧测量节点屏幕矩形，然后：

```tsx
return createPortal(
  <>
    <div className="inline-note-editor-scrim ..."/>
    <form
      className="inline-note-editor in-place"
      style={{
        left: editorLeft,
        top: editorTop,
        width: editorWidth,
        minHeight: rect.height
      }}
    >
      toolbar
      contentEditable
      HUD
    </form>
  </>,
  document.body
)
```

所以：

> **它不是 node body 进入 edit state。**

而是：

> **另外造一个 body portal，覆盖到原 node 上方。**

这解释了用户为什么直觉上觉得：
- 又开了一个编辑界面
- 和节点不是一个东西
- toolbar/body/HUD 堆在一起
- popup 又遮住画布

## 用户提出的正确形态可实现

Visible text：

```text
点击/进入 Active
→ 当前节点本体展开为可读状态

明确 Edit / second activation
→ 同一个 text face 变成 contentEditable
```

超出当前可视范围：

```text
double click / Enter Detail
→ Immersive Viewer/Editor
```

而不是普通编辑就 portal 一张“长得像节点”的第二张脸。

---

# 6. “这是项目实体的投影，复制并编辑” Confirm：最典型的 Web/Core 半迁移

用户截图中的 Confirm 不是现在必须存在的产品行为。

## 前端旧判断

`App.tsx` 双击：

```ts
// text-revision API 未落地...
if (
  bootMode === 'runtime'
  && node.artifactId
  && !originTextIdsRef.current.has(node.id)
) {
  setForkPromptId(id)
  return
}
```

然后显示：

```text
这是项目实体的投影，直接修改会与本体冲突
→ 复制并编辑
```

## 但 Local Core 实际已经前进

已有：

```text
PUT /projects/:id/curation/text
```

`CurationCommandService.updateText(...)`

并且测试已覆盖：

```ts
PUT /curation/text
{ viewId, body: 'user edit' }
```

不带 `sessionId` 的 GUI direct edit 是允许的。

即：

> canonical text revision API 已经真实存在。

问题是：

`apps/web/src/runtime/localCoreClient.ts`

**没有把这条 API 暴露给 Web。**

## 判定

这就是用户怀疑的最典型实例：

> **后端已经做完，Web adapter 没接，新能力没用起来；旧 workaround 继续污染 GUI。**

## 正确修复

新增 Web client：

```ts
updateTextArtifact(...)
→ PUT /projects/:id/curation/text
```

然后编辑保存：

```text
node body edit
→ canonical text revision
→ refresh/hydrate
→ same Project Entity
```

“复制并编辑”应降级成明确的用户操作：

```text
Duplicate / Fork
```

不能是正常编辑的前置障碍。

修完以后，这张老 Confirm 在普通文本编辑链路应直接消失。

---

# 7. Overlay/Popup 打架：确实是结构问题，不是几个 z-index

仓内已经有：

`apps/web/src/features/ui/overlayStack.ts`

设计目标就是：

- 层级
- Esc
- outside click
- portal
- overlay ownership

而实际 registerOverlay 使用范围很有限：
- ProjectStrip More
- ConversationSpace
- ObjectOrbit
- 少数新浮层

同时很多东西仍自行 portal / fixed：

- InlineNoteEditor
- MindMapEditor
- ConfirmDialog
- 多种 Dialog
- Selection Toolbar
- Selection Composer
- Create Menu

更严重的是：

`DialogsHost.tsx`

直接把所有 non-null dialog 平铺一起 render：

```tsx
[
 projectCreate && ...,
 projectTools && ...,
 workbench && ...,
 ...
 noteEdit && ...,
 confirm... && ...,
 ...
]
```

没有 top-layer mutual exclusion。

所以多个状态同时 non-null 时，本来就可以叠。

---

# 8. 用户要求“控制 UI 展开到对象外面的空白画布”，现有 placement 也没做到

Selection Toolbar / Composer 当前位置主要按：

```text
selected bounds
→ top - 40
→ bottom + 12
→ viewport clamp
```

它只知道：

> 不要跑出 viewport。

不知道：

> 不要遮住 target；
> 不要撞另一个 overlay；
> 哪个象限是真正的 blank canvas；
> dock / rail / minimap / orbit 已占哪里。

因此即便每个 UI 单独“定位正确”，一起出现仍然会打架。

## 应建立一个统一 Spatial Overlay Placement

输入：

```text
anchor visual bounds
overlay size
preferred side
viewport
shell chrome insets
occupied overlay rects
```

输出：

```text
nearest free canvas rect outside target
```

规则：

```text
对象本体 editor
→ 特例：inside object

Object Orbit
→ around object

Contextual Toolbar / Popover
→ outside target, nearest free blank canvas

Viewer / true immersive detail
→ dedicated layer / viewer

Destructive global confirm
→ modal only when genuinely necessary
```

---

# 9. Selection Strip：源码自己证明它是该退役的旧 owner

`ProjectCanvas.tsx` 注释原文：

```text
B-5 Selection 轻量化...
B-6 Orbit 就绪后整条退役
（动作进 object-local Orbit）
```

但下面仍然真实 render：

```text
在哪
整理这些
More
```

用户截图最上面的：

`在哪 / 整理这些 / ...`

就是它。

而 `ObjectOrbit.tsx` 已经存在并且接入 overlayStack。

## 判定

这是最清晰的：

> **新替代物已落，旧过渡控件没有执行 retirement。**

Final Convergence 应做真正 retirement，而不是再给 Selection Strip 改一轮视觉。

---

# 10. CanvasCard 仍然拥有过多 species-agnostic 旧行为

所有对象目前先经过统一：

`CanvasCard`

它强制负责：

```text
persisted width / height
semantic drop handle
relation notch
resize handle
provenance badge
system signal
```

然后才 mount：

`CanvasNodeVisual`

这就是为什么：
- Glyth renderer 已经是 Glyth
- Text renderer 已经是 direct reading
- Link renderer可以是 Link

但仍然可能残留“generic node/card”的巨大 bounds / handle / corner / selection feeling。

## 应拆 owner

长期正确结构应是：

```text
SpatialEntityFrame
→ 只负责 canonical position / basic hit identity

VisualSpecies
→ 自己拥有 morphology / visual bounds

InteractionAffordances
→ 按 species capability 开启
   resize?
   relation?
   semantic drop?
   info?

Selection Field
→ 使用 visual bounds
   不直接使用 generic persisted card rectangle
```

不是每个 Project Entity 都先被一张隐形 Card 捕获。

---

# 11. Glyth 巨大透明范围：与 CanvasCard generic geometry 是同一问题

conversation/glyth CSS 已经主动删除很多 generic card border/background。

但 wrapper 仍：

```text
width = node.width
height = node.height
```

generic handle/signal/selection geometry 也仍可能以这块 persisted box 为依据。

所以你之前看到：

```text
小 Glyth
+
巨大“漂亮透明卡片范围”
```

本质不是 Glyth renderer 又做了一张卡。

是：

> **旧 CanvasCard layout owner 没退出。**

---

# 12. Link `.link.md` 被当 TEXT：同一种 identity leakage

这一条之前已审到。

应按：

```text
canonical artifact kind / sourceKind
>
semantic resource identity
>
MIME
>
extension
>
generic fallback
```

不能让 internal persistence `.link.md` 反过来把 Link 变成 Markdown/Text。

它与本轮：
- text projection fork
- project launcher
- selection strip
- generic CanvasCard

属于同一类问题：

> **internal/legacy implementation detail 仍然拥有用户可见 presentation。**

---

# 13. 当前问题矩阵

| 用户现象 | 根因类型 | 是否已有正确能力 |
|---|---|---|
| 项目标记按钮文字竖排 | CSS wiring typo `sr-only` vs `lcos-sr-only` | ✅ |
| 项目出去回不来 | old Phase-A `openProjectInNewTab` still wired | ✅ `openProject()` 已有 |
| Assembly 很像管理页 | 最终 Spatial presentation 未真正完成 | 🟡 backend/shell 有，最终 GUI 没有 |
| 文本远处巨大空框 | LOD 只改内容、不改 geometry | 🟡 renderer 有 |
| 选中文本突然变全文 | `selected => full` | ✅ renderer 有，policy 错 |
| 文本编辑像另开窗口 | portal overlay 假 in-place | 🟡 编辑引擎有，owner 错 |
| 投影文本不能直接改 | Web 没接 Core `PUT curation/text` | ✅ Core 已有 |
| 老 Confirm 很突兀 | 上述旧 workaround 触发 | ✅ 修 wiring 后应消失 |
| Popup 叠在对象上 | 无统一 overlay placement / ownership | 🟡 overlayStack 有但没统一 |
| 在哪/整理这些旧条还在 | transition UI 未 retirement | ✅ ObjectOrbit 已有 |
| Glyth 有巨大透明范围 | generic CanvasCard geometry owner | ✅ Glyth renderer 有 |
| Link 变 `.link.md` TEXT | identity precedence 错 | ✅ Link analyzer/artifact 有 |

---

# 14. 修复顺序：不要再按截图一张张抹 CSS

## P0-A · Production Owner Cleanup

一次只解决 owner，不美化。

1. Project default navigation → `openProject()`
2. `sr-only` typo / accessibility primitive
3. Link identity priority
4. ExecutionItem fail-close fallback — **A06 已收口：所有 runtime action 控件只消费 canonical `availableActions`**
5. 记录/删除 obsolete owner flags

验收：旧 Phase-A / persistence detail 不再决定当前 UX。

---

## P0-B · Canonical Text Editing Wiring

1. Web client 接 `PUT /curation/text`
2. runtime Project Text GUI edit 直接 revision canonical artifact
3. 删除普通编辑的 `forkPromptId`
4. Duplicate/Fork 只作为显式动作
5. restart persistence

这是最高收益的一刀。

---

## P0-C · Text Presentation State 重写

不是重写 Markdown renderer。

保留 `DocumentSemanticBody`。

改 state/policy：

```text
RESTING
ACTIVE_READING
INLINE_EDITING
IMMERSIVE_DETAIL
```

Camera zoom + content size + active state共同决定 presentation。

禁止：

```text
selected => full
```

并解决 visual bounds 与 canonical bounds 分离。

---

## P0-D · 真 In-node Editing

复用当前：
- markdownToHtml
- contentEditable
- readMarkdown
- block editing
- toolbar actions

但 body 进入 `CanvasNodeVisual` 本体。

Toolbar 放对象外侧 blank canvas，可跟随 active node。

只有 overflow/detail 进 Immersive。

---

## P0-E · Overlay Convergence

1. 所有 transient UI 接 `overlayStack`
2. 增加 `SpatialOverlayPlacement`
3. context UI 不覆盖 target
4. one transient top owner
5. Esc/outside统一
6. 退役 Selection Strip，动作进入 ObjectOrbit
7. DialogsHost 做 mutual exclusion / layer policy

---

## P0-F · Species Frame Cleanup

拆解 generic CanvasCard ownership。

至少先特殊处理：
- Glyth
- Text
- Link
- OS-like File Artifact

使 visual selection bounds 与实际对象 morphology 一致。

---

## P0-G · Assembly Presentation Convergence

在 service/warehouse contracts 不动的前提下，替换当前默认 split SaaS shell。

目标：
- Project-level same Assembly
- target 是当前场景/对象，而非巨大左侧项目清单
- source bay 是 spatial warehouse
- material 以真实 Artifact morphology出现
- drag/use = direct semantic assembly
- 需要比较时再 contextual split

---

# 15. 必须新增的 GUI/E2E 防回归矩阵

## Text zoom matrix

至少截图/断言：

```text
zoom: 25 / 35 / 60 / 100 / 150
state:
  resting
  selected
  editing
  immersive
```

检查：
- screen font readable
- no giant blank card
- no overflow
- state switch no visual explosion

## Text editing

```text
open runtime project
→ select text
→ activate edit
→ same node body editable
→ save
→ Core restart
→ same artifact new revision
→ text remains
```

不得出现 fork confirm。

## Project navigation

```text
Project Drive
→ click Project B
→ same tab
→ back Project Home
→ click Project A
→ same tab
```

## Overlay collision

对象靠：
- 左上
- 右上
- 左下
- 右下
- Dock
- Rail
- Minimap

各位置打开：
- Orbit
- Toolbar
- Composer
- Info

断言 overlay rect 不覆盖 target visual rect。

## Species bounds

- Glyth
- Link
- Text
- Image
- File

selection field/hitbox 使用 species visual bounds。

## Accessibility utility

视觉截图中任何 `.sr-only` 内容不得可见。

---

# 16. 最核心的判断

这轮不能再叫：

> “GUI polish”。

它应该叫：

> **Production Path Convergence / Presentation Owner Cleanup**

因为当前最主要的问题是：

```text
新 renderer 有
新 Core 能力有
新 Overlay infrastructure 有
新 navigation path 有
新 Orbit 有
```

但：

```text
旧 owner 没退役
adapter 没接完
generic wrapper 仍控制 geometry
过渡 UI 还在 production
```

这就是为什么开发历史看起来“做了很多”，用户看到的 GUI 却像在往回走。

下一轮应该优先：

> **查 owner → 接真 path → 退旧 path → 再谈视觉。**

否则继续修 CSS，只会把旧 owner 打扮得越来越精致。

---

# 17. 2026-08-31 A08 Closeout Addendum · Canonical Text Edit Owner

A08 已把普通 Runtime Text 编辑从 presentation-local fork workaround 收回 Core canonical revision：

```text
Double-click runtime Text
→ bounded read current canonical body
→ safe editor
→ PUT /projects/:id/curation/text
→ new Artifact current revision
→ hydrate same View / same Artifact identity
```

已退休 production owner：

- `forkPromptId`
- `originTextIdsRef`
- `confirmForkProjection`
- 普通编辑前“复制并编辑” Confirm slot
- runtime `noteBody` 无 revision 约束地覆盖 canonical body 的 session cache 行为

同时发现并修正一个 Core read owner 缺口：`CurationQueryService` 过去始终优先 `view.revisionId`。Primary View 创建时通常带初始 revision，因此第一次 canonical edit 后再次读取同一 primary View 会拿旧 revision。现在冻结为：

```text
primary View
→ Artifact.currentRevisionId first

explicit_additional View
→ pinned view.revisionId first
```

这与 Web runtime projection 的 primary/live 与 explicit/historical 语义保持一致。

A08 只完成 canonical wiring / owner retirement。`InlineNoteEditor` 当前 portal/scrim 形态仍属于 Phase B Text Species / same-face editing 收敛，不在本 patch 冒充完成。

---

# 18. 2026-08-31 A09 Closeout Addendum · Universal ObjectOrbit Coverage

A09 已把普通 Project object 的单对象动作 owner 从 Selection Strip 转移到共享 `ObjectOrbit` 行为壳。

当前 production truth：

```text
Main ordinary object
Context material object
Workflow material object
→ Click single object
→ ProjectObjectOrbit
→ capability-driven Open / Locate / Pin
```

规则：

- `Open` 只在对象确实有 deeper destination 时出现；Collection / Conversation no-op 不伪造 Open。
- `Locate` 只在调用方提供 Project Focus capability 时出现。
- `Pin` 只在 canonical Spatial Marker runtime 存在时出现。
- Relation / Assembly / More 尚未接真实 owner，因此本 patch **隐藏而不是伪造**。
- Main / Context / Workflow 都复用同一 `ProjectObjectOrbit`，不各造动作面板。
- Explicit Composer 出现时 Orbit 让位，保持 one dominant transient UI。
- Shift / multi-selection 不允许留下单对象 Orbit。

Selection Strip 当前只剩：

```text
multi-selection group actions
```

它不再是 single-object default production owner。完全删除仍需下一 micro-patch 先迁移 Align / Distribute / Colony / Copy / Duplicate / Remove 等 group actions，不能先删入口制造能力真空。


---

# 19. 2026-08-31 A10 Closeout Addendum · Selection Group Owner / Strip Final Retirement

A10 完成 A09 留下的最后一段 owner migration：

```text
2+ Selection
→ Selection Field
→ SelectionGroupActions screen-space notch
→ local group menu
```

它明确**不是** `ObjectOrbit`，因为 multi-selection 是 transient interaction state，不是一个 Project Object。

当前 production truth：

- `selection-toolbar / lcos-selection-strip / lcos-selection-more` 已无 production DOM/CSS owner；
- Main multi group actions由 `SelectionGroupActions` 承接；
- Arrange/Reorganize、Colony、Align/Distribute、text group display、Collection、Copy、Duplicate View、Remove View 均保留；
- multi `Focus / 在哪` 已恢复到现有 Project Focus Set owner；
- menu 使用仓库已有 Base UI Menu primitive，由 Base UI 承担 portal / keyboard / focus / outside / item-close / collision，并在 open 期间注册 `overlayStack`；
- menu 采用 frozen 180/260 local swap，通过 Base UI `data-starting-style / data-ending-style` transition lifecycle 收口，不另造 handwritten timer state machine；
- single-object Orbit 保持 A09 owner，不因 A10 回退。

## A09 closeout implementation correction

A09 closeout 曾写“multi strip 仍承载 Focus / 在哪”。当前源码回看证明 A09 后实际 wiring 是：

```text
onFocusSelection only when selectedIds.length === 1
```

因此 multi strip 在 A10 前事实上**没有 Focus**。A10 没有把错误 closeout 当作真实实现，而是以当前 source 为准，并复用已经支持 multi source set 的 Project Focus 恢复该能力。

这条记录用于防止未来 Agent 再把 historical closeout claim 当 implementation truth。

## Still not done

- universal object / Selection right-click；
- Relation Orbit initiation；
- Assembly entry；
- single-object More / Rename / note-layout management；
- Dialog / Overlay top-owner convergence；
- Context / Workflow domain-specific multi group menus。

所以 A10 只能声明：

> **Main residual Selection Strip owner fully retired without a group-capability vacuum.**

不能声明：

> “all three-Surface contextual action parity is complete.”

---

# 20. 2026-08-31 A11 Closeout Addendum · Universal Project Object / Selection Right-click

Before A11:

```text
blank surface
→ SurfaceContextMenu

Main object
→ CanvasCard suppresses contextmenu

Context / Workflow project material
→ no shared management contextmenu

secondary pointerdown
→ Semantic Drop installs contextmenu guard immediately
→ ordinary right-click lost
```

After A11:

```text
[data-node-id] on Main / Context / Workflow
→ CanvasSceneHost shared object contextmenu owner
→ current single/multi Selection resolution
→ capability-driven low-frequency management
```

Available only when real owner exists:

- Open/Enter;
- Project Focus;
- canonical Spatial Marker Pin/Unpin;
- explicit Reference toggle, excluding Conversation receiver identity;
- Main Duplicate View;
- valid Surface Remove Projection.

Retired/wrong owners:

- Main CanvasCard `contextmenu.stopPropagation()`;
- Semantic Drop's immediate secondary-click contextmenu suppression.

A11 preserves:

```text
right-click = management
right-drag > threshold = Semantic Drop
```

and preserves:

```text
remove-projection != delete-project-entity
```

## A09 implementation correction discovered during A11

`ProjectCanvas` declared and consumed `onFocusNode` but omitted it from function destructuring. Since A09 full TypeScript/browser validation was `BLOCKED_ENV`, its static gate did not prove the ordinary-object Focus path compiled/executed. A11 corrects the source and records the historical limitation instead of rewriting A09 as fully runtime-proven.

Still separate debt:

- component/step/edge domain-specific right-click owners;
- Assembly / Relation canonical object-local entries;
- global overlay top-owner convergence.


---

# 21. 2026-08-31 A12 Closeout Addendum · Relation Intent Ownership

Before A12 ordinary Main object Relation was owned by a permanently mounted `CanvasCard` boundary notch whose visibility depended on hover/selection. That owner is superseded by the latest explicit interaction truth.

After A12:

```text
Main ordinary Project object
→ ProjectObjectOrbit Relation capability
→ beginRelationIntent
→ temporary relationSourceId
→ source port only on active object
→ existing pointer-follow / target / edge persistence path
```

Retired ordinary-object owner:

- `relation-notch-<nodeId>`;
- `.canvas-node:hover > .lcos-relation-notch`;
- `.canvas-node.selected > .lcos-relation-notch`;
- old R2-D static requirement that the notch be the primary relation source.

Still active debt, deliberately not hidden:

- Workspace keeps a legacy relation notch until it gets a real object-local relation intent owner;
- Context / Workflow still need shared physical Relation grammar wired to their own canonical persistence semantics;
- Conversation Glyth receives no Relation satellite yet, because receiver mapping/body-drop semantics must not be guessed into ordinary Relation;
- final target receptor hit area remains a later Phase A hit-testing acceptance item.

A12 is therefore **not** Phase A Relation completion. It is a WRONG_OWNER retirement on one production species.


---

# 22. 2026-08-31 A13 closeout addendum · Cross-surface Relation physical owner

A13 isolates Relation's shared **physical** interaction from each Surface's canonical persistence truth.

Production shape:

```text
eligible ordinary Project material
→ ProjectObjectOrbit Relation
→ shared transient source / pointer / receptor adapter
→ Surface-owned persistence callback
```

This explicitly avoids a false universal semantic `connect()`.

Owner split:

```text
Main
physical entry: ProjectObjectOrbit + existing Main session
persistence:    ProjectCanvas CanvasEdge/connect truth

Context
physical entry: shared A13 adapter
persistence:    canonical domain Relation callback with context-canvas provenance

Workflow material
physical entry: shared A13 adapter
persistence:    canonical domain Relation callback with workflow-canvas provenance

Workflow Step/action
physical + truth: existing workflowActionState action-link machinery
                 remains separate
```

The shared adapter contains no `saveRelation`, presentation edge store, workflow action store, bridge access, or relation ontology.

Endpoint admission is capability-driven. Context/Workflow A13 only enables current view-endpoint materials; Conversation, `scope:*`, and `workspace:*` projections fail-close instead of guessing canonical endpoint identity.

Main also stops using generic `[data-node-id]` as a Relation target fallback. Ordinary targets expose explicit `[data-project-relation-target]`; Workspace's legacy relation target remains isolated debt.

Static evidence in the extracted candidate tree:

```text
A13 validator: 12/12 PASS
all runnable v0.15 static validators: 41 PASS / 0 FAIL / 2 S9/S10 external skips
```

Formal source-owner closeout status:

```text
SOURCE / STATIC PASS
MERGE-AUTHORIZED
```

The missing 8/21 v0.3 raw source is now governed by SOP-R1 and recorded as `RAW_SOURCE_LOST / RECONSTRUCTED_AUTHORITY PASS`; it is not a permanent A13 blocker. This addendum still must not be cited as runtime/browser/manual proof, which remains pending in the real local environment.

---

# A14 production-owner update · Workspace Relation source

Fresh census on merged RC `6312ace` confirms that the last explicit legacy Relation launch owner is the Main Workspace frame notch. A14 retires it.

Production shape after A14:

```text
Workspace header activate
→ local ObjectOrbit
→ Relation
→ Orbit yields
→ temporary workspace relation source port
→ existing Main relation session
→ canonical workspace aggregate endpoint
```

Important boundary:
- Workspace remains a recoverable working-set/aggregate endpoint, not an ordinary Project View;
- no new Workspace selection store is created;
- A13 `projectMaterialRelationGesture` remains view-material-only;
- Conversation and Context/Workflow aggregate endpoint semantics remain fail-close;
- Relation-active pointer targeting a Workspace commits before Workspace drag can claim the pointer.

---

# A15 production-owner update · Relation receptive motor tolerance

Post-A14 source census finds no new launch `WRONG_OWNER`. The next proven defect is physical acceptance: target discovery is explicit but body-only, while latest L0 requires an additional 12–18px receptive edge halo.

A15 keeps ownership unchanged and expands only physical hit tolerance:

```text
Relation intent active
→ direct explicit receptor body hit wins
→ otherwise measure screen-space distance to explicit receptor rect
→ <=16px becomes receptive
→ existing target id / canonical persistence commits
```

This is an interaction hit-slop owner, not presentation geometry. Selection bounds, visual morphology, saved layout geometry and endpoint identity do not change.

Context / Workflow Marquee and material Drag yield only while Relation is active so the newly valid halo area can commit rather than being intercepted.

Conversation ordinary Relation and aggregate endpoint semantics remain outside A15.

---

# A16 production-owner update · canonical Relation endpoint identity

Post-A15 source census finds a persistence-owner mismatch rather than another physical gesture gap.

The UI carries **physical node ids**, but canonical Relation endpoints are typed domain identities. Existing Core/runtime source already proves that those identities can be `view`, `note`, `scope`, or `workspace`.

A16 therefore adds one canonical endpoint resolver before the existing `saveRelation` owner:

```text
visible node id
→ current Project projection lookup
→ canonical endpoint type/id
→ existing saveRelation
```

Important cases:

- ordinary ArtifactView → `view`;
- anchored Core Note → `note`;
- Collection/Context/Workflow container with `opensScopeId` → `scope`;
- `scope:*` projection → `scope`;
- `workspace:*` projection → `workspace`;
- Conversation / local-only unresolved shell → fail-close.

The A13 gesture adapter remains persistence-agnostic. A14 Workspace launch remains Main-local. A15 hit halo remains physical-only. Workflow Step/action links remain a separate truth.

This explicitly rejects a generic `connect()` owner and the stale assumption that every visible node id is a View id.
