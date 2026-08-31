# LCOS v0.15 · Navigation / Pin / Orbit / Receiver / Project Identity 补充收敛表
## 基于 2026-08-31 用户实机截图 + 当前 RC 源码核查

日期：2026-08-31

---

# 0. 总裁决

这批不是新的功能体系，而是把已经存在的：

- ObjectOrbit
- Spatial Marker
- Assembly
- Receiver Handoff
- Project Visual Profile
- Relation controls

真正收成一套直接、可发现、互不打架的空间交互。

核心：

```text
Navigation = 大方向定位
Pin = 用户精确书签 / 快速回到具体对象
Orbit = 对象局部高频动作
Assembly = 一个高频对象动作 + Project-level workspace
```

四者不能互相替代，但必须共用同一空间语法。

---

# 1. Receiver “承接”不应二次确认

## 当前源码事实

`ReceiverSwitcher.tsx` 明确存在：

`ReceiverHandoffConfirmCard`

流程：

```text
点目标 Conversation
→ setConfirmSwitchId
→ 弹 modal/card
→ 再点确认
→ setActiveReceiver + prepareHandoff
```

卡片还展示：

- from → to
- 当前 surface
- selection count
- pending review count
- site mismatch
- “不会自动发送任何消息”

源码自己已经说明：

> 切换只改承接关系并保存现场快照，不会自动发送消息，不会 checkout，不会执行任务。

## 产品裁决

既然用户已经明确点击某一 Conversation 的“承接”，这个动作本身已经表达 Intent。

默认：

```text
Click target conversation
→ 立即成为当前承接
→ row/check state 原位变化
→ panel 自动收口
```

不再第二次确认。

### 只有真正高风险情况才升级

- disconnect 当前 receiver：可确认
- site mismatch：非阻塞 inline hint
- pending review：非阻塞 badge/hint

不应默认 modal。

### 验收

```text
click 承接
→ 1 次点击完成
→ check mark / active state 原位出现
→ no extra card
→ no full backdrop
```

---

# 2. 五个 Orbit 为什么没有“装配”

## 当前源码事实

`ProjectCanvas.tsx` 中 ObjectOrbit 只在：

```ts
node.entityKind === 'conversation'
```

时创建。

而 5 个 action 被硬编码为：

1. 进入现场
2. 在哪
3. 当前承接 / 设为当前
4. 固定到导航
5. status（readOnly）

`ObjectOrbit.MAX_VISIBLE_SATELLITES = 5`

所以：

> 装配不是隐藏了，是根本没有进入 Conversation Orbit action list。

而普通 Artifact / ZIP / Text / Link 等：

> 根本没有通用 ObjectOrbit。

这解释了用户看到 ZIP “只有一个卡片，啥都不能干”。

---

# 3. Orbit 应从 Conversation 特例升级为 Universal Object Orbit

不要为每个 species 再造一套 toolbar。

建议：

```text
ObjectActionResolver(entity, surface, selection, capabilities)
→ 3~5 个最高频 ObjectOrbit actions
```

### 普通 Artifact

候选：

- Open / Preview
- Assembly
- Pin
- Add Reference（或只靠 modifier / pick mode）
- More

### Text

- Read/Edit
- Assembly
- Pin
- Reference
- More

### Link

- Open Live / Preview
- Assembly
- Pin
- Reference
- More

### ZIP/File

- Open / Reveal
- Assembly
- Pin
- Reference
- More

### Conversation

- Speak / Enter
- Assembly（若当前 target/recipe允许）
- Pin
- Set Current
- More

**read-only status 不应该占 5 个稀缺 satellite 之一。**

状态应该长在 Glyth body / signal / HUD。

---

# 4. 普通节点“不能做导航”是 UI wiring gap，不是 Core 缺能力

## 当前事实

Spatial Marker Core/contract 的 targetRef 支持 `view`。

ProjectCanvas 现在唯一显式：

