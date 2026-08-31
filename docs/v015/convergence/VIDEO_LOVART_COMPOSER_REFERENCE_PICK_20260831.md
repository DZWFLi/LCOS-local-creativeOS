# LCOS v0.15 · Lovart 画布内 Composer / Reference 交互补充拆解
## 基于 2026-08-31 00-01-00 录屏，1 秒 1 帧采样 + 重复帧过滤

日期：2026-08-31

---

## 0. 这段为什么特别重要

这段不是泛泛的“动效参考”。

它几乎正面回答了 LCOS 当前最容易回退的四个问题：

1. Selection 和 Reference 到底是不是一回事？
2. Prompt Composer 应该长成配置面板还是局部执行表面？
3. 用户怎样从画布上选多个参考材料，而不进入一堆表单？
4. 临时操作模式怎样出现、怎样退出，而不打断整个空间？

Lovart 给出的答案非常克制：

> Selection、Reference Picking、Compose、Run 是连续的四个状态，但不是同一件事。

---

# 1. 状态链

录屏中的核心链可以概括为：

```text
Canvas Rest
→ 选中目标 / 打开局部 Composer
→ Composer 在对象旁出现
→ 点击“选择参考”
→ 进入临时 Reference Pick Mode
→ 用户直接点画布里的图片
→ 每点一个，Composer 顶部参考缩略图立即更新
→ 退出 Pick Mode
→ 在同一个 Composer 内继续编辑 prompt
→ 执行
```

关键是：

> 整个过程中画布没有切换成另一个“配置页面”。

---

# 2. Composer 是局部 Active Surface，不是项目对象本体

Composer 出现在当前任务附近，但不会把选中的 Image 变成一张复杂卡片。

它是一个临时的执行表面：

```text
Canvas Object
        ↓
  [local Composer]
```

Composer 本身可以有白色容器，因为它是一个正在进行的明确任务，而不是 Artifact 的默认 morphology。

这和 LCOS 当前的问题必须区分：

错误：

```text
Artifact 本体
→ 变成大卡片
→ 再塞状态/按钮/metadata
```

正确：

```text
Artifact 仍然是 Artifact
+
需要执行时临时长出 Composer
```

---

# 3. 最关键：Selection ≠ Reference

Lovart 没有使用：

```text
当前选择 4
→ 默认这次都会参考
```

而是：

```text
先打开 Composer
→ 明确进入“图片/视频选择模式”
→ 再从画布点具体对象
→ 它们才进入 reference strip
```

也就是说：

> Reference 是一个显式意图。

这与 LCOS 已冻结的语法一致：

```text
Click
= Selection

Ctrl/Cmd + Click
= prompt Reference
```

或者：

```text
Composer → Add Reference
→ 临时 Reference Pick Mode
→ Click canvas objects
```

但绝不能：

```text
Selection 自动变 Reference
```

---

# 4. Reference Pick Mode 的表达非常轻

进入选择参考后，Lovart 顶部只出现一个很小的状态条：

```text
图片/视频选择模式    退出
```

它告诉用户：

> 现在你的点击语义暂时变了。

但没有：

- 大遮罩
- 向导
- Modal
- 左右栏
- “请选择来源”
- “确认使用范围”

这是一种非常好的 Temporary Interaction Mode。

LCOS 可以直接借用这个结构：

```text
[ 正在选择这次参考 ]  退出
```

或者更轻：

```text
Reference Pick · Esc 退出
```

模式只存在于完成这个动作所需的时间。

---

# 5. 每选一个对象，反馈发生在两个局部

用户点击某个 Canvas Image 时：

### Canvas 上

对象出现轻量选中/参考反馈。

### Composer 里

顶部 reference strip 立刻多一个缩略图。

所以用户马上能看懂：

```text
我点了这个
↓
它现在进入这次 prompt 了
```

这是典型的 Causal Continuity。

没有 toast：

> “添加成功”。

因为空间本身已经表达成功。

---

# 6. Reference Strip 做的是“身份确认”，不是 Material Manager

Composer 顶部的参考材料只显示紧凑 thumbnail。

它没有为每个 Reference 显示：

