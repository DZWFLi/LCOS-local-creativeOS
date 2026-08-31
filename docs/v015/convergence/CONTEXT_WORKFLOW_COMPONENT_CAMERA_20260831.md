# LCOS v0.15 · Context / Workflow Component 审判与 Camera Focus 收敛

日期：2026-08-31  
基于：当前 RC production source + 用户实机截图

---

# 0. 最终判断

当前 Context / Workflow Component 的主要问题不是“组件功能没做”，而是：

1. SurfaceFrame 仍然是 generic card frame；
2. Component 内容虽然换成 Structure / Evolution / Relationship 等语义，但仍被统一白卡和统一 resize geometry 包住；
3. 最大化默认走 full-screen portal，而不是在同一 Spatial Canvas 中 Focus / Zoom 到组件；
4. resize 使用四条透明 edge hotzone，没有被设计成用户能看懂的交互；
5. 组件 control / maximize 图标尺寸过小；
6. Camera fit 基础设施已经存在，但目前只做 raw bounds fit，没有 reading-oriented framing；
7. Context / Workflow 的 Component morphology 还没有真正“按语义变成条、轨、路径、时间轴、关系场”。

所以这轮应定义为：

> Component Species + Camera Focus Convergence

不是继续给 Card 加 CSS。

---

# 1. SurfaceFrame：注释说没有 Card，CSS 实际仍是 Card

`SurfaceFrame.tsx` 注释：

> No title bar, no card shell

但 `.lcos-surface-component-frame`：

- near-white background
- border
- box-shadow
- border-radius
- fixed width/height
- generic resize edges
- generic controls

这就是所有 Context / Workflow component 都保留旧“白卡范围”的共同根因。

## 裁决

SurfaceFrame 只保留：

- canonical bounds
- pointer/hit layer
- z-index
- move/resize session

视觉：

> transparent / species-owned

Renderer 自己决定 morphology。

---

# 2. Context Component 不应继续是四种大白卡

## Structure

现在：
- 360×240 min card
- card 内缩小 Mind Map
- 再最大化到 portal

正确：
- Rest = 一条结构摘要 / branch strip
- Hover/Selected = 展开更多层级
- Focus/Edit = Camera fit 到结构组件，内容在画布中扩展
- Deep Detail = 只有明确要求才进入 immersive

## Evolution

正确 morphology：

> timeline strip / signal track

默认是一条优雅横向时间轴。

Hover 某个时间点：
- 点变大
- label 出现
- 邻近节点展开

Selection / Focus：
- 时间轴纵向/横向展开到可读范围

不是大矩形里塞几行。

## Relationship

正确 morphology：

> relation field / compact relation strands

Rest：
- 几条主要关系线 / cluster summary

Hover：
- 展开具体 relation labels

Selected：
- 可编辑关系

Focus：
- camera fit 到相关 nodes + relation field

不是表格式左右按钮列表占一张大卡。

## Source

正确 morphology：

> source chain / provenance rail

本来就更应该是 chain，而不是 card。

---

# 3. Workflow Component 也应按物种表达

## Step
compact action object / step pill，不是小卡。

## Active Path
路径本身就是 body。

## Review
checkpoint / review capsule。

## Checkpoint
时间/版本锚点。

## Skill
Skill Artifact 本体，不应该重新包成 Workflow Card。

## Workbench
只有真正存在独立临时工作现场时才出现，不做万能 panel。

---

# 4. 当前 resize 为什么诡异

`SurfaceFrame` 现在四边都是：

- N/S：14px invisible hot zone
- E/W：14px invisible hot zone

用户看不见 affordance，只能“摸边”。

而且所有 component 一律四方向自由 resize。

这是 generic box interaction。

## 新 resize grammar

### Rest
完全隐藏 resize affordance。

### Hover / Selected
根据物种显示：

- Structure：左右宽度条 / 角部最小 handle
- Evolution：主要左右拉长；高度由展开状态决定
- Relationship：可双轴，但 handle 是轻量 segment
- Path：主要沿路径方向伸缩
- Text：宽度为主，高度自动流

handle：
- screen-space
- 10–14px hit
- visual 2–4px segment
- hover 才亮

不是四边永久透明碰撞区。

---

# 5. 双击“阅读”为什么会弹全屏

当前 `SurfaceComponentImmersive.tsx`：

- `createPortal(... document.body)`
- `role=dialog`
- full backdrop
- full immersive viewer

所以你双击/最大化以后看到的大窗口不是偶发。

这就是当前正式实现。

## 裁决

普通 Component：

```text
Double Click / Focus
→ Camera fit 到组件
→ Component 进入 Active Reading/Edit
```

不要离开 Spatial Canvas。

只有：
- 内容极长
- 用户显式 Detail/Open Full
- 真正独立应用/网页

才进入 Immersive。

---

# 6. Camera “刚好把节点框满”并不难，而且现成基础已经有了

当前已经有：

`fitSpatialBounds(...)`

和：

`useSpatialFocusRequest(...)`

后者甚至已经做了：

- Beacon
- camera approach
- 320ms easeOutCubic animation
- arrival state

也就是说：

> 相机平滑飞到对象这件事，本仓已经做了 70–80%。

问题在 framing policy。

---

# 7. 当前 Camera fit 为什么不像 TapNow

