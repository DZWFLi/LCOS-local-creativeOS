# LCOS v0.15 UX 架构第二轮收口与施工清单

> 日期：2026-08-26  
> 性质：UX 架构补洞 + 施工拆解 + 外部组件参考  
> 适用范围：承接《LCOS v0.15 GUI 感知层重构与前端施工规划》，专门收口本轮讨论中暴露出的“身份、跨空间反馈、撤销、Agent 权限、会话控制、返回现场”等 UX 问题。  
> 原则：**尽量不新增大页面、不增加注册表式面板、不重造交互模型；优先把已经存在的 LCOS 能力改造成空间里自然可读的反馈。**

---

# 0. 本轮一句话结论

这一轮讨论下来，LCOS 暴露出来的很多“缺口”其实不是缺功能，而是：

> **底层能力已经存在，但用户看到的是工程状态、表格、注册页和分散入口，缺少统一的空间表达。**

因此这轮新增的 UX 不应该继续堆 UI，而应该收敛成五类语言：

1. **对象身边长出来的信息**：Glyth Orbit、Artifact Location Orbit。
2. **空间自己反馈操作结果**：Drop Receptive Motion、Local Field、Light Sweep、Sound。
3. **语义操作进入 History，纯布局探索不进入 History。**
4. **Agent 直接作为画布里的“可操纵角色”被选择、接管、设权限、连接 Session。**
5. **离开临时层和返回现场必须无脑：点空白 / Esc，而不是找隐藏 X。**

---

# 1. 同一个 Artifact 出现在很多地方：不要做注册表，要做空间导航

## 1.1 问题

LCOS 已经有 Entity / Projection 的底层分离。

真正没有讲清楚的是：

> 用户看到同一个 Artifact 在主画布、Context、Workflow、Collection、Workspace 等地方出现时，怎么知道“这是同一个东西的不同出现位置”，而不是复制了很多份？

旧式解决方法很容易长成：

```text
Object Instances
Projection Registry
Surface Membership
Reference List
```

这种对系统很清楚、对人很糟糕的页面。

这一版不要走这条路。

## 1.2 Artifact 单击后的新表达

普通 Artifact 单击以后仍然先进入 Selection。

同时允许在对象附近出现一个非常轻的空间信息层。

暂定名：

```text
Artifact Location Orbit
```

它和 Glyth Orbit 是同一种视觉语言，但信息内容不同。

第一层永远非常轻，只出现几个小浮标：

```text
来源
出现位置
被谁引用
Focus / 在哪
```

不要直接展开长列表。

点击“出现位置”后，对象周围再展开：

```text
主画布
某 Context
某 Workflow
某 Collection
某 Workspace
```

每一个都是一个空间目的地，不是数据库行。

点击任何一项：

```text
→ 触发现有 Focus / Surface Navigation
→ Spatial Beacon 接管定位
```

## 1.3 F Focus 不再长成独立登记面板

F 仍然是：

> **当前已知对象“在哪”。**

但是 GUI 应该彻底从工程化列表改成对象附近长出来的导航信息。

单对象 F：

```text
Selection
→ F
→ Location Orbit 展开
→ 每个出现位置可直接定位
```

多对象 F 单独设计，不强行复用单对象 Orbit。

多对象 Focus 的目标更像：

```text
这几样东西共同在哪？
分别散落在哪？
最近的共同现场是什么？
```

这部分在完整全站审计前先不改逻辑。

## 1.4 Provenance Badge：Artifact 左上角的小 Glyth 不再是装饰

当前 Artifact 上已有的小 Glyth / 来源图标，正式定义为：

> **Birth Provenance：这个 Artifact 最初由哪段 Conversation / Agent Session 产生。**

它回答：

```text
“谁生的？”
```

它不回答：

```text
“现在谁知道它？”
“现在谁正在使用它？”
“它属于谁？”
```

这是三个不同概念，绝对不能混。

推荐表现：

- 小而清晰；
- hover 显示对话名 / Provider；
- 点击可定位来源 Glyth；
- 不持续动画；
- 不承担当前 Agent 权限状态。

---

# 2. Handoff：不依赖 Toast，让空间自己说“我收到了”

## 2.1 问题

用户把 Artifact / Selection Drop 到 Context、Workflow、Assembly Target 后，目前最需要的不是又一个页面，而是：

> **我放成功了吗？放到哪了？系统有没有理解我？**

传统做法：

```text
右下角 Toast：
“Added to Context”
```