- 文件路径
- source type
- runtime source
- long-term / short-term
- token count breakdown
- version
- provenance

普通任务里用户只需要知道：

> “我这次带了哪几样东西？”

所以缩略图/图标已经够了。

详细 provenance 必须 progressive disclosure。

---

# 7. Composer 在选参考时保持原位

这是很细但很重要的一点。

进入 Reference Pick Mode 后：

> Composer 没有消失，也没有换成另一个 Panel。

它依然是任务的视觉锚点。

用户在画布选对象，Composer reference strip 持续更新。

所以用户不会忘：

> 我为什么正在选这些东西？

LCOS 当前某些流程的问题恰恰是：

```text
触发动作
→ 原 UI 消失
→ 弹另一个来源选择器
→ 选完以后再回 Composer
```

因果链被切断。

---

# 8. Prompt 编辑也是同一张表面，不换模式壳

后半段可以看到用户直接在 Composer 正文里选中文字、修改。

Composer 没有再打开一个：

```text
Prompt Editor Modal
```

也没有把编辑状态变成完全不同的 layout。

这同样印证：

> Same Face Editing。

对 LCOS 文本节点也是完全相同的道理。

---

# 9. 高级参数被压到底部

Composer 底部只留非常紧凑的：

```text
比例 / 数量
模型
成本/执行
```

这些都是任务真正需要的执行参数。

而且视觉权重明显低于 prompt 和 references。

这正好反衬 LCOS 当前 Expanded Composer 的问题。

LCOS 当前把：

- receiver connection
- current selection
- references
- durable material
- runtime
- advanced
- version

几乎同时放出来。

正确应该是：

```text
一级：
receiver
references
prompt
send

二级：
必要任务参数

三级：
runtime / provenance / advanced
```

---

# 10. 这段对 LCOS Unified Composer 的直接裁决

建议最终状态：

## REST

Glyth / target 自己存在。

无大 Composer。

---

## COMPOSE

用户明确 Speak / Compose：

```text
[receiver identity]
[reference chips/thumbnails if any]

说点什么……

                 Send
```

出现在 target 附近的空白画布。

---

## PICK REFERENCES

用户点击 Add Reference：

```text
顶部/局部：
正在选择参考 · Esc 退出
```

然后：

```text
Click Artifact
→ 添加/移除本次 Reference
```

Composer 保持不动。

Reference strip 实时更新。

---

## ADVANCED

只有显式展开：

- model
- capability
- runtime detail
- long-term context
- provenance

不能默认全部展开。

---

# 11. 这段同时再次证明 Orbit 与 Composer 不应该抢同一个状态

Object-local interaction 可以分层：

```text
Selection
→ Orbit

Orbit: Speak
→ Composer

Composer: Add Reference
→ temporary Reference Pick Mode
```

层级非常清楚。

不应该：

```text
Click Glyth
→ Orbit
+ Composer
+ Selection Toolbar
+ Connection warning
```

一起出现。

一次只能有一个 dominant transient interaction。

---

# 12. 对 LCOS 的推荐 E2E

```text
Click Glyth
→ selected
→ Orbit visible
→ Composer closed

Click Orbit Speak
→ Orbit collapses / yields
→ compact Composer opens outside Glyth

Click Add Reference
→ Reference Pick Mode indicator appears

Click Artifact A
→ A gets reference state
→ Composer strip adds A

Click Artifact B
→ strip adds B

Click A again
→ remove A

Esc
→ exits Reference Pick Mode
→ Composer remains

Edit prompt
→ same Composer surface

Send
→ Composer transitions to Run pending state
→ ResultSlot / execution feedback appears
```

必须断言：

```text
ordinary Selection count
≠
Reference count
```

并且任何一步都不能弹全屏配置 Modal。

---

# 13. 一句话

这段 Lovart 最值得 LCOS 学的不是样式，而是：

> **让一个复杂 AI 操作始终围绕一个稳定的任务锚点展开，用户每做一步，界面只增加下一步真正需要的信息。**

这就是 Progressive Disclosure 真正落到 Canvas-native AI interaction 后的样子。
