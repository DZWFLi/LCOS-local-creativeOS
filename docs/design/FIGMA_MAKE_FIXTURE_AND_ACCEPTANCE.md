# Figma Make Fixture 与验收清单

## 1. Prototype Fixture

项目：`PortaSplit · 夏季节能 Campaign`

Workspace：

- Understand：理解 Brief 与客户反馈；
- Explore：收集视觉方向；
- Build：修改提案；
- Decide：确认版本与交付；
- Intent 可以为空，不得强制用户选择流程阶段。

Artifact：

| 名称 | 类型 | 家族 | 状态 | 备注 |
| --- | --- | --- | --- | --- |
| 品牌 Brief.pptx | PPT | Source | Synced | 12 页 |
| 客户反馈.md | Markdown | Source | Updated | “利益点需要更直接” |
| 参考构图.jpg | Image | Context | Linked | 来自本地目录 |
| 当前提案.pptx | PPT | Working | Current v6 | 第 5 页有页级备注 |
| 当前提案_v7_AI.pptx | PPT | Generated | Draft / 待确认 | 由 Run-042 返回 |
| 关键决策 #03 | Checkpoint | Decision | Confirmed | 保留品牌蓝，不改封面 |

Command：

- Instruction：把第 5 页的产品利益点改得更直接，保留品牌蓝，不改封面；
- Target：当前提案.pptx；
- Context：客户反馈.md、参考构图.jpg、品牌 Brief.pptx；
- Locked：品牌蓝、封面结构、Logo 安全区；
- Skill：PPT Message Clarity；
- Executor：Codex；
- Output：new-revision。

Run：

- Display ID：Run-042；
- Prototype external thread：Codex / PortaSplit revision task；
- waiting_input：30% 与 35% 数字冲突；
- Changed Files：`当前提案.pptx` modified；
- Artifact Return：`当前提案_v7_AI.pptx`；
- Acceptance：用户确认后成为 Current v7。

## 2. 必须可点击的主链

- [ ] 最近项目 → 打开 Canvas；
- [ ] Workspace → 相机聚焦，不换页面；
- [ ] 单击节点 → 状态 Overlay；
- [ ] 双击节点 → Relations Inspector；
- [ ] Relations → Preview → Back；
- [ ] PPT 当前页 → 添加页级备注；
- [ ] 多选三个对象 → `C` 创建 Command；
- [ ] Context Lens → 排除一个引用；
- [ ] Command → queued → running；
- [ ] waiting_input → 补充选择 → 继续同一 Conversation；
- [ ] review → Compare / Accept / Retry；
- [ ] Accept → Current Revision；
- [ ] Create Checkpoint → completed 收拢 Activity。

## 3. 视觉验收

- [ ] 默认态没有永久三栏，Canvas 占 80% 以上可用面积；
- [ ] 1440×900 显示 6–8 个主节点，1366×768 显示 5–6 个；
- [ ] Source、Working、Generated、Context、Run、Decision 不靠颜色也能区分；
- [ ] 文件内容与缩略图比装饰色更突出；
- [ ] Liquid Chrome 只出现在少数关键操作；
- [ ] 虹彩不承担状态或分类；
- [ ] Inspector 每次只显示一种主要模式；
- [ ] waiting_input 是需要选择，不是系统崩溃；
- [ ] Draft 与 Current 有形态、文案和来源差异；
- [ ] Mini-map 不显示文件名；
- [ ] 无 Dashboard 图表、聊天侧栏或后台菜单。

## 4. 交互验收

- [ ] 单击 Overlay 不改变 Canvas 布局；
- [ ] 双击取消单击 Overlay 的延时；
- [ ] Esc 按 Modal → Compare → Inspector History → Inspector → Selection 退出；
- [ ] `Cmd/Ctrl + Enter` 只在 Command 编辑状态有效；
- [ ] Workspace 切换关闭 Inspector；
- [ ] Target 与 Context 分离；
- [ ] Artifact Return 无 Target 时进入 Pending Return Zone；
- [ ] AI 结果不会自动覆盖 Current；
- [ ] Accept、Retry、取消与冲突状态均有入口；
- [ ] reduced motion 状态可展示。

## 5. 原型诚实性

- [ ] 全局标记 `Prototype Data`；
- [ ] Run 状态标注为 Target Interaction，而不是 Live Runtime；
- [ ] 不显示虚构的实时 Token、模型性能或同步成功率；
- [ ] Figma/Canva/飞书执行不出现在 Alpha 主链；
- [ ] 旧 AdFrame 的 AI Draft 不被描述为真实 Evaluator；
- [ ] Copy to Codex 不被描述为 Bridge Runtime。

## 6. Figma Make 交付检查

- [ ] 8 个 Frame 使用统一组件实例；
- [ ] 核心组件有命名清楚的 Variants；
- [ ] 交互连线覆盖 Golden Path；
- [ ] 所有返回、关闭与 Esc 语义有目标；
- [ ] 1440×900 与 1366×768 没有文字截断或 Inspector 挤压；
- [ ] 中文字号不低于规范；
- [ ] Fixture 名称与状态保持一致；
- [ ] 未经定义的功能没有被模型自行补齐。