```ts
markerRuntime.createMarker({
  targetRef: { kind: 'view', id: conversationOrbit.nodeId },
  scope: 'cross-surface'
})
```

但这段代码只存在 Conversation Orbit。

因此：

```text
Core 支持任意 view marker
UI 只给 Conversation 暴露 Pin
```

这是典型“能力有、production exposure 没接”。

## 修复

Universal Object Orbit 中所有可定位 Project Object 都应该有：

```text
Pin / Unpin
```

不再 conversation-only。

---

# 5. Navigation + Pin 要像 TapNow 那样互补

用户判断正确：

```text
Navigation
= 大方向 / 地图层

Pin
= 我知道我要找谁，快速跳到具体对象
```

这两个缺一不可。

---

## 5.1 Navigation

负责：

- 当前大区域
- Surface / Workspace
- semantic region
- Minimap
- edge cursor
- cross-surface direction

是“地图”。

---

## 5.2 Pin

负责：

- 用户手工标记具体 Artifact / Glyth / file / result
- 永久或可持久恢复
- 颜色分组
- 快速 jump

是“书签 / 路标”。

---

# 6. TapNow Pin donor 应怎样转成 LCOS

TapNow 的高价值点：

```text
顶部 screen-space 常驻颜色点
hover → 显示组名 / 节点数
click → 小菜单列出同色目标
click item → 跳到精确节点
```

LCOS 可以直接转为：

### Pin HUD

屏幕正上方 / top-center：

```text
●  ●  ●
green blue violet
```

只在存在 Pin 时出现。

### Hover

```text
蓝色 · 4 个
```

### Click

```text
蓝色
○ 脚本 v3
○ 客户 Feedback
○ Hero Image
○ Conversation A
```

选择后：

```text
Spatial Focus / camera travel
→ target
→ arrival beacon
```

不打开 Project Search。

---

# 7. 当前 Marker contract 还缺“颜色 Pin”持久化

当前 `SpatialMarkerIntentV0` 只存：

- id
- projectId
- targetRef
- scope
- sourceSurfaceRef
- createdAt / updatedAt

**没有 color / label / pin group。**

Web 投影层虽然已经有 `groupKey/groupLabel` 的 cluster 能力，但这不是用户 Pin color truth。

所以 TapNow 式 Pin 需要一个小而真实的 contract EXTEND。

建议只加：

```ts
pin?: {
  colorToken: 'green' | 'blue' | 'violet' | 'amber' | 'rose' | ...
  label?: string
}
```

或独立 Presentation profile keyed by markerId。

红线：

- 不存 camera coordinates
- 不复制 target position
- 仍然 resolve targetRef 实时定位
- 颜色只是 durable user wayfinding intent

不要另造第二套 Pin backend。

---

# 8. 当前导航/Marker 太小的源码原因

当前 CSS：

```css
.lcos-spatial-marker {
  min-width: 24px;
  min-height: 24px;
}

.lcos-spatial-marker-glyph {
  width: 16px;
  height: 16px;
}
```

用户实际看到的小图标就是这套尺度。

## 修复建议

screen-space：

```text
visual glyph: 22–24px
hit target: 32–36px
cluster: 34–38px
```

hover/active 再 + 8~12% scale。

Marker / Pin / Orbit control 都应使用统一 HUD screen scale token。

---

# 9. World Body 与 HUD Scale 必须分开

用户之前要求 Glaze 不要随 zoom 缩得看不见，这个方向对。

但不能把 Glaze body 和 HUD control 用同一个“固定像素尺寸”锁死。

正确是：

```text
Object / Glaze body
= world-space size
= 用户可手动 resize
= 有 semantic LOD / minimum readable footprint

Orbit / Pin / Marker / handles
= screen-space HUD size
= zoom-independent
```

也就是说：

> body 可调大小，control 恒定可点。

---

# 10. Project 封面为什么现在是“无区别几何体”