可以有，但不应该成为主反馈。

## 2.2 LCOS 的 Handoff 反馈链

建议统一成五阶段：

```text
① Approaching
② Receptive
③ Accept
④ Commit
⑤ Settle
```

### Approaching

拖拽对象靠近合法目标时：

- 目标区域非常轻地活起来；
- Local Field 稍增强；
- 不弹文案；
- 不改变真实状态。

### Receptive

真正命中 Drop Target：

- 目标边界 / Colony / Context 标记进入“可接收”状态；
- 可使用 tldraw 式 Hinting Indicator 思路；
- 视觉厚度应明显高于 hover，但低于 selection；
- 可出现极短 label：

```text
加入这里
作为参考
装配到这里
```

只有语义确实有歧义时才出现文字。

### Accept

鼠标松开、前端确认接受意图：

建议组合：

```text
目标轻微 recoil / compression
+
一次短促 Light Sweep
+
目标内部 Matrix / Segment 瞬时响应
+
Tier 1 轻音效
```

不是“抖一下”那种错误警报感。

更像一个东西被系统吸收进去。

### Commit

Core 真正写入成功后：

- 光扫完整；
- 新对象 / 投影快速 settle 到位置；
- 音效确认；
- 必要时显示极短文本：

```text
已加入「脚本上下文」
```

如果空间反馈已经足够清楚，文本甚至可以不出现。

## 2.3 Toast 的真正职责

Toast 只保留给：

```text
部分成功
失败
冲突
可撤销的高影响操作
后台长任务完成
需要明确说明 destination
```

不要每一次成功 Drop 都出 Toast。

---

# 3. Glyth 不应该“死着站在画布上”：做出使用痕迹

前一版规划写“默认静止”，这句话需要修正。

正确的是：

> **默认不喧闹，但不是完全没有生命。**

用户应该能不用读文字，就大致判断：

```text
谁最近经常用
谁正在工作
谁刚被召回
谁很久没碰
谁正在等我
```

## 3.1 Glyth 的四层状态通道

不要让四层都表达同一件事。

### A. Shape / 形状

负责：

```text
角色身份
当前高层动作
瞬时行为
```

例如：

```text
working → thinking morph
absorb → 收束
output → burst
waiting → notify
```

### B. Color / 色彩

负责：

```text
活跃度强弱
异常
当前接管
```

建议不是五颜六色，而是同一色系的能量等级。

例如：

```text
沉睡 / 长期未用 → 去饱和
普通 → 中性
最近活跃 → 稍提亮
当前接管 → accent 明确
error → 语义红
```

### C. Expression / 表情

负责离散事件：

```text
需要确认
等待输入
刚完成
报错
被用户召回
```

表情不能承担连续进度。

### D. Motion / 动态

负责时间性：

```text
最近活跃
现在正在工作
刚完成动作
长时间休眠
```

## 3.2 Activity Decay：让最近常用的对话自然浮出来

建议增加一个纯 Presentation 层的：

```text
conversationActivityScore
```

来源可以是：

```text
lastOpenedAt
lastRunAt
lastSelectedAsControllerAt
recentArtifactCount
recentInteractionCount
```

它不是 Project Truth。

它只决定 Glyth 的“活跃质感”。

例子：

```text
0–30 min：
明显有生命感

30 min–6 h：
轻微 idle motion

6 h–3 d：
非常安静

3 d+：
近似休眠，但轮廓仍可读
```

不要让长期未用的 Glyth 消失。

这实际上就是项目使用历史在空间中的自然沉积。

---

# 4. Undo / History：撤销“语义决定”，不回放每一步摆放

这一条可以冻结。

## 4.1 不进入主 Undo 的动作

```text
节点自由移动
微调位置
对齐后的二次手动移动
Camera pan / zoom
展开 / 收起临时 Orbit
查看 Focus
临时 Selection
```

这些属于：

> 布局探索 / 观察。

## 4.2 应进入 Undo 的动作

```text
加入 / 移出 Context
加入 / 移出 Workflow
建立 / 删除 Relation
装配 / 卸下成员
创建 / 删除 Projection
删除 Artifact
修改 Artifact 真内容
批量语义重组
改变长期 membership
```

这些属于：

> 项目语义决定。

## 4.3 为什么不记录每次位置

LCOS 的布局哲学已经越来越明确：

```text
人可以随手摆
Agent 可以重新整理
Skill 可以重新排
位置不是业务真相
```

