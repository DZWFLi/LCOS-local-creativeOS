# LCOS v0.15 R3-D Skill Artifact / Skill Builder / Cross-Surface Freeze

日期：2026-08-30  
状态：**冻结 / 可直接施工**  
范围：Skill Artifact、Workflow Skill Builder、Root Skill + Subskill 结构、跨 Surface 可移植规则、Universal Components 的 Surface Accent、RunRecipe → Skill Teach/Update。

---

## 0. 一句话冻结

**Skill 必须成为 LCOS 的一等 Project Object / Artifact；Workflow 中提供专门的 Skill Builder 作为强编辑投影。Skill 本体可跨 Main / Context / Workflow / Assembly / Conversation 使用，但 Skill Builder 仍是 Workflow 的专属编辑仪器。**

同时：

> **Project Object portable，Surface Instrument specialized。**

对象可以跨 Surface 使用；Surface 专属 Component / Instrument 不因此合并成一套。

---

## 1. Skill 的一等 Project Object 身份

Skill 不再只被理解为“Workflow 里可调用的一项能力”。

它必须是一份真实的 Project Object / Artifact，具备稳定 identity、source、version、provenance，可被项目中的多个 Surface 共同使用。

### 1.1 Skill Artifact 必须支持

- 出现在 Main
- 出现在 Context
- 出现在 Workflow
- 出现在 Assembly
- 加入 Conversation / Glyth
- 被 Composer Reference / Use
- 加入 Colony
- Search
- Focus / Location
- Marker
- Snapshot 中被记录
- 被拖拽到其他 Surface
- 被独立打开
- 被版本化 / 更新
- 被另一个 Skill 作为 Subskill 引用

### 1.2 Skill Artifact 不等于 Surface Component

Skill Artifact 是 Project Object。

Workflow Skill Builder 是编辑 Skill 的 Surface Instrument。

二者不能混为同一个对象。

禁止出现：

- Assembly 一份 Skill truth
- Workflow 又一份 Skill truth
- Conversation 再复制一份 Skill truth

所有 Surface 只消费同一份 canonical Skill Artifact。

---

## 2. Workflow Skill Builder

Workflow 中必须存在专门的 **Skill Builder / Skill Composer**。

它不是普通 Markdown 编辑器，也不是代码配置页，而是 Skill Artifact 的强编辑投影。

### 2.1 主交互心智

Skill Builder 应复用 LCOS 已成熟的：

- Text Outline
- Mind Map
- Direct Manipulation
- Drag / Drop
- Reorder
- Selection
- Multi-selection
- Semantic Drop
- Proposal / Preview / Keep-Revert

但编辑对象不再是“单个字”，而是**Skill 单元**。

### 2.2 用户默认编辑什么

用户默认操作：

- Root Skill
- Subskill
- Resource module
- Trigger / Scope
- Router / Index
- Execution module
- Validation / Eval module

正常 GUI 中不以逐字修改 `SKILL.md` 为主。

Raw source / Markdown / metadata 可以提供 Advanced / Source View，但不是主要工作方式。

---

## 3. 主流 Skill 结构映射

LCOS Skill Builder 应兼容当前主流 Agent Skill 的模块化 / Progressive Disclosure 思路。

推荐 canonical package 仍遵循类似：

```text
skill/
├─ SKILL.md
├─ scripts/
├─ references/
└─ assets/
```

LCOS GUI 不改变可移植 Skill Package 的底层结构，只提供更适合空间操作的编辑投影。

---

## 4. Root Skill + Subskill：索引 + 专精

Skill Builder 采用：

> **Root / Index Skill + 专精 Subskills**

心智。

### 4.1 Root Skill 负责

- identity
- description
- trigger
- scope
- router / index
- orchestration
- shared resources
- capability overview
- version
- provenance

Root Skill 不是“巨大 Prompt”。

它主要回答：

