# LCOS GUI 设计 / 动效 / 交互执行参考

> 用途：后续一波 GUI 调整的统一执行基准。改 UI 前先读本文件 + `AGENTS.md` 冻结交互规则。
> 状态：2026-08-12 冻结当前实现语义；样式三套收敛按 Dz 意见继续暂缓，不另起 CSS 体系。

## 0. 一页结论

LCOS 是「精密创作设备」：软瓷白结构、克制的分类环境色、少量液态铬交互件；画布极简、信息全部居后；
交互直觉优先、单步可达；Agent 能做的事不塞进 GUI。节点动效与信息密度随缩放降级，不做任何测试窗口式堆叠。

## 1. 视觉与动效质感（当前实现基准）

### 1.1 实际样式底座（改样式先找这里）

- `apps/web/src/vnext.css` —— vnext 设计语言：`--vnext-ground #f2f1f8`、`--vnext-surface`、`--vnext-ink`、
  `--vnext-hair`、强调色 `--vnext-purple #8b5cf6 / --vnext-blue #3b82f6 / --vnext-cyan #22d3ee`、`--vnext-shadow`。
- `apps/web/src/reconstruction.css` —— `.lcos-reconstructed` 重构层：drop ghost、workspace frame、dock 等。
- `apps/web/src/product-interface.css` —— `.vnext-drop-shelf` 投送面板等。
- 新调整默认在既有文件上增量改；不新建平行 CSS 体系。

### 1.2 材质与层级原则（源自 CREATIVE_OS_MATERIAL_VISUAL_SYSTEM）

- 层级靠材质、凹凸、留白和光泽，颜色只表达语义；文字用深蓝灰，不用纯黑。
- 圆角大但克制（8–24px 区间，不搞幼儿园胖卡片）。
- 液态铬金属只用于：新建 Workspace `+`、Run/Send 主按钮、激活节点小角标、Dock 激活控制、Inspector 主确认。
  禁止整圈金属节点、霓虹脉冲、水波动效。
- 节点正面不常驻页数/条数/时间/路径/关系数；空字段不显示，Developer 信息默认折叠。

### 1.3 节点分类色（语义色，不是装饰）

| 类型 | 主色 | 浅底 | 辉光 |
| --- | --- | --- | --- |
| Source / Original | `#698FC8` | `#EDF3FA` | `rgba(105,143,200,.18)` |
| AI Generated / Derived | `#7342E2` | `#F0EBFC` | `rgba(115,66,226,.20)` |
| Context / Reference | `#4F9B96` | `#EAF4F2` | `rgba(79,155,150,.17)` |
| Process / Run | `#77818B` | `#EEF0F1` | `rgba(119,129,139,.12)` |
| Decision / Locked | `#B7833E` | `#FAF1E5` | `rgba(183,131,62,.17)` |
| Waiting Input | `#C76D58` | `#F9ECE8` | 克制 |

平台差异用图标表达，不为平台发明新色。Context 不用 AI 紫；Process 永远比文件节点低调；Decision 不用警告黄。

### 1.4 动效手感（已落地参数）

- Hover：轻量 `transform: scale(1.035~1.045)` + 背景微变；不整颗发光。
- Active：左侧 2px 渐变指示条（紫→蓝→青），浅表面 + 轻投影。
- Drop 渐进提示：`DROP_DWELL_MS = 520`，进度 60% 后才显出「投送」文案；边缘 cue 极淡方向光，
  不得同时画左框、底框和厚面板。
- Drop Ghost：`position: fixed` 跟手卡片（白底 + blur + 轻投影 + 紫色栈/计数），真实节点不动。
- 流动边最多 2 条；Zoom out 停止复杂边动画；相机移动时暂停复杂动画。

## 2. 交互基本逻辑（冻结 + 2026-08-12 更新）

### 2.1 全局冻结规则（AGENTS.md §7，不得擅自改）

- `C` 创建 Command；Command 内 `Cmd/Ctrl+Enter` 执行 Run。
- 双击打开一度关系；Enter 打开/收起；单击详情为屏幕坐标 Overlay（Portal，不进 React Flow/ELK 布局）。
- Inspector 单实例、默认关闭、局部导航栈；Esc 逐级退出。
- Artifact Return：Target → Working → Run → Pending Return Zone。
- 重复拖入定位已有 View；额外引用必须显式创建。