如果 Ctrl+Z 不断回放刚刚的每一次拖动，用户根本不知道自己到底在撤什么。

所以建议：

> **Semantic History 和 Presentation Layout History 分开。**

第一版甚至可以只让 Ctrl+Z 操作 Semantic History。

需要恢复 Agent 大规模整理时，用：

```text
Arrange Preview
Revert Arrange
Layout Snapshot
```

而不是和普通 Undo 混在一起。

---

# 5. AI 权限：不要每一步审批，要做“能力范围 × 操作杀伤性”双轴

## 5.1 两个东西不要混

### Permission Scope

回答：

> 这个 Agent 有资格碰哪里？

例如：

```text
Read Only
Current Scene
Current Project
Project + Files
Full Workspace
```

### Mutation Risk

回答：

> 它这一次准备做的事有多危险？

例如：

```text
safe
reversible
structural
destructive
protected
```

一个 Agent 即使 Full Access，也不代表 destructive operation 自动无条件执行。

## 5.2 LCOS 的默认哲学：增益宽松，减损谨慎

可以概括成：

> **敢增，不随便减。**

默认直接执行：

```text
创建新 Node
创建 Projection
增加 Relation
增加 Context / Workflow membership
创建新的整理视图
移动 / 排列
新增 Collection / Workspace
生成新 Artifact
建立临时 Compare / Stack
```

可执行但必须可恢复：

```text
批量重排
批量改 Presentation
重命名
调整非关键 Relation
移出某个 Projection
```

必须 Preview / Confirm：

```text
删除真实 Artifact
覆盖真实内容
删除不可自动恢复的 Relation 集
删除完整 Context / Workflow 结构
批量移除 membership
跨项目搬迁真实对象
覆盖外部文件
修改工程文件依赖
```

## 5.3 破坏性操作应该怎么确认

不要传统：

```text
AI 想删除 17 个对象
[允许] [拒绝]
```

建议优先空间 Preview：

```text
将被删除 / 移除的对象
→ 变成 ghost / fade / red outline

结构变化
→ Before / Proposed

用户：
Keep
Modify
Reject
```

只有真正不可逆操作最后再出明确确认框。

## 5.4 现有 LCOS 已经有这条架构的雏形

后续全站施工应统一使用：

```text
Capability
→ Permission Gate
→ Project State
→ Selection State
→ Availability
→ Mutation Class
→ Execute / Preview / Deny
```

不要各 Surface 自己发明权限逻辑。

---

# 6. Glyth = 持久角色；Live Agent Session = 被召唤出来的工作实例

这是本轮很重要的一次架构澄清。

## 6.1 Glyth 不是 Live Session

Glyth 在 LCOS 里一直存在。

它保存的是：

```text
Conversation identity
Provider
沉淀上下文索引
Artifact provenance
参与过的 Context / Workflow
权限 Profile
最近 Activity
历史 Session refs
```

外面的 Codex / WorkBuddy / 其他 Agent 没开，它仍然存在。

## 6.2 Live Session 是瞬时运行层

Live Session 回答：

```text
现在有没有连上？
是哪一个 session？
还活着吗？
能不能 resume？
能不能新建？
现在忙不忙？
```

因此：

```text
Glyth = 宝可梦角色
Live Session = 这一次上场
```

## 6.3 选择“当前控制画布的 Agent”不该继续躲在顶栏

既然 Glyth 已经直接出现在主画布：

> 用户应该直接点那只 Glyth 让它上场。

Glyth Orbit 中增加：

```text
设为当前 Agent
当前权限
Session 状态
连接 / 恢复
新建 Session
查看外部窗口
```

顶栏原来的 Agent Selector 可以：

```text
第一阶段：保留成状态镜像 / fallback
第二阶段：降级为全局快速切换
第三阶段：视实际使用决定是否删除
```

不要马上砍，先让 Glyth 路径跑通。

## 6.4 “选中 Glyth → 接管画布”的理想流程

```text
点击 Glyth
→ Orbit 展开

[设为当前]
→ active controller 切换
→ Glyth 视觉进入 controlled state
→ 顶栏同步显示
```

如果已有 Live Session：

```text
直接接管
```

如果没有：

```text
显示 Offline / Dormant
[Resume] [New Session]
```

如果 Provider 能通过 CLI 拉起：

```text
LCOS 调用 runtime adapter
→ 创建 / resume session
→ session id 回绑 Glyth
→ Glyth 进入 Online
```

## 6.5 不强求把外部 Agent GUI 嵌进 LCOS