> 我是谁？
> 我什么时候应该被使用？
> 我有哪些专精？
> 应该把任务交给哪个 Subskill？

### 4.2 Subskill 负责

每个 Subskill 是一个完整、可独立复用的 Skill package，而不是一段散落文本。

Subskill 应支持：

- 独立调用
- 独立拖入 Workflow
- 独立加入 Conversation
- 独立 Reference
- 独立升级版本
- 独立重命名
- 独立颜色身份
- 被替换
- 被复制
- 被禁用
- 被拆出成为独立 Skill

### 4.3 嵌套限制

不鼓励无限嵌套。

优先保持：

```text
Root Skill
└─ Subskill
```

最多允许少量第二层专精。

禁止演化成无限 Skill Tree / 文件系统 cosplay。

---

## 5. Skill Builder 的模块划分

Skill Builder 的 GUI 建议以以下语义模块组织，但不要做成六张 SaaS 卡片。

### 5.1 Identity

包括：

- 名称
- 描述
- 图标 / glyph
- 主身份色
- version
- source / provenance

### 5.2 Trigger / Scope

包括：

- 什么时候可用
- 自动触发 / 手动触发
- 适用 Surface / Object / Task
- user-invocable
- model-invocable
- path / context applicability

### 5.3 Index / Router

Root Skill 如何：

- 识别任务
- 判断分支
- 选择 Subskill
- 顺序调用多个 Subskill

### 5.4 Subskills

Skill Builder 的核心区域。

每个 Subskill 作为**整体对象节点**编辑。

### 5.5 Resources

包括：

- references
- assets
- templates
- examples
- project-independent knowledge

### 5.6 Execution

包括：

- scripts
- tools
- MCP
- permissions
- provider requirements
- output contract
- result policy

### 5.7 Validation / Eval

用于：

- 测试 Skill 是否退化
- 对比不同版本
- 保存可复现实例
- 验证 Trigger / Router 是否正确
- 验证 Subskill 替换后是否保持能力

---

## 6. Skill Builder GUI

Skill Builder 的默认 GUI 采用：

> **Outline + Mind Map 的双投影 / 双视图**

两者共享同一份 Skill Truth。

### 6.1 Outline View

示意：

```text
Visual Direction
  Reference Analysis
  Prompt Design
  Consistency Check
```

用于：

- 快速排序
- 重命名
- 层级浏览
- 资源定位
- 状态查看

### 6.2 Mind Map / Skill Map

示意：

```text
        Visual Direction
              │
     ┌────────┼────────┐
     │        │        │
 Reference  Prompt   Consistency
 Analysis   Design     Check
```

用于：

- 直接拖动
- 分支关系
- 替换
- Router / Index 可视化
- Subskill 组合
- 模块之间的连接关系

### 6.3 编辑粒度

默认修改粒度是：

> **整个 Skill / Subskill 单元**

不是单个单词。

允许：

- Drag reorder
- Replace
- Rename
- Duplicate
- Disable
- Detach
- Merge
- Split
- Recolor
- Re-route
- Insert
- Remove

---

## 7. Skill / Subskill 的重命名和颜色

### 7.1 Rename

Root Skill 和 Subskill 都必须支持直接重命名。

重命名应更新：

- GUI identity
- canonical Skill metadata
- router/index display
- reference label

但不能破坏内部 stable identity。

### 7.2 Color

Root Skill 可以拥有主身份色。

Subskill 可以：

- 继承主色
- 使用同色不同明度
- 使用邻近 hue
- 用户自定义

颜色用于：

- Skill identity
- branch recognition
- cross-Surface recognition

不用于：

- 红=错误、绿=正确这类工具软件状态编码优先

---

## 8. Skill Native Morphology

Skill Artifact 必须有独立 Native Morphology。

禁止继续使用普通文件卡 / 万能白卡作为最终形态。

推荐方向：

> **Skill Spine / Skill Branch**

视觉语言：