### 2.2 Esc 逐级退出栈（当前实现顺序）

删除确认 → 工作区确认 → 投送面板(stagedTransfer) → 沉浸预览 → Workbench → 能力面板 →
节点信息 → 布局预览 → 清空选择。新增弹层必须插入这个栈，不允许跳过。

### 2.3 画布手势（2026-08-12 定稿）

- **左键拖节点**：真实节点移动（拖动阈值 4px；拖完写坐标，Presentation commit）。
- **空格/中键拖画布**：相机平移，与节点拖完全分离。
- **右键按住拖 = 投送（新）**：
  1. 右键按下节点 → 选中（多选时右键任意成员 = 整个选择）→ 出现跟手虚影，真实节点不动；
  2. 按住右键拖动 → 虚影跟手，**摄像机锁死**（不做边缘自动平移）；
  3. 拖到左/底边缘停住 520ms → 弹出投送面板（复用 dwell/ghost/DropShelf 单一状态机）；
  4. 松手在目的地按钮 = 直接投送；松手在面板上 = 保持面板选择；
  5. Esc / 指针取消 / 松手在非投送区 = 安全退出，节点未动过。
- 左键拖节点与右键投送互不冲突；边缘自动平移只属于左键拖与相机，不属于右键投送。

### 2.4 Drop 语义（冻结）

- 只允许三种 Ghost：Drop Preview、Layout Preview（整理方案）、Agent Proposal（Agent 提案）。
  Selection、Hover、切换 Capability 不得产生 Ghost；Ghost 必须有来源、取消、确认和超时清理。
- Selection 不自动变成 membership；从 Selection 创建 Context/Workflow 必须是显式动作。
- Drop commit 走 Local Core 原子事务（membership + version CAS）；失败 Ghost 回弹并显示可恢复错误，
  不得出现刷新后消失的假成功。

### 2.5 其它已定手感

- 多选框/拖拽目标命中判定复用 `.vnext-destination-main/.vnext-destination-follow` 等既有选择器。
- 节点信息空字段不显示；预览走主画布/全屏/宿主侧栏，不放侧边小框。
- 版本数字不随编辑跳动（提交/恢复才变化）；运行状态用克制小点 + 文案。

## 3. 后续 GUI 调整执行规则

1. 动前先读：本文件 + `AGENTS.md` §7 冻结交互 + 相关 freeze 文档。
2. 新交互优先复用既有状态机（dropIntentMachine / spatialInteractionMachine / DropShelf），不重写一套。
3. 大改先给流程图和影响说明；不删用户已确认的交互（右键投送、Ghost 三态、Esc 栈）。
4. 验证链：lint → typecheck → web 单测 → build → 浏览器实测关键手势（右键投送、左键拖、双击、Esc 栈）。
5. 反模式红线：测试窗口感、信息堆叠、两步以上操作、版本数字跳动、全屏金属、彩色 SaaS 卡片风。

## 4. 权威参考文档

- [AGENTS.md](../../AGENTS.md)（§7 冻结交互、§8 UI 要求、§9 性能预算）
- [LCOS_SPATIAL_CANVAS_DROP_LAYOUT_UI_REFACTOR_FREEZE_20260810.md](./LCOS_SPATIAL_CANVAS_DROP_LAYOUT_UI_REFACTOR_FREEZE_20260810.md)（drop 状态机、Ghost 类型、布局矩阵）
- [CREATIVE_OS_MATERIAL_VISUAL_SYSTEM.md](./CREATIVE_OS_MATERIAL_VISUAL_SYSTEM.md)（材质、Token、节点外壳、液态铬）
- [LCOS_UI_FRONTEND_REFACTOR_BRIEF_20260806.md](./LCOS_UI_FRONTEND_REFACTOR_BRIEF_20260806.md)
- 实现文件：`apps/web/src/features/canvas/ProjectCanvas.tsx`（手势）、`apps/web/src/features/drop/DropShelf.tsx`、
  `apps/web/src/features/drop/dropIntentMachine.ts`、`apps/web/src/vnext.css`
