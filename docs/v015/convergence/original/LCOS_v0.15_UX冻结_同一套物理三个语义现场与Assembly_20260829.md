# LCOS v0.15 UX 冻结 · 同一套物理，三个语义现场 + 共享 Assembly
## 2026-08-29

> 本文冻结 Main / Context / Workflow / Assembly 的最新产品判断。

# 1. 总原则

> **Same Physics, Different Semantics**  
> **同一套空间物理，三个语义现场。**

Main、Context、Workflow 不通过三套基础 GUI 来证明自己不同。

共同基础：

```text
SpatialCanvas
Selection
Move / Resize
Orbit
Semantic Drop
Unified Composer
Glyth
Colony
Focus / Spatial Marker
History / Preview / Commit
```

差异集中在：

```text
1. Relation Grammar
2. Surface-specific Component Vocabulary
3. Semantic Emphasis
4. Surface Arrange Skill
```

# 2. Main

核心：

> 项目里有什么、在哪里、谁跟谁存在明确关系。

最具象的是：

```text
Object / Space
```

Main 保持最自由的空间摆放。

Main 不需要为了“组件数量公平”硬造专属 Component。

# 3. Context

核心：

> 当前材料意味着什么，它们从哪里来，又是怎样演进到现在。

最具象：

```text
Version / Evolution / Meaning / Capture
```

Context 是外部信息进入项目理解的主要现场：

- Web Capture；
- PDF page / selection；
- PPT slide；
- DOC / MD fragment；
- Chat fragment；
- Resource / Obsidian；
- Source / Provenance。

Context 的版本不是第二套版本 truth。

用户看到“版本”，底层复用：

```text
Checkpoint
ContextSnapshot
Presentation snapshot
ChangeSet
Revision
Run
```

# 4. Workflow

核心：

> 现在要做什么，交给谁/什么能力去完成，结果回来以后发生什么。

最具象：

```text
Verb / Execution
```

但 Workflow **不是自动化流程搭建器**。

禁止：

```text
用户逐步拖步骤
→ 填参数
→ 配 MCP
→ 配 CLI
→ 在 LCOS 内搭自动化 DAG
```

0.15 的 Workflow 更像：

```text
必要上下文
+ 当前目标
+ 动作/意图
+ 可用 Skill/能力
→ 交给本地 Agent / API
→ Agent 执行
→ Return
```

Browser Harness 的价值：

```text
用户/Agent 做一遍
→ 记录
→ 教成 Skill
→ 后续 Agent 复用
```

不是“录制后变成 LCOS 自动化编排”。

复杂自动化 builder 推迟 0.2 / 0.3。

# 5. Assembly

Assembly 是整个 Project 共享的“仓库/装配工作壳”。

一个 Assembly：

```text
Target
+
Source Bay
    Project
    Capture
    Sources
    Skills
```

入口可以来自：

```text
Main
Context
Workflow
Glyth / Conversation
```

区别只在 Target。

Component 不进入 Assembly。

# 6. 即插即用

LCOS 主要交互：

```text
即拖即用
即点即用
即插即用
```

一个对象被放到某个地方，本身就表达语义。

不再：

```text
Drop
→ 选择操作
→ 选择模式
→ 选择 Target
→ 填表
```

只有真实歧义或危险才显式询问。

# 7. Arrange

Main：
- 自由优先；
- 用户可用 deterministic Arrange；
- 不默认“智能整理”。

Context / Workflow：
- 可以打开 grid snap；
- 各有专门 Arrange Skill；
- Agent 理解该 Surface 的语义后提出 position proposal；
- Preview → Keep / Revert。

Frontend 不再维护“自称智能”的本地 heuristic。

# 8. 一句话

```text
Main     = 项目地形
Context  = 项目理解
Workflow = 项目行动
Assembly = 项目仓库
```

四者共用同一个 Project Truth。
