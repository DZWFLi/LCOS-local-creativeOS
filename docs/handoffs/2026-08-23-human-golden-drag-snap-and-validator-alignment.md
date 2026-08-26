# Human Golden 拖动吸附与检查器对齐

日期：2026-08-23

## 实际修复

主画布重构为局部拖动预览后，网格可视状态仍存在，但拖动路径遗漏了“按可见节点主体临近吸附”。本轮恢复该行为：仅当 Grid Snap 开启且可见主体接近点阵时吸附，不把自由画布变成强制紧密排版；多选仍以锚点节点位移保持组内相对位置。

同时修正两个静态检查器：

- 非 Presentation 组件（adapter-only / planned）只要被创建列表严格排除即通过，不要求 catalog 必须存在 planned 占位。
- 48 项开始的视口裁剪已迁入共享 `spatialLod.ts`，检查器改查 canonical 实现。

## 验证

- 拖动 / 空间定向测试：7 / 7 PASS。
- Spatial Component Foundation：22 / 22 PASS。
- Main Canvas Human Golden：14 / 14 PASS。
- Main Canvas Human QA Round 1：15 / 15 PASS。
- Fence + Docs：20 / 20 PASS。
- Desktop doctor：PASS。

## 回滚

回滚会再次让 Grid Snap 只显示点阵而不影响拖动落点，并让检查器错误指向已迁移代码。
