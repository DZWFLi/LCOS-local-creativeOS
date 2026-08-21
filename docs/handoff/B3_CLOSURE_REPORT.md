# B3 Closure Report — A4–B3 Integration Hardening

## Status

**Product / contract closure: PASS**  
**Full dependency-backed verification in this sandbox: BLOCKED by dependency installation timeout**

B3R6 从 A4–B3R5 snapshot 继续，针对真人测试暴露的 Collection、Arrange、Focus/Search、Context、Workflow、Responsive 问题完成 integration hardening。

## Closed product issues

### Collection
- 展开改为 node-size-aware local fan-out，绕开无关障碍。
- Rename 入口与 Rail / Canvas container identity 统一，不再各改半份名称。
- Core reject 后 GUI 回滚 ghost Collection。
- Rail 区分 Scene / Collection 的名称来源和图标语义。
- R5 `MAX_STRUCTURAL_CONTAINER_DEPTH = 2` 继续保持。

### Arrange
- Dense packing Grid 改为 Soft Grid / Tidy：保留 coarse spatial relation，只做吸附、间距和局部避让。
- Freeform 坐标不被 Grid mutation。
- Grid 内原有 drag reorder 保留。
- Region / Fence 入口提升可发现性。

### Focus / Search
- GUI Focus 冻结为单 Entity locator。
- Focus 后 target 继续 selected / highlighted。
- Search 做轻量 keyboard-first 头部，不暴露底层检索模式。

### Context
- Project/Context Graph 使用真实 SpatialCanvas pan / marquee selection。
- 单击 Select，双击 / explicit action 才进入。
- Signal Track 增加“定位选中”和 segment selection feedback。
- Mind Map 把现有 Presentation-level reorder / reparent 能力显式露出，不建立第二 Truth。

### Workflow
- Workflow Graph 作为 overview：可选、可 pan、可 presentation drag、双击进入。
- Workflow Canvas 支持 relation create / select / edit / delete。
- relation metadata 支持 label / condition / dependency 等最小字段并走 Presentation persistence。

### Responsive
- 20–30% 宽度进入 Narrow Collaboration Mode，不再继续压桌面布局。
- 收缩 toolbar/secondary controls，隐藏窄窗不必要 minimap，避免 overlay 冲突。

## Preserved R5 contracts

- Workspace `+` = Empty Scene。
- Selection Semantic Drop → Rail empty → New Scene with frozen payload。
- Cross-Surface Drop = Use Here / stable EntityRef，不 clone / move ownership / recursive import。
- Structural containment depth max 2。
- Scene / Context / Workflow 不形成递归结构树。

## Verification evidence

- A4 static: 13/13
- A5 static: 13/13
- A6 static: 10/10
- B1 static: 11/11
- B3 static: 17/17
- B3R4 static: 10/10
- B3R5 static: 10/10
- B3R6 static: 16/16
- B3 pure executable layout smoke: PASS
  - Soft Grid input immutability
  - local displacement
  - collision avoidance
  - Grid reorder
  - Collection expand obstacle avoidance

## Environment-limited verification

`npm ci` 在当前沙箱两次超时，且 `node_modules` 未生成。因此没有声称以下项目已在本环境通过：

- full Vitest
- Playwright GUI E2E
- workspace semantic typecheck
- lint
- production build

拿回真实开发机后必须复验，失败即重新打开 B3 Closure，不得把本报告当作豁免。
