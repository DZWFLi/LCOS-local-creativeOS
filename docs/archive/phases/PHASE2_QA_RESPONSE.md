# v0.6 Phase 2 浏览器报告回复

## 结论

报告中的 1 个 P0 与 3 个 P1 均成立。本轮不推翻 Phase 2，只发布 Phase 2.1 热修。

## P0：Ctrl/Cmd+Enter 跳过确认

### 根因

Composer 的快捷键在 React 事件中打开确认框；确认框又监听全局 `keydown` 执行。浏览器事件传播与同步更新组合下，同一个物理按键可能同时完成“打开”和“确认”。

### 修正

- Composer 快捷键停止继续传播；
- 打开确认框延迟到下一帧，确保当前原生事件已经结束；
- 确认框键盘执行增加 180ms armed guard，并忽略 repeat；
- 点击发送仍进入同一 `requestRun()`，所有入口共用确认合同。

## P1：C 与继续修改没有聚焦 Composer

### 根因

旧实现使用固定 80ms `setTimeout`，依赖 Work Rail 展开和 DOM 提交时序。浏览器、布局与状态批处理稍有变化，焦点请求便会落空。

### 修正

- 新增 `composerFocusRequest` 渲染同步信号；
- Work Rail 在完成展开后的两个 animation frame 内执行 focus；
- 使用 `preventScroll`，并将光标放到文本末尾；
- 顶部“告诉 AI”、Compact Rail、快捷键 C、Continue Modify 共用同一请求函数。

## P1：Accept 后新 Run 未紧凑化

### 根因

旧实现依赖 `activeRun.status` 的后续 effect 压缩 Process Node，和 Accept 内的节点、边、Run 多次更新存在时序竞争。

### 修正

Accept 改为一个 `setGraph` 原子事务，同时完成：

- 返回 Artifact 晋升 Working / Current；
- 原 Target 归档；
- 跟随 Current 的 View 更新 Revision；
- 当前 Run Process 直接变为 `completed + compact`；
- Run 输出关系停止流动。

不再依赖下一次 effect 才收起 Process Node。

## 保留项

Phase 1.1 的遮罩 Pointer Capture、Canvas Pointer/Wheel 硬锁、RAF 取消和输入稳定性均未改回。