- Root title
- 一条清晰的 spine
- 2~4 个 branch notch
- Subskill 以 branch tick / lobe / module 体现
- 少量身份色
- 版本/状态为弱辅助
- 不用齿轮 / 机器人脑袋 / 闪电等传统 Agent 图标堆砌

### 8.1 近景

可看到：

- Skill 标题
- 主 spine
- Subskill branch
- 少量状态
- version / source 弱提示

### 8.2 远景

降级成：

- Skill identity
- 主 spine
- 少量 branch ticks

保持一眼可识别，不变成普通卡片小点。

---

## 9. Skill Artifact 的跨 Surface 语义

Skill Artifact 可跨 Surface 使用，但 Drop Target 决定语义。

### 9.1 Skill → Composer

默认语义：

> **本次使用这个 Skill**

Composer 中应区分：

- `Reference · Brand Guide`
- `Use · Visual Direction`

避免 Reference 与 Invocation 混淆。

### 9.2 Skill → Conversation / Glyth

语义：

> 让这段 Conversation 可用这个 Skill

可形成：

- Conversation Capability Mapping
- Conversation Skill availability

但必须由 canonical truth 支撑，不做前端本地 attachment 假状态。

### 9.3 Skill → Colony

语义：

> Skill Artifact 加入这一片 Spatial Organization

不会自动执行 Skill。

### 9.4 Skill → Workflow

语义：

> 作为 Action Path 可调用的 Capability / Skill

### 9.5 Skill → Context

Skill 作为：

- reference
- capability source
- historical/project knowledge object

进入 Context。

不会因为进入 Context 就自动运行。

### 9.6 Skill → Main

作为 Project Object 存在，可被组织、Selection、Focus、Marker、Colony 管理。

---

## 10. Project Object Portable / Surface Instrument Specialized

正式冻结：

> **Project Object portable，Surface Instrument specialized。**

### 10.1 可以跨 Surface 的对象

例如：

- Skill Artifact
- Context Object
- Workflow Object
- Snapshot
- Artifact
- Source
- Run Result
- Link
- Conversation Fragment

### 10.2 仍保持 Surface 专属的 Instrument / Component

例如：

- Context Evolution
- Workflow Action Path
- Workflow Skill Builder
- 其他高度贴合 Surface 语义的专用仪器

对象可以跨 Surface 使用，不代表专属 Instrument 必须跨 Surface复制。

---

## 11. Universal Components 的 Surface Accent

Universal Components 继续共享底层实现。

例如：

- Arrange
- Gallery
- Stack

采用：

```text
Universal Component Core
+
Surface Accent Layer
```

### 11.1 Main Accent

更：

- 中性
- spatial
- 地形感
- 低语义偏置

### 11.2 Context Accent

更：

- semantic
- relation-aware
- source/evolution aware
- 可有轻量 Context tint

### 11.3 Workflow Accent

更：

- action-ready
- input/output aware
- run/result aware
- execution-oriented

### 11.4 差异幅度

Surface Accent 只允许是轻量差异。

建议控制在大约：

> 10~15% GUI 语气差异

不能演化成三套 Theme / 三份组件实现。

---

## 12. Context / Workflow 对象跨 Surface 使用

正式冻结：

- Context Object 拖到 Main / Workflow 仍然可用。
- Workflow Object 拖到 Main / Context 仍然可用。
- Skill Artifact 拖到任意 Surface 仍然可用。
- Snapshot / Source / Artifact 同理。

跨 Surface 后：

- 对象 identity 不改变。
- canonical truth 不复制。
- 仅改变当前 Surface 上的 Presentation / relationship / usage semantics。

---

## 13. Workflow 专属组件候选

Workflow 不需要堆大量专属 Component。

当前优先保留：

- Action Path
- Skill Builder
- Run / Result
- Approval / Decision（仅真实需要时）
- Input / Output Slot（仅真实需要时）

其余优先复用通用 Project Object / Component：

