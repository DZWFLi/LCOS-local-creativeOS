# LCOS v0.15 · Lovart / Trae / TapNow 交互与动效拆解
## 基于 2026-08-30 三段用户录屏，1s/帧采样 + 连续重复帧过滤

日期：2026-08-30

---

# 0. 采样方式

三段录屏：

1. `2026-08-30 23-42-28.mp4` → Lovart，约 185s
2. `2026-08-30 23-41-39.mp4` → Trae/Agent Chat UI，约 20s
3. `2026-08-30 23-45-41.mp4` → TapNow，约 244s

按用户要求：

- FFmpeg 1 秒抽 1 帧
- 连续画面变化很小的重复帧丢弃
- 不把“停在那里没变化”的时间当交互分析对象
- 重点只看状态切换、UI 出现/消失、对象变化、空间移动、加载、选择、编辑、工具展开

注意：
1s 采样足以判断状态结构、空间因果和 progressive disclosure；
具体 100~200ms easing 时长不能从 1s 采样精确反推，文末的时间 token 属于基于观察后的 LCOS 实现建议，不是视频测量值。

---

# 1. 最重要的总判断

这三套产品的“交互感”不是因为用了很多动画。

真正共同点是：

> **一次交互，只让和这次意图直接相关的那一小层发生变化。**

它们基本都遵守：

```text
Rest
→ Hover
→ Selected
→ Active
→ Edit / Operation
→ Detail
```

每进入一层，只增加一层信息。

不会：

```text
Click
→ 整个对象换物种
→ 弹一张大面板
→ 再出现一排状态字段
→ 再多出一个 modal
```

因此用户始终能回答：

> 我刚才点了谁？
> 它为什么变成这样？
> 新 UI 是从哪里来的？
> 我下一步应该点哪里？

这是“交互感”最核心的东西：

> **Causal Continuity，因果连续性。**

---

# 2. Lovart：最大的价值不是动画，而是“对象始终还是对象”

Lovart 录屏里最值得 LCOS 学的不是白色视觉，而是它对 Canvas Object 的尊重。

---

## 2.1 图片永远先是图片

选中图片：

```text
图片本体
+ 很轻的 selection border
+ 少量 resize / object controls
```

它不会突然变成：

```text
Image Card
+ Header
+ Metadata
+ Footer
+ Runtime State
```

即使进入更复杂的操作，图片仍然是整个交互的视觉中心。

这就是 LCOS 之前一直想要的：

> Artifact content-first。

---

## 2.2 Contextual Toolbar 放在对象外侧，而且非常贴近因果源

Lovart 的图片被选中后，常见动作条会出现在对象下方或附近：

```text
Selected Image
↓
[一排轻量 contextual actions]
```

如果再进入某个操作，比如移动/编辑/生成相关设置：

```text
对象
→ 相邻小 Popover
```

不是：

```text
对象
→ 全屏/大 Modal
```

最关键的是：

> 工具离对象近，但不盖住对象。

这和 LCOS 当前很多 Toolbar / Composer / Dialog 全压到 target 本身上形成了鲜明对比。

---

## 2.3 Loading 不切断空间，它占住原来的位置

Lovart 很典型的一个细节：

加载图片 / 新内容时先出现：

- skeleton
- blur placeholder
- fixed geometry slot

然后真实内容在**同一个位置**填进去。

所以视觉感觉是：

> “这个对象正在长出来。”

不是：

> “系统跳去做了一件事，然后忽然把结果扔回来。”

这就是 motion 的因果感。

---

## 2.4 Gallery Loading 也是先建立结构，再填内容

录屏约 30s 附近：

Masonry / Gallery 首先出现稳定的 skeleton grid。

随后图片逐块进入。

好处：

- 页面布局不跳
- 用户一开始就知道内容会出现在哪里
- loading 本身已经表达最终信息架构

对 LCOS 很有启发：

> Placeholder 应该表达对象未来的空间位置，而不是单独显示一个“加载中”。

---

## 2.5 对象操作是“局部加层”，不是“切换工作模式”

Lovart 即使有复杂操作：

- resize
- move
- generation
- tool popover
- local file import

也没有让整个 Canvas 进入“编辑模式 UI”。