这条冻结：

> **LCOS 管 Session Identity、状态、上下文与控制，不复制 Codex / WorkBuddy 的完整 UI。**

外部 Agent 可以继续：

```text
CLI
Terminal
原生 Desktop
自己的窗口
```

LCOS 只需要知道：

```text
这只 Glyth 当前对应哪个真实 session
它是否可达
它正在干什么
如何 resume
```

这已经足够让 LCOS 成为 Session Control Layer。

---

# 7. Selection → Agent Context：不新增 UX，先做全站确认

这一条本轮不定义成新功能。

因为 LCOS 过去的设计明确就是：

```text
当前 Selection
→ Agent 可读
```

旧的施工资料也已经记录过：

```text
有 Selection → 使用 Selection
无 Selection → 使用当前 Context / Workflow Presentation
```

所以现在真正要做的是：

> **确认最新版全站链路有没有保持这一原则。**

需要完整全站源码审计：

```text
GUI Selection Store
↓
Current Agent / Controller
↓
Context Assembler
↓
CLI / MCP / Runtime
↓
Provider Session
```

必须验证：

```text
单选
多选
框选
切 Lens
切 Surface
切当前 Glyth
Session Resume
```

Selection 是否仍然保持正确含义。

禁止因为要验证这条链，又发明：

```text
“加入 Agent 上下文”
```

按钮。

如果 Selection 已经是上下文，就继续让它隐式成立。

---

# 8. Artifact “谁生的”与“谁知道”必须彻底拆开

正式冻结三个概念：

## A. Provenance

```text
谁产生了它？
```

显示：

```text
Artifact 左上小 Glyth Badge
```

## B. Current Context Reachability

```text
当前 Agent 是否能通过 LCOS 当前 Context / Selection / Search 找到它？
```

这是运行层，不常驻画面。

## C. Usage / Membership

```text
现在在哪些 Context / Workflow / Scene 正在使用它？
```

显示：

```text
Artifact Location Orbit / F Focus
```

这三个永远不要用同一个图标表达。

---

# 9. 返回现场：Outside Click + Esc 必须成为全站交互宪法

当前 LCOS 一个非常人类不友好的问题是：

> 临时层打开容易，关掉却要到处找 X。

这一轮直接冻结规则。

## 9.1 Outside Click

以下轻层：

```text
Glyth Orbit
Artifact Orbit
Popover
Context quick reveal
Component reveal
轻菜单
```

全部：

```text
点范围外
→ 关闭当前最上层
```

## 9.2 Esc 逐层退出

统一建立 Overlay Stack：

```text
Esc 1
→ 关当前 Popover / Orbit

Esc 2
→ 退出临时 Focus / Lens

Esc 3
→ 退出 Viewer / 当前子现场

Esc 4
→ 回到上一个 Spatial Scene
```

不是所有页面都必须四级，但原则必须统一：

> **Esc 永远处理“我现在不想待在这一层”。**

## 9.3 返回必须保留现场

从 Viewer / Context / Assembly 回来：

尽量恢复：

```text
Camera
Zoom
Selection
最近 Focus target
```

除非用户明确改变了它们。

“返回”不能变成重新载入主画布。

---

# 10. 可直接吸收的成熟外部方案

## 10.1 tldraw Indicators：强烈吸收其 Hinting 思路

tldraw 的 Indicator Layer 把：

```text
hover
selection
hinting / drop target
```

做成独立于 Shape Body 的 Overlay。

这跟 LCOS 非常合。

LCOS 不要引入 tldraw 画布引擎，但应吸收：

```text
Indicator 独立图层
Drop Target 比 Selection 更明确
Hinting 可程序控制
Body 本身不需要改样式才能表达交互
```

直接映射：

```text
Selection Indicator
Drop Receptive Indicator
Focus Arrival Indicator
Agent Proposal Indicator
```

## 10.2 Motion：直接使用

当前前端已经装有 `motion`。

优先用于：

```text
Glyth Orbit
Artifact Location Orbit
Drop Receptive Motion
Light Sweep
Field Pulse
Beacon Arrival
Outside-click exit
Assembly transition
```

需要：

```text
AnimatePresence
layout
variants
whileDrag
useReducedMotion
```

不要加第二套 GSAP。

## 10.3 Base UI：继续承担浮层行为

当前已经装：

```text
@base-ui/react
```

适合承担：

```text
Popover
Menu
Dialog
Focus management
Escape
Outside click
Keyboard interaction
```