- Gallery
- Stack
- Arrange
- Source
- Snapshot
- Artifact
- Colony

---

## 14. RunRecipe → Skill Teach / Update

RunRecipe → Skill 必须与 Skill Builder 合并成同一条链。

禁止：

- 一边自动生成 Markdown
- 另一边 Skill Builder 维护另一份 UI truth

### 14.1 新的目标路径

```text
Completed Run
→ RunRecipe
→ Analyze reusable method
→ Skill Proposal
→ Skill Builder Preview
→ Keep / Modify / Split / Merge / Replace
→ Save / Update Skill
```

### 14.2 自动拆分 Subskill

如果 RunRecipe 中已经包含明显稳定的专业阶段，系统可以 Proposal：

```text
Visual Campaign Builder
├─ Research References
├─ Build Visual Direction
└─ Validate Consistency
```

但这是 Proposal，不是静默自动拆 Skill。

用户可：

- Keep
- 合并两个 Subskill
- 拆得更细
- 用已有 Skill 替换
- Rename
- Recolor
- 修改 Router
- Save

### 14.3 Skill Update

如果目标 Skill 已存在：

- 生成 update proposal
- 显示结构变化
- 显示新增 / 删除 / 替换的 Subskill
- bump version
- 保留 provenance

禁止直接覆盖 system Skill。

---

## 15. Skill Browser / Skill Builder / Skill Artifact 三层关系

### Skill Browser

负责：

> 找 Skill / 浏览 Skill / Focus Skill

### Skill Artifact

负责：

> Skill 本体 / 可跨 Surface 使用的一等对象

### Skill Builder

负责：

> 编辑 / 装配 / 拆分 / 组合 Skill

三者共享同一份 canonical Skill truth。

---

## 16. GUI / Motion 约束

Skill Builder 继续服从 R3-D GUI Freeze：

- container-driven responsive shell
- Unified HUD Scale
- Browse → Hover → Focus → Drag → Drop
- 壳内 Detail 展开
- Motion 服务直接操作
- Quiet ≠ Tiny
- Quiet ≠ Low Contrast

Skill Map 重点 Motion：

- drag reorder displacement
- branch insertion
- replace receptive state
- Subskill detach
- Router path wake
- hover branch emphasis
- map ↔ outline projection transition

必须支持 reduced-motion。

---

## 17. 当前施工约束

### 本轮可以继续做

1. Skill Artifact canonical contract
2. Skill Native Morphology
3. Skill Browser → Artifact → Builder 连通
4. Workflow Skill Builder 基础投影
5. Root / Subskill structure
6. Rename / Color / Reorder / Replace
7. RunRecipe → Skill Proposal
8. project user Skill install/update
9. Skill 跨 Surface Drop semantics
10. Universal Components Surface Accent

### 不允许偷跑 / 假完成

- 不把 Markdown Artifact 冒充 Skill Artifact
- 不把 Skill Builder 本地状态冒充 canonical Skill truth
- 不把 system Skill 静默覆盖
- 不把 Skill 拖到 Workflow 就假装执行成功
- 不做无限嵌套 Skill Tree
- 不把 Universal Components 分叉成三套实现
- 不让 Context/Workflow Object 因跨 Surface 而复制 truth

---

## 18. 最终冻结语句

**Skill 是 LCOS 的一等 Project Object。Workflow Skill Builder 是它的专属强编辑投影，而不是另一份 Skill。Skill 采用 Root/Index + Subskill 的模块化组合心智，用户主要通过 Outline + Mind Map 直接操作 Skill 单元，而不是编辑大段 Markdown。Skill Artifact 可跨 Main / Context / Workflow / Assembly / Conversation 使用；Surface-specific Instrument 继续保持专属语义。Universal Components 共用底层，只通过轻量 Surface Accent 呈现不同工作语气。RunRecipe → teach/update Skill 必须进入同一套 Skill Artifact + Skill Builder 真值链。**