用户仍然留在同一个空间。

---

# 3. Trae：这条最短，但最能解释什么叫“微交互”

Trae 这条录屏其实画面变化很少。

这反而更值得看。

---

## 3.1 默认状态极其安静

正文下面的操作：

- copy / feedback / actions
- suggestion row
- model selector

平时都非常低存在感。

它不为了证明“这里能点”而一直展示所有 affordance。

---

## 3.2 Hover 只改变被 hover 的局部

例如某个 suggestion row：

```text
rest
→ hover
```

变化只是：

- 极轻背景
- 一个箭头 / action
- 必要时出现 tooltip

周围正文不重排。

输入框不变。

其他按钮不亮。

页面不会出现 selection shell。

这就是很重要的：

> **Interaction blast radius 很小。**

一次 hover 的视觉影响半径只覆盖这个 hover target。

---

## 3.3 Tooltip 是解释，不是一个 UI 状态

Tooltip：

```text
trigger 附近
→ 小黑标签
```

用户鼠标离开，它就消失。

不会为了 tooltip 改页面 layout。

不会变成固定 inspector。

这是 LCOS Overlay 需要恢复的尺度感。

---

## 3.4 Model Menu 从 trigger 本身“长出来”

model selector 点击以后：

```text
当前 trigger
↓
compact menu
```

位置、宽度、方向都能直接解释来源。

不会出现：

> “我点了下面一个小按钮，结果屏幕中央出现了一个完全不相关的大框。”

这就是 spatial causality。

---

# 4. TapNow：它最适合解释“空间产品的动效感”

TapNow 是三条里面和 LCOS 最接近的参考。

它最大的价值不是黑色界面，而是：

> **每一层复杂度都有空间归属。**

---

## 4.1 节点被选中，仍然是节点

选中的图片节点：

```text
content
+ very light border
+ object-local toolbar
```

Toolbar 在上方。

调节面板在下方。

对象本身仍然完全可见。

它没有把 node body 改造成“选中状态卡片”。

---

## 4.2 Controls 围着对象长，而不是压在对象身上

例如图片节点做视角/光照等调节：

```text
       toolbar
          ↑
       [image]
          ↓
   settings panel
```

对象始终是中心。

Controls 是 satellite。

这是一个非常重要的视觉层级：

> **Content is the body. Controls are satellites.**

LCOS ObjectOrbit 原本就是这个思想，但当前 generic card / selection strip / overlay 冲突把它破坏了。

---

## 4.3 生成分支先出现“空位置”，然后内容填进去

TapNow 生成 3×3 variation 时特别明显：

```text
source node
↓
connector
↓
3×3 empty result slots
↓
结果逐格出现
```

这一段极其好。

因为在结果出来之前，用户已经知道：

- 产生了几个结果
- 它们和哪个 source 有关系
- 它们将出现在哪里
- 这是一个 branch，不是新的独立世界

这就是我们 LCOS ResultSlot / Proposal / Agent Output 很应该继承的动效逻辑。

---

## 4.4 Connection line 承担了“为什么它在这里”的解释

TapNow zoom 很远以后，很多 node 已经很小。

但连接关系仍然存在。

所以即使看不清细节，也能理解：

```text
这个从这里来
↓
这里又产生了一组东西
```

动效和关系线共同承担 provenance。

---

## 4.5 Zoom Out 时，对象保持“可识别形态”，不是巨大空框 + tiny text

这是对我们 Text Node 特别重要的参考。

TapNow 远缩放：

- 图片退成 thumbnail
- group 保留大体结构
- label 密度降低
- 细节消失
- 视觉 footprint 与内容密度同步变化

不会：

```text
800×500 空矩形
+
9px 一行标题
```

也不会：

```text
selection
→ 突然重新塞满全文
```

它遵循：

> **Geometry LOD + Content LOD 同时变化。**

而我们目前文本只有 Content LOD，没有 Visual Geometry LOD。

---

## 4.6 Side Panel 只用于真正 screen-level 的任务

TapNow 里也会开右侧 Agent panel。

但它和 node-local controls 是两种完全不同的层级：

```text
对象局部操作
→ object-local toolbar / popover

整段 Agent / workspace conversation
→ right-side panel
```