不要自己手搓全站 8 套浮层关闭逻辑。

视觉完全可以自定义成 LCOS Orbit。

## 10.4 Howler.js：Sound Layer 候选

适合：

```text
sound sprite
global volume
mute
多个短音效
Web Audio / HTML5 fallback
浏览器 audio unlock
```

LCOS 第一批只需要少量音效：

```text
drop.accept
snap.accept
run.complete
review.required
error
session.connected
```

音频引擎独立，不绑 Toast。

## 10.5 Huabu：重点吸收“Agent 整理 Space”的职责划分

Huabu 值得持续对照的不是它所有 GUI。

最重要的是：

> **Agent 看到 Spatial Workspace，负责帮用户组织材料；用户保留查看和控制变化的权利。**

LCOS 应该继续沿：

```text
前端确定性排列原语
+
Agent Skill 语义整理
```

而不是增强一个越来越重的自动布局状态机。

同时要注意，Huabu 当前公开定位仍然强调对 AI 变化的 review / control。

LCOS 可以比它更激进：

```text
安全增量
→ 默认执行

高影响 / 破坏性
→ Preview / Confirm
```

不要机械照抄“所有 Agent 改动都 review”。

---

# 11. 本轮施工清单

## Session A｜全站状态链审计

**目标：只查，不改。**

必须确认：

```text
Selection
Active Agent
Agent Session
Permission
Mutation Class
History
Focus
Semantic Drop
```

在：

```text
GUI
Local Core
CLI
MCP
Runtime Adapter
```

之间的真实链路。

输出：

```text
UX_RUNTIME_TRUTH_MAP.md
```

至少含：

| State | Owner | GUI | Core | CLI | MCP | Runtime | Persistent? |
|---|---|---|---|---|---|---|---|
| Selection | | | | | | | |
| Active Glyth | | | | | | | |
| Session | | | | | | | |
| Permission | | | | | | | |
| Mutation Risk | | | | | | | |
| Semantic History | | | | | | | |

特别验证 Selection：

```text
单选 → Agent
多选 → Agent
框选 → Agent
切 Context 后 → Agent
切 Workflow 后 → Agent
切 Glyth 后 → 新 Agent
Resume Session 后 → Agent
```

## Session B｜Artifact Location Orbit + Focus GUI 收口

不新增底层能力。

复用：

```text
Focus
Projection index
Surface membership
Spatial Beacon
```

新增 / 改造：

```text
ArtifactLocationOrbit
LocationChip
ProvenanceBadge
```

验收：

- 单对象不再打开注册表面板；
- F 在对象附近展开“出现在哪”；
- 每个目的地可直接定位；
- Provenance Badge 只代表出生来源；
- 普通 Selection 不自动展开所有关系。

## Session C｜Drop Receptive Feedback

新增视觉状态：

```text
idle
approaching
receptive
accepted
committed
error
```

实现：

复用现有 Semantic Drop。

GUI 添加：

```text
DropIndicatorLayer
Local Field
Light Sweep
Matrix burst
Sound event
```

验收：

- 用户不看 Toast 也知道 Drop 成功；
- drop 前无真实 mutation；
- drop target 不需要持续高亮；
- error 与 accept 的 motion 明显不同；
- reduced motion 下仍有可读反馈。

## Session D｜Glyth Activity System

新增 Presentation 派生状态：

```text
activityScore
lastActive
controllerState
sessionState
```

不要先写入 Project Truth。

建立四层映射：

```text
Shape
Color
Expression
Motion
```

验收：3 秒扫画布能看出：

```text
最近常用
当前 Agent
正在工作
需要注意
长期休眠
```

但画面仍然安静。

## Session E｜Semantic History

先建立分类：

```text
Presentation exploration
Semantic mutation
Destructive mutation
```

Ctrl+Z 第一版只回滚：

```text
Semantic mutation
```

Agent Arrange 单独：

```text
Preview
Accept
Revert
```

不要混入普通 Undo 连续栈。

## Session F｜Execution Safety Core

把权限从 GUI 逻辑收回统一 Gate。

建议统一数据：

```text
PermissionScope
MutationRisk
ExecutionPolicy
```

第一版 Mutation Risk：

```text
SAFE
REVERSIBLE
STRUCTURAL
DESTRUCTIVE
PROTECTED
AMBIGUOUS
```

第一版 Policy：

```text
AUTO
PREVIEW
CONFIRM
DENY
```

验收：同一个动作从：

