# 任务配方（常见意图 → 命令组合序列）

来源：huabu command-cookbook.md 借鉴（20260827）。配方 = 已验证的任务执行序列，**B-2 六次真实 Run 生产验证**（22 个画布节点、五套布局全部精确落位）。
本文件只管「哪些原语怎么组合」；字段名与 schema 以工具描述为准，节点命名走 node-labeling、坐标模板走 layout-recipes。

## 通用骨架（所有配方共享）

```text
1. 读材料：POST /space/ls 拿 L1 扫描头（label + preview）→ POST /space/read 读需要的全文
   （带 sessionId 读即记 read lease；后续写同 session 不会被 CAS 判 stale）
2. 写节点：curation/text 带 sessionId + 显式 x/y（坐标按 layout-recipes 模板算）
3. 记账：带 sessionId 的写自动进 ChangeSet（可 revert/reapply，归因 actor=agent/<run>）——无需手动管
4. 回执：改动落地后回复一俩行（canvas-output.md 规范），动作在画布上说话
```

**先读后写是硬纪律**：不读源材料就写 = 伪造。B-2 全部产出基于 `/space/read` 读到的真实项目材料，不是占位文本。

## Quick patterns

| 意图 | 序列（`⇒` = 用上一步返回的 id/材料） |
|---|---|
| 验收/核对清单 | `space/ls` → `space/read`（标准文档）⇒ N 个核对节点（网格排布） |
| 步骤/流程分解 | `space/read`（流程/剧本源）⇒ 节点左到右 `x = 0,230,460…` |
| 问答/成对产出 | `space/read`（问答源）⇒ 成对 grid（左列=问，右列=答；无对应项跳过该行） |
| 分层交接/总结 | `space/read`（全部输入）⇒ 层级自上而下 `y = 0,150,300…` |
| 风险/主题发散 | `space/read`（背景材料）⇒ 扇形径向（中心节点 + N 子节点环上均布） |
| 单点摘要 | `space/read` 每个输入（摘要必须 grounded 在原文）⇒ 1 个摘要节点 |

## Recipe: 验收清单（网格）

目标：把一份标准/要求文档变成可逐项打勾的核对节点群。

1. `space/ls` → 找到标准文档；`space/read` 读全文，摘出 N 条可核对项。
2. 每条一个节点，label = 1-5 词核对项（如「身份稳定核对」），content 写具体核对内容。
3. 网格坐标：`x = col*(180+50)`，`y = row*(100+50)`；单行条目 `y=200` 一行铺开。
4. 不连线——一排整齐节点本身就是「一组核对项」。

## Recipe: 成对问答（并排 grid）

目标：问答/反馈/原件↔译文这类两两配对的产出。

1. `space/read` 问答源（如反馈笔记），逐条拆出「问↔答」对。
2. 左列放问（`x = 起点列`），右列放答（`x = 起点列 + 230`），行距 `y = 200,350,500…`（150）。
3. **无对应项的行直接跳过**——不许造空节点凑对称。
4. 跨组依赖才建关系；同行的问答关系靠并排表达，不连线。

## Recipe: 扇形径向（发散脑暴）

目标：一个中心主题向 N 个方向发散。

1. `space/read` 背景材料，确定中心主题与 N 个发散方向。
2. 中心节点 `(cx, cy)`，N 子节点环上均布：`(cx + r·cos(2π·i/N), cy + r·sin(2π·i/N))`，半径 r≈320。
3. 中心 label 用主题词（如「交接风险」），子节点各一个风险/方向名。

## 纪律速查

- 坐标必填（不给坐标 = 违规，见 layout-recipes.md）
- label 1-5 词，label 与 content 分离（node-labeling.md）
- 边是噪声：排布能表达的不连线
- 节点 id 由服务端分配，回执/后续引用用返回的 viewId，不自己编
- 写完不复查聊天记录——ChangeSet 已记账，用户可 Keep/Revert