## 当前源码事实

`ProjectGlyphMark.tsx` 明确：

```text
PROJECT_SHAPES =
pebble / leaf / squircle / petal
```

并写了注释：

> Deliberately NOT a Conversation Glyth/Bloub.

Project Drive 强制：

```tsx
<ProjectGlyphMark ... size={76}/>
```

Visual Profile 又允许：

- pebble
- leaf
- capsule
- egg
- squircle
- petal
- paper

所以项目入口长成抽象几何体不是 Bug：

> 是当时刻意做的旧产品决策。

用户现在明确否决它。

---

# 11. Project identity 应改成 Glaze 语言，而不是 generic geometry

不要直接复用“Conversation Glyth”的 receiver/lifecycle semantics。

正确做法：

```text
same Glaze / organic living material engine
+
Project-specific identity species
-
eyes / conversation lifecycle / receiver state
```

例如：

`ProjectGlazeMark`

可以：

- project seed 决定基础轮廓
- profile tint / color
- manual scale
- optional orientation
- 轻微 idle morphology

但它在视觉上属于 LCOS 同一个生态，不再是一组 generic geometric icon。

---

# 12. “Glaze 大小不能调”又是 UI 人为锁死

## Core route

Project Visual Profile 接受：

```text
scale >= 0.25 && <= 4
```

## Web slider

`ProjectVisualProfileControl.tsx` 却限制：

```html
min="0.82"
max="1.16"
```

因此 backend 允许 4x，UI 只让用户微调 16%。

这是明确的 wiring/product exposure gap。

## 修复

至少：

```text
slider 0.6 – 1.8
+
数字输入
```

更符合空间产品的做法：

> 直接在 Project identity 上 drag resize，profile 只做精确微调。

---

# 13. Relation “informs” 和剪刀为什么会重叠

## 当前源码事实

`EdgePath`：

Relation label：

```ts
transform={`translate(${mx} ${my})`}
```

剪刀/cut control：

```ts
cx={mx}
cy={my}
```

两个 UI **精确使用同一个坐标**。

所以用户截图里：

```text
[informs]
   × / scissors
```

互相盖住是必然，不是偶发。

---

# 14. Relation UI 正确布局

关系线本体：

```text
────────────
       ×   ← cut action on path
```

关系 label/editor：

```text
     informs
        ↑
   18–24px normal offset
────────────
       ×
```

也就是：

- cut control 留在 line midpoint
- relation label 沿曲线法线偏移
- hover/select 时才出现
- label click 编辑 relation text
- 不再额外弹一个盖住线的 info card

Relation info 若需要更多内容：

> object-local / edge-local Orbit，放到线外侧空白处。

---

# 15. ZIP / 普通文件为什么“啥也干不了”

当前 ZIP 其实已经被：

`detectFileIdentity()`

识别成：

```text
archive
```

并有：

`ArchiveBundleFallback`

所以文件类型 renderer 并非完全没有。

真正缺的是：

> **普通 Artifact 没有 Universal ObjectOrbit。**

因此用户选中 ZIP 后：

- Generic CanvasCard shell 有
- archive body 有
- object actions 没有

才产生：

> “一个卡片，啥也不能干。”

所以不要专门给 ZIP 做工具栏。

修 Universal Object Orbit 即可一次覆盖：

- ZIP
- PSD
- HTML
- PPT
- PDF
- unknown file
- Link
- Text
- Image

---

# 16. Assembly 目前为什么只在 Project Home/Capture 里能看到

当前 production：

`AppShellView → AssemblyCaptureWorkspace`

是一个 Project-level full workspace。

而 ObjectOrbit action list：

> 没有 Assembly action。

普通 Artifact 又没有 ObjectOrbit。

所以用户没有“从对象现场进入 Assembly”的入口。

这与冻结产品模型冲突：

> Main / Context / Workflow 都应能从当前对象/现场打开同一个 Assembly，只是 target 不同。