```text
GUI
CLI
MCP
Agent Skill
```

进入时得到一致判断。

## Session G｜Destructive Preview

对：

```text
删除
批量移出
覆盖
重大结构拆解
```

建立统一空间 Preview。

使用：

```text
ghost
fade
semantic red
before / proposed
```

最后确认才用 Dialog。

## Session H｜Agent Controller 回归 Glyth

Glyth Orbit 新增：

```text
Set Active
Permission
Session Status
Resume
New Session
Reveal External
```

顶栏暂时保留，成为：

```text
mirror / fallback
```

验收：

```text
点一只 Glyth
→ 让它接管当前画布
```

无需去顶栏。

## Session I｜Live Session Binding

完整状态：

```text
Dormant
Connecting
Online
Busy
Waiting
Disconnected
Unavailable
```

流程：

```text
Glyth
→ runtime adapter
→ resume / create provider session
→ session ID
→ bind back
→ state mirror
```

禁止把 Provider 全 UI 嵌入 LCOS。

## Session J｜Outside Click / Esc 全站统一

横向审计：

```text
Popover
Menu
Drawer
Orbit
Viewer
Overlay
Temporary Lens
Assembly transient layer
```

统一：

```text
outside click
Esc
focus return
camera restore
selection preservation
```

之后删掉没有必要的隐藏 X。

Modal / destructive confirm 仍保留明确按钮。

## Session K｜Sound Feedback

最后做。

因为声音绑定的是稳定事件，不是某个组件。

第一批：

```text
drop.accept
snap.accept
assembly.accept
run.complete
review.required
error
session.connected
```

先用极少样本做体验验证，再决定完整 sound pack。

---

# 12. 施工优先级建议

```text
A 全站审计
↓
B Focus / Location Orbit
↓
C Handoff Feedback
↓
D Glyth Activity
↓
H Agent Controller
↓
I Session Binding
↓
F Safety Core
↓
G Destructive Preview
↓
E Semantic History
↓
J Outside Click / Esc
↓
K Sound
```

其中：

```text
B + C + D
```

是最快把 GUI “人味”做出来的一组。

```text
A + F + H + I
```

是让 LCOS 真正从 Canvas 走向 Agent Harness 的一组。

---

# 13. 本轮最终冻结原则

1. **Focus 不缺能力，缺人话表达。**
2. **一个 Artifact 的多个出现位置用空间导航表达，不做 Projection 注册表。**
3. **Artifact 小 Glyth Badge = 出生来源，不等于当前 Context。**
4. **Handoff 首选空间 Motion + Sound，Toast 退居兜底。**
5. **Glyth 默认安静但活着，近期使用痕迹应该自然可见。**
6. **形状、颜色、表情、动态各自承担不同信息，不重复编码。**
7. **Ctrl+Z 撤语义决定，不回放每次画布摆动。**
8. **AI 权限 = 能碰哪里；杀伤性 = 这次动作多危险。两者分开。**
9. **新增通常直接允许，减损 / 覆盖 / 破坏性动作进入 Preview / Confirm。**
10. **Glyth 是持久角色，Live Session 是它这次被召唤出来工作的实例。**
11. **选哪个 Agent 控制画布应该回到 Glyth 本身，而不是永远藏在顶栏。**
12. **LCOS 控制 Session，不复制外部 Agent 的完整 UI。**
13. **Selection → Agent Context 属于已有底层原则，先全站验证，不增加“加入上下文”按钮。**
14. **临时 GUI 层点空白退出，Esc 逐层退出。**
15. **复杂语义排布继续交给 Skill，前端不要膨胀成自动排版状态机。**

---

# 14. 这轮之后 LCOS 的角色会更清楚

主画布不再是：

```text
节点
组件
注册表
Run 状态
工具入口
各种线
```

堆在一起的综合后台。

它开始真正变成：

```text
一群持续存在的 AI 对话角色
+
一批真正的项目材料
+
清楚的空间关系
+
自然的操作反馈
```

人看到的是：

```text
谁在这里
谁最近活跃
什么从谁那里来
这个东西还出现在哪
我把它放过去有没有成功
现在是谁在帮我工作
AI 接下来准备改什么
我怎么自然回到刚才的现场
```

而不是底层到底叫：

```text
Projection
Presentation
Capability
Mutation
Session Binding
Surface Membership
```

后者继续存在，而且必须存在。

只是不应该再逼人阅读它们。

这就是这一轮 UX 收口真正完成的标志。
::: ​​