不会所有事情都塞进同一种 Panel。

这和 LCOS 的 Panel Admission Test 是一致的。

---

# 5. 三者共同的 9 条 Motion / Interaction Grammar

---

## 5.1 变化范围小

用户碰哪里，哪里变化。

不是全画布一起响应。

---

## 5.2 UI 有明确来源

Popover 从 trigger 出来。

Toolbar 从 object 出来。

Result 从 source branch 出来。

没有“凭空出现的 UI”。

---

## 5.3 同一对象在状态切换中不换物种

Image 还是 Image。

Node 还是 Node。

Text 还是 Text。

Selection 只加状态，不重构本体。

---

## 5.4 Controls 与 Content 分层

```text
Content = body
Controls = satellites
```

Controls 可以出现 / 消失。

Body 稳定。

---

## 5.5 Progressive Disclosure 很严格

```text
Rest
什么都不打扰

Hover
告诉你这里可以操作

Selected
展示主要 object actions

Active
展示当前任务的 controls

Detail
才打开更多信息
```

LCOS 当前很多地方的问题就是 Rest → Selected 直接跳到 Detail。

---

## 5.6 Loading 是一种空间过渡

不是等待页。

常见语法：

```text
empty slot
→ skeleton
→ blurred / partial
→ real content
```

空间位置不丢。

---

## 5.7 展开时尽量去空白区域

工具面板出现在对象旁边。

不是盖住 content。

这与用户对 LCOS 的新要求完全一致：

> 在节点外面的空白画布展开。

---

## 5.8 Motion 不抢内容的戏

三者的动画都不是“看我动画多高级”。

它主要解决：

- 来源
- 去向
- 状态
- 归属
- 等待
- commit

所以它感觉顺，而不是花。

---

## 5.9 一次最好只有一个 dominant transient UI

即使界面很复杂：

> 用户当前注意的 transient interaction 仍然非常少。

这就是为什么 TapNow 节点上东西很多，却没我们现在 LCOS 那种“Toolbar + Composer + Confirm + Orbit + Inspector 一起抢”的感觉。

---

# 6. 这三段视频其实把 LCOS 已暴露的问题全部串起来了

---

## 6.1 Generic CanvasCard 必须退

参考产品：

对象先是自己。

LCOS 当前：

```text
Generic CanvasCard
→ Species Renderer
```

所以 Glyth / Link / Text 都有隐形矩形幽灵。

应改成：

```text
SpatialEntityFrame
→ Species owns visual geometry
```

---

## 6.2 Selection 不能改变对象物种

参考：

```text
Selected
→ border / halo / local controls
```

LCOS 当前 Text：

```text
selected
→ full content
```

这是错误状态语法。

---

## 6.3 Text 应该像 Lovart/TapNow 的对象一样直接进入 Active / Edit

建议：

```text
Resting Text
→ readable preview

Click
→ Active Reading
→ 仍是同一个节点

Edit
→ same face contentEditable

Double Click / Enter
→ Immersive Detail
```

不要 portal 一个“假装是原节点”的第二个 Editor。

---

## 6.4 Orbit 的方向是对的，当前 lifecycle/geometry 错

TapNow 很典型：

```text
object
+
object-local satellite toolbar
```

LCOS ObjectOrbit 正是该思路。

所以正确做法不是退回 Selection Strip。

而是：

- Orbit 围实际 visual bounds
- click-open 后稳定存在
- outside / Esc / action / selection change 才关闭
- satellite 从 object 周边展开
- 不用巨大 generic card anchor

---

## 6.5 Composer 应该从“大执行配置表”退成 local intent surface

Trae 是最佳参考：

输入是输入。

高级状态不主动出现。

LCOS 应：

```text
Glyth
→ explicit Speak / Compose
→ compact prompt input near free canvas
```

默认只显示：

- receiver
- explicit references（若有）
- prompt
- send

不是：
- 当前选择
- 长期材料
- Runtime
- V1
- connection diagnostics
- advanced

---

## 6.6 ResultSlot 应直接学 TapNow

TapNow：

```text
source
→ branch line
→ empty result slots
→ content fills in
```

LCOS：