---

# 17. Assembly 正确入口语法

任何可装配对象：

```text
Object Orbit
→ Assembly
```

打开：

```text
same Project Assembly workspace
target = 当前对象 / 当前 selection / 当前 surface
```

不是：

> 去 Project Home → Capture → 再找它。

### Orbit slot

建议普通 Artifact 的 3–5 个高频动作中固定保留：

```text
Assembly
```

如果当前对象不支持装配，才不显示。

---

# 18. “承接 / Assembly / Pin / Orbit”共同规则

这批视频和截图共同说明：

> **用户已经点到具体动作，就直接完成或直接进入那个动作。**

不要：

```text
点承接
→ 再弹确认卡
→ 再确认

点 Pin
→ 再弹说明
→ 再选择“确认固定”

点 Assembly
→ 先打开管理器
→ 再选择 Target
```

正确：

```text
承接
→ 立即 active

Pin
→ 立即 pin（默认色）
→ 需要改色再 hover/menu

Assembly
→ 直接进入同一个 Assembly，target 已明确
```

这和 Lovart/TapNow 的交互哲学完全一致：

> 点击动作后只增加下一步真正需要的信息。

---

# 19. 新增施工矩阵

| ID | 问题 | 根因 | GPT可确定修改 | TRAE视觉 | Codex/E2E |
|---|---|---|---|---|---|
| N01 | 承接二次确认 | ReceiverHandoffConfirmCard blocking flow | ✅ | 小量 | ✅ |
| N02 | Orbit 无 Assembly | Conversation actions hardcoded | ✅ contract/action resolver | ✅ | ✅ |
| N03 | 普通 Artifact 无 Orbit | ProjectCanvas conversation-only mount | 架构可定 | ✅ | **✅主改** |
| N04 | 普通节点不能 Pin | createMarker 只 exposed in Conversation Orbit | ✅ | ✅ | ✅ |
| N05 | Pin 无颜色分组 | Marker Intent 无 pin profile | 定 contract | ✅ HUD | **✅Core/E2E** |
| N06 | Pin HUD 缺失 | 当前只有 marker world/edge projections | 定交互 | **✅主视觉** | ✅ |
| N07 | Marker 太小 | 16px glyph / 24px hit | ✅ token | **✅** | screenshot |
| N08 | relation label/cut 重叠 | 两者同 `(mx,my)` | **✅直接** | ✅ | browser E2E |
| N09 | Project cover generic geometry | ProjectGlyphMark hardcoded repertoire | 定新 species | **✅主视觉** | ✅ |
| N10 | Project scale 被 UI 锁死 | Core 0.25–4, UI 0.82–1.16 | **✅直接** | ✅ | gate |
| N11 | ZIP/file 无动作 | no Universal Object Orbit | 架构可定 | ✅ | **✅主改** |
| N12 | Assembly 只能从 Project Home 进 | object/surface entry wiring missing | ✅入口语义 | ✅ | **✅** |

---

# 20. 优先级

## P0
- N01 承接 one-click
- N03 Universal Object Orbit
- N04 any-node Pin
- N08 relation collision
- N12 Assembly object entry

## P0/P1 之间
- N02 Orbit action resolver
- N07 marker visual scale
- N10 manual Project identity scale

## P1
- N05/N06 TapNow-style colored Pin HUD
- N09 ProjectGlazeMark visual convergence
- N11 full File action capability matrix

---

# 21. 最重要的一句

当前 LCOS 不缺“导航系统”。

真正缺的是：

> **把已经存在的 Marker/Core capability 变成每个对象都能使用的 object-local action，并补一个用户能看见、记得住、按颜色快速找回的 Pin HUD。**

Navigation 是地图。

Pin 是书签。

Orbit 是手。

Assembly 是仓库。

它们应该是一套连续空间语言，而不是四个互不认识的功能入口。
