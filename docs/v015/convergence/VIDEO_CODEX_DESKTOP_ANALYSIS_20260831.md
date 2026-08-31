# LCOS v0.15 · Codex Desktop 局部锚点 / Hover / Persistent Panel 交互拆解
## 基于 `2026-08-31 00-42-12.mp4`，1 秒/帧复核

日期：2026-08-31

---

# 0. 这段最值得 LCOS 学什么

这段不是 Canvas donor，但它非常适合回答：

> 局部信息、局部操作、长期管理，应该怎样分层。

最核心的是：

```text
Content stays content
Local anchor stays local
Hover explanation stays transient
Persistent environment stays persistent
```

没有把四种东西揉成同一张 Card / Modal。

---

# 1. 中央内容始终稳定

录屏中正文/文档内容一直是视觉主体。

局部 interaction 出现时：
- 正文不换 renderer；
- 页面不大幅 reflow；
- 不因为 hover / source anchor 就进入另一个 mode；
- 不弹中央 modal 打断阅读。

原则：

> Content is the body.

LCOS 对 Text / Artifact / Component 都应该保持这一点。

---

# 2. 左侧锚点承担“这里有额外语义”

正文左侧存在很小的 local anchor。

它平时低存在感。

用户 hover：

```text
anchor
→ small local preview bubble
```

新信息明确从 anchor 附近长出来。

这对 LCOS 很重要：

- Source
- Provenance
- Relation summary
- Pin
- Context clue
- Object-local info

都不应该默认占一张大卡。

---

# 3. Hover bubble 只是解释层，不是管理器

Hover 后出现的 bubble：

- 靠近锚点；
- 尺寸有限；
- 不改变正文布局；
- 离开后可消失；
- 只回答“这个锚点是什么”。

它不试图同时承担：
- 编辑；
- Runtime；
- Source manager；
- Context manager；
- Full detail。

原则：

> Tooltip / Preview explains.  
> It does not become the product surface.

---

# 4. Loading 仍然保持局部空间

bubble 内容未准备好时先显示 skeleton。

然后在同一位置换成真实摘要。

没有：
- 全局 loading；
- 页面闪烁；
- 新窗口；
- 位置变化。

这与 Lovart 的 loading grammar一致：

```text
footprint first
→ skeleton
→ content
```

---

# 5. 右侧 Environment / Source 是长期工作面板

录屏右侧：

```text
环境信息
变更
本地
branch
提交/推送
Pull Request

来源
...
```

这是 persistent work context。

它和左侧 hover bubble 完全不是同一层级。

所以：

```text
Local transient information
≠
Persistent workspace management
```

LCOS 应直接继承：

### Object-local
Orbit / small popover / preview bubble。

### Persistent project/session management
Inspector / dedicated side surface，只有真正需要长期停留时存在。

不能所有功能都因为“信息多”就升级成右侧 Panel。

---

# 6. Progressive Disclosure 很克制

状态大致是：

```text
Rest
→ anchor visible

Hover
→ lightweight preview

Need more
→ explicit deeper action
```

没有：

```text
Hover
→ card
→ card 内 toolbar
→ modal
→ second confirmation
```

这与 LCOS 目前很多 legacy UI 恰好相反。

---

# 7. 对 LCOS Source / Provenance 的直接启发

普通对象不需要常驻：

```text
Runtime Source
markdown
current revision
file backing
```

这些应该：

```text
small source/provenance anchor
→ Hover = summary
→ Click / More = detail
```

尤其适合：
- Link source URL
- imported file provenance
- Context Source
- Skill package origin
- Run output provenance

---

# 8. 对 Context Component 的启发

Structure / Evolution / Relationship / Source 的局部解释不应再弹“大组件卡”。

可以：

```text
component body
+
local anchor
→ hover summary
```

然后真正 Focus/Edit：

```text
Camera Focus
→ same-canvas active state
```

Persistent manager 只在真的长期工作时出现。

---

# 9. 对 Overlay 的直接规则

这条视频强化了：

> overlay 必须有来源。

规则：

```text
Anchor-local popup
→ 从 anchor 邻近出现

Object-local control
→ 从 object / Orbit 出现

Persistent side panel
→ 只为 persistent work context

Global modal
→ 只为真正阻断风险
```

不允许 UI 无来源地出现在 viewport 中央。

---

# 10. Motion

这条录屏不是靠花动画。

好的地方是：

- hover feedback快；
- bubble位置稳定；
- skeleton和真实内容同槽位替换；
- persistent panel不跟 transient interaction一起乱动。

因此 LCOS Motion应优先保证：

> spatial causality，而不是视觉表演。

---

# 11. 直接映射到 LCOS

## Source / Provenance
使用 local anchor / preview。

## Node Info
不要大卡，优先 local bubble。

## Relation detail
优先 edge-local anchor / bubble。

## Context clues
局部 hint。

## Persistent Inspector
只用于真正需要持续编辑/监控。

## Text
内容永远保持主体，不被 transient control 替换。

---

# 12. 一句话

Codex Desktop 这条最值得 LCOS 学的是：

> **解释信息贴近来源，操作信息贴近对象，长期管理留给长期面板；三者不要抢同一个 UI 容器。**