```text
Run / Curator / Skill operation
→ ResultSlot / Proposal ghost
→ progressive materialization
→ Keep / Revert
```

这个方向比 toast / loading spinner 强非常多。

---

## 6.7 Overlay Placement 必须是真正空间感知

Lovart / TapNow：

Controls 贴着 target，但避开 content。

LCOS 应建立统一：

`SpatialOverlayPlacement`

并处理：
- target visual bounds
- viewport
- Orbit
- Dock
- Rail
- Minimap
- existing overlay rects

---

## 6.8 LOD 必须同时影响 content 与 geometry

TapNow 远 zoom 的感觉就是最直接的答案。

Text：

```text
far
→ compact page/text identity

mid
→ title + headings / 关键摘要

near
→ readable body

active
→ 增加 detail，但仍受 screen readability约束

edit
→ same face
```

不能只是把 800×500 节点里的正文删掉。

---

## 6.9 Loading / Generation 不允许“消失再回来”

对 AI-native LCOS 尤其重要。

应普遍使用：

```text
intent
→ target / result footprint immediately appears
→ pending visual state
→ progressive fill
→ done
```

让用户知道 Agent 正在哪工作。

---

# 7. 对 LCOS 的 Motion Token 建议
## 注意：以下是根据三个参考的节奏转译成实现建议，不是 1fps 视频实测数值

目标不是统一所有动画，而是建立几档“意义”。

### Micro Feedback
hover / icon / selected border：

`80–120ms`

主要 opacity / color / 1–2px shift。

### Contextual Reveal
Orbit satellite / toolbar / tooltip / small popover：

`120–180ms`

小 scale：

`0.96/0.98 → 1`

+ opacity。

### Local Panel
对象旁的 settings / composer：

`180–240ms`

位置从 anchor 方向小幅移动 6–12px。

### Spatial Reflow / Result Materialization

`220–320ms`

可以使用轻 spring，但 overshoot 极克制。

### Loading Fill

skeleton → content：

`150–220ms crossfade`

不要 resize jump。

### Global Surface Transition

才允许到：

`240–360ms`

Main / Context / Workflow / Assembly 这类。

原则：

> 越局部，越快。
> 越接近用户手指/鼠标，越即时。
> 越宏观，才越允许有空间位移。

---

# 8. 不应该做的“假动效感”

这些不是参考产品好的地方，LCOS 必须避免：

- 所有东西都 spring
- hover 整张 card 浮起来
- selection 大 glow
- 每个 popup 都 blur/glass
- 所有 panel 从屏幕边缘滑入
- 每次 Agent 工作都全屏 loading
- 纯装饰粒子长期运动
- 为了 motion 增加停顿
- 对象状态改变时换 renderer / 换 geometry
- popup 无来源地出现在屏幕中央

真正高级的动效往往是：

> **用户甚至没意识到“它做了动画”，但从来没迷路。**

---

# 9. 这三段参考对当前 GUI Convergence 的直接优先级

## P0-1
修 Production Owner / render storm / Overlay ownership。

没有稳定帧率和唯一 owner，所有 motion 都是装饰尸体。

## P0-2
Text：Geometry LOD + Active Reading + Same-face Edit。

## P0-3
Glyth：真实 visual bounds + 稳定 Orbit。

## P0-4
Selection Strip 退役，动作 object-local 化。

## P0-5
Composer compact / progressive disclosure。

## P0-6
ResultSlot / Proposal progressive materialization。

## P0-7
Assembly 从 SaaS split shell 收成 Spatial Warehouse。

## P0-8
最后才统一 motion tokens / easing / micro transitions。

---

# 10. 最准确的一句话

Lovart、Trae、TapNow 都不是因为“简单，所以显得顺”。

它们真正做到的是：

> **复杂性被切成很多很小、很局部、很有因果关系的瞬间。**

而 LCOS 当前的问题恰恰相反：

> **底层能力很多已经是对的，但一次小动作经常把多层系统状态同时暴露出来。**

所以 LCOS 不需要“更多动画”。

需要的是：

> **减少一次交互的视觉爆炸半径，让状态连续，让 UI 从对象和意图本身长出来。**

这才是这三段参考里真正值得抄的东西。