现在 `fitSpatialBounds`：

```text
目标 bounds
→ viewport - fixed padding
→ 让整个 bounds 恰好塞进去
→ center
```

缺少：

1. safe insets（HUD / Dock / Rail / Minimap）
2. desired screen occupancy
3. visual bounds vs generic component frame bounds
4. reading mode min/max zoom
5. species-specific aspect policy

所以：
- 一个很横的组件会变得很小
- 一个巨大白 card 会被“完美 fit”到中间，结果依然难看
- Camera 认为任务完成，用户觉得没定位好

---

# 8. 应新增 Reading-oriented Camera Fit

在现有 `fitSpatialBounds` 上封一层：

`fitSpatialTarget(...)`

输入：

- visualBounds
- viewport
- safeInsets
- targetKind
- mode: locate / read / edit / overview

建议：

## locate
对象占 viewport 35–50%

## read
对象占 viewport 65–78%

## edit
对象占 viewport 72–84%，并给 toolbar 留空白边

## overview
多对象 fit 55–70%

Camera target：

> 不是单纯 center，而是 center in safe canvas region。

例如右边有 panel：
对象中心就应稍微偏左。

---

# 9. Component Focus Mode

用户提的 TypeNow 心智正确。

```text
双击 Structure
→ camera smoothly flies
→ Structure 占最舒服阅读尺寸
→ 非目标对象降存在感
→ component active controls 在旁边空白区域出现
```

Exit：

- Esc
- click background
- Back

Camera 可：
- restore previous camera
- 或保留当前，按产品行为决定

这比 Portal Modal 更 spatial。

---

# 10. 控件太小：源码也是实锤

当前：

- Context header icon 28px container，内部 icon 15px
- Maximize button 20×20
- Maximize icon 11px
- Surface generic control 同样属于 tiny control family

对大 Canvas / 高 DPI / zoom interaction 来说过小。

## 统一 screen-space token

建议：

- primary object action: 30–34px visual control
- hit target: 36–40px
- micro secondary: 24–28px
- icon: 15–18px

不要再 11px icon 配 20px button 作为主要 spatial action。

---

# 11. Context / Workflow 编辑语法

统一：

```text
Click
→ Selection + Orbit

Double Click
→ Focus / Active Reading

Orbit → Edit
→ Camera Fit + same-component edit

Ctrl/Cmd+Click
→ Reference

Orbit → Relation
→ relation draw mode

Orbit → Pin
→ Pin

Orbit → Assembly
→ project-level Assembly with target preselected
```

Component 本身不要再发明另一套 toolbar grammar。

---

# 12. Context 组件如何 Reference

一个 Context component 本质是 Presentation Lens。

用户 Ctrl/Cmd+Click component：

- 引用 component 所绑定的 Project Entity refs / lens output
- 不是引用这张 component UI 卡片

如果需要细粒度：
- 进入 Focus
- 点内部具体对象
- Ctrl/Cmd+Click 具体对象

---

# 13. “Context · 8 个对象”的旧卡片/列表表现

这类：
- 横排几张白 tile
- 每张只显示 title + markdown/runtime
- resize 后只剩巨大空白

不应继续作为 Context 的主要表达。

Context 的真实对象应该仍以 Artifact morphology 参与 Spatial Canvas。

Structure / Relationship / Evolution 负责：
- 投影关系
- 阅读顺序
- 演进

不是重新把同一批 Artifact 复制成一排 Context Cards。

---

# 14. 调整优先级

## C-P0-1
SurfaceFrame visual shell 退役。

## C-P0-2
Component Focus Mode + Reading Camera Fit。

## C-P0-3
Structure / Evolution / Relationship morphology 重构。

## C-P0-4
Resize affordance 改成 species-specific screen-space handles。

## C-P0-5
组件 action 接 Universal Orbit。

## C-P0-6
SurfaceComponentImmersive 降级为 explicit Detail，不再默认阅读路径。

## C-P0-7
Workflow component 按 action/path/checkpoint/skill morphology 收敛。

---

# 15. E2E / Visual Matrix

每个 component：

zoom：
- 25
- 35
- 60
- 100
- 150

state：
- Rest
- Hover
- Selected
- Focused
- Editing
- Detail

测试：

1. 远处仍可点击
2. Hover affordance 明确
3. Selection 不突然变大白卡
4. Double click camera fit
5. target 占 viewport 合理比例
6. toolbar 不覆盖内容
7. resize handle screen-space 可点击
8. Ctrl/Cmd+Click 可 Reference
9. Orbit actions一致
10. Esc 正确退出 focus/edit

---

# 16. 最终产品判断

成熟机制不是缺失。

本仓已经有：

- fitSpatialBounds
- smooth focus animation
- Beacon
- Surface bounds
- Spatial Canvas camera

真正缺的是：

> **Reading Framing Policy + Component Species Morphology + Same-canvas Focus Interaction。**

所以这不是技术难题。

是前面施工把“能力做出来”当成了“体验已经成立”。

现在把 owner 和 interaction policy 收准，完全可以做成 TapNow 那种：

> 点一个对象 → 相机恰到好处地靠近 → 控件在旁边展开 → 对象还是对象。

而不是：

> 点一个对象 → 弹一个大白窗 → 里面又出现一个缩得像蚂蚁的版本。
