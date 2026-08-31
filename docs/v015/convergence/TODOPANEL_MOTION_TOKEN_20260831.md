# LCOS v0.15 · Todo Panel Code Donor Motion Token
## OpenCodeUI Todo Swap 源码参数 → LCOS 动效映射

日期：2026-08-31  
Donor：`lehhair/OpenCodeUI`  
性质：**CODE DONOR / CRAFT ONLY，不继承其产品 taxonomy**

---

# 0. 识别结果

GitHub 上存在大量名为 TodoPanel / todo-panel 的项目。

目前找到一个与用户描述“Todo Panel 动效值得直接复刻”高度吻合、且可以追到**明确动效修复 commit**的现代候选：

`lehhair/OpenCodeUI`

关键 commit：

```text
fix: animate todo panel swap without layout jank
```

后续 commit：

```text
fix: hide floating actions (undo/redo/permission) during todo panel swap
```

当前 main 中：
`TODO_SWAP_DURATION_MS = 260`
仍然保留。

---

# 1. Exact Source Parameters

## Swap lifecycle

```text
closed
→ opening
→ requestAnimationFrame
→ open

open
→ closing
→ 260ms
→ closed / unmount
```

核心：

```text
TODO_SWAP_DURATION_MS = 260
```

---

## Transform origin

```text
center bottom
```

适用于：
- old surface
- new Todo panel
- floating actions

---

## Old input surface exit

```text
opacity:
180ms cubic-bezier(0.4, 0, 0.2, 1)

transform:
260ms cubic-bezier(0.22, 1, 0.36, 1)

end transform:
translateY(18px) scale(0.985)

end opacity:
0
```

---

## New Todo panel entry

Initial：

```text
opacity: 0
translateY(18px)
scale(0.985)
```

Open：

```text
opacity: 1
translateY(0)
scale(1)
```

Transition：

```text
opacity:
180ms cubic-bezier(0.22, 1, 0.36, 1)

transform:
260ms cubic-bezier(0.22, 1, 0.36, 1)
```

---

## Floating actions

后续 patch 将 Floating Actions 同步到同一退出：

```text
opacity: 0
translateY(18px)
scale(0.985)
pointer-events: none
```

使用相同：
- 180ms opacity
- 260ms transform

原因：

> 一个 dominant transient surface 打开时，周边竞争性 actions 应一起让位。

这与 LCOS “one dominant transient UI at a time” 完全一致。

---

## Reduced motion

```text
prefers-reduced-motion: reduce
→ transition: none
```

必须保留。

---

# 2. 为什么这套感觉顺

它不是 spring。

关键是四件事：

1. **短距离**
   - 18px

2. **极轻 scale**
   - 0.985 → 1
   - 只有 1.5%

3. **opacity 比 transform 更快**
   - 180ms vs 260ms

4. **旧层退场与新层进场共享空间来源**
   - 都从 center-bottom
   - 不做 viewport 中央凭空 modal

结果：

> 有重量，但没有“蹦”。

---

# 3. LCOS Frozen Motion Tokens

建议直接冻结：

```text
--motion-swap-transform: 260ms
--motion-swap-opacity: 180ms

--ease-swap-out:
cubic-bezier(0.4, 0, 0.2, 1)

--ease-swap-in:
cubic-bezier(0.22, 1, 0.36, 1)

--motion-swap-y: 18px
--motion-swap-scale: 0.985

--motion-origin-local-bottom: center bottom
```

命名实现层可以按 TS token object。

---

# 4. LCOS 应直接应用在哪

## Orbit → Composer

```text
Orbit yields
Composer enters
```

使用同一 Swap grammar。

但空间方向不是永远 bottom：

> transform-origin 应改为真实 anchor 方向。

参数：
- 180/260
- 18px equivalent
- 0.985
保持。

---

## Object → Local Popover / Right-click

Popover：

```text
opacity 180
transform 260
scale .985 → 1
```

位移按 anchor normal：
- 8–18px

---

## Component Focus controls

普通 controls 退场：
- 180 / 260
- 0.985

Focus toolbar 入场同 token。

---

## Pin HUD group popover

使用：
- opacity 180ms
- transform 260ms
- ease-in curve `.22,1,.36,1`
- scale `.985 → 1`

位移建议：
- 10–14px
因为 HUD 更小。

---

## Reference Pick

Composer 保持。

进入 Pick Mode 时：
- 非相关 controls 以 swap-exit 让位；
- pick indicators 以 swap-entry 出现。

不要让整个 Composer消失。

---

## Relation Mode

Orbit：
- swap-exit

source port / receptive field：
- swap-entry

关系 line 本体：
- pointer direct-follow，不使用 260ms latency。

Drop settle：
- 140–220ms 独立 token。

---

# 5. 不要机械复制 18px 到所有场景

复制的是**节奏比例**：

```text
small travel
+
1.5% scale
+
opacity faster than transform
+
same anchor
+
deferred unmount
```

大对象：
- 14–18px

小 HUD：
- 8–12px

Camera：
- 不用 18px，使用 spatial distance + 240–340ms framing。

---

# 6. Deferred Unmount 是硬规则

Overlay / Orbit / Popover / Composer 切换：

错误：

```text
state=false
→ DOM instantly gone
```

正确：

```text
closing
→ visual exit
→ duration ends
→ unmount
```

如果新层要替换旧层：

```text
mount new hidden
→ next rAF activate
```

避免 first-frame animation 被浏览器合并。

---

# 7. Dominant Surface Rule

Todo Panel 后续 commit 很有价值：

> Panel 打开时 Floating Actions 也同步隐藏。

LCOS 映射：

### Composer active
不再同时展示：
- Orbit
- Selection Strip
- competing object toolbar

### Relation active
不再展示：
- Orbit
- resize controls
- unrelated info popover

### Component Focus
不同时叠：
- generic maximize
- old modal controls
- competing shelf popup

---

# 8. LCOS 与 donor 的差异

不复制：

- OpenCodeUI Todo taxonomy
- InputFooter IA
- Todo card shape
- chat product structure

只复制：

- exact duration
- easing
- scale
- short translation
- state machine
- deferred unmount
- same-origin swap
- floating-action yielding

---

# 9. 与已有 LCOS Motion Grammar 合并

此前 LCOS 建议：

```text
micro feedback: 80–120
contextual reveal: 120–180
local panel: 180–240
spatial reflow: 220–320
```

Todo donor 给了一个可直接落地的中间锚点：

```text
opacity: 180
transform: 260
```

因此 Phase D 不再继续凭感觉调一堆：
- 150
- 200
- 240
- 280

局部 surface swap 默认统一用：

> **180 / 260**

除非有明确视觉证据需要偏离。

---

# 10. Acceptance

至少检查：

- 旧层不闪退；
- 新层不 first-frame jump；
- 不产生 layout shift；
- 非相关 controls 同步让位；
- pointer-events 与视觉状态一致；
- closing 中重复点击不会产生双 panel；
- rapid open-close 不遗留 timer；
- prefers-reduced-motion 正常；
- 60fps 下无大 layout thrash。

---

# 11. 最终句

这套 donor 最值得搬的不是“260ms”。

而是：

> **用户感觉一个局部界面被另一个局部界面自然接替，而不是 React 把一个 div 删除再插了另一个 div。**

LCOS 后续局部 transient surface 默认使用这套 grammar。
