# Phase 1 P0 测试报告回复

测试报告结论成立。

## 根因

确认遮罩在 `pointerdown` 阶段把空白点击直接解释为取消：面板在拖动手势开始的一刻卸载，Canvas 的 `locked` 随即变为 false，后续 pointer move 继续作用到 Canvas，因此 Camera 和节点坐标发生变化。

这不是 Camera 算法或 memo 失效，而是锁定生命周期被遮罩关闭逻辑提前终止。

## Phase 1.1 修正

- 遮罩不再支持点击空白关闭；
- 遮罩空白手势由 pointer capture 完整吞掉；
- Canvas 锁定时根层 `pointer-events: none`；
- Canvas pointer down、move、up、wheel 均增加 `locked` 硬保护；
- 创建内容面板同步使用相同锁定合同；
- 只有关闭按钮、返回按钮和 Esc 可以解除锁定。

## 未改变

- 居中计算；
- Target / Context 推断；
- 高级设置折叠；
- 点击“开始执行”后才创建 Command / Context Snapshot / Run；
- Phase 2 与 Phase 3 范围。
