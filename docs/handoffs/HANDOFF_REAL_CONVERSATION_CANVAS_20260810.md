# Handoff · 真实会话替换 sample 上下文并接入画布（2026-08-10）

## 任务

用户反馈 sample 项目「是虚的，体验很迷」，要求用真实 Codex 会话
`019fc6bd-8755-7cb0-9210-8dcaa3b3391a`（Mr. Ideal 创意构思，美的项目 8/3 广告创意对话）
替换项目上下文，并按照「agent 自主把上下文导入」的正常格式呈现。

## 实际完成

### 1. 真实会话导入（Core 数据层）

- 来源：`C:\Users\1\.codex\sessions\2026\08\03\rollout-2026-08-03T16-28-57-019fc6bd-8755-7cb0-9210-8dcaa3b3391a.jsonl`（1486 行）
- 导入会话：`conversation-c7d34880c58060026646a85c`
  - 标题：Mr. Ideal 创意构思
  - messageCount：713 / sectionCount：91 / 匹配文件引用：2 / 去重事件：174
- 会话 artifact：`artifact-text-08c35b49-7357-4f8c-bb6a-d29d054034a4`

### 2. 91 章节实体化为画布节点（数据层）

之前导入只生成一个 271 字节占位 artifact，91 章节只存在于会话服务里，画布上不可见。
本次用幂等脚本（`.codex-runtime/materialize-conversation-sections.mjs`，仓库 gitignore 未提交）
通过 Core API 为每个章节创建：

- artifact：`artifact-conv-c7d34880-sNN`（title=章节标题，kind=markdown，managed=false）
- view：`view-conv-c7d34880-sNN`（scope=root，按 seq 网格排布）
- relation：`relation-conv-c7d34880-sNN`（会话 artifact → 章节 artifact，kind=reference）

结果：新增 91 artifacts / 91 views / 91 relations；项目 graph 现为 102 views / 97 relations。
脚本幂等，可重跑（已存在的 view 会跳过）。

### 3. 前端修复（提交 53ed897）

根因：`contextPresentationIds` 从未被对话入口设置；「在画布中打开」只 selectNode 定位，
Context 投影来源（resolveContextView）永远走不到会话分支；且 `outline` 表面漏在
`startsWith('context-')` 路由之外。

修复：

1. `ConversationContextDialog` 新增 `onActivateContextSource`，「在画布中打开」同时把
   会话 viewId 写入 `contextPresentationIds`，并定位节点。
2. `App.tsx` 新增 `activateConversationContextSource`，且投影路由把 `outline` 一并算入
   Context 投影（`activeSurface === 'outline' || startsWith('context-')`）。
3. `capabilityViewResolver`：单对象 Context 来源时 label 显示对象标题（如
   「Mr. Ideal 创意构思 · 展开 1 hop」），不再只显示「1 个明确对象」。
4. `ProjectionSurfaces`：关系图在临时 Selection 被清空时，以已激活的 Context 来源
   为 center（避免回退到排序第一个节点只显示 2 个对象）。

## 验证（真实浏览器 headless，脚本 `.codex-runtime/verify-conversation-context.mjs`）

| 检查项 | 结果 |
| --- | --- |
| 画布渲染 91 个章节节点 | PASS（91） |
| 对话记录弹窗打开 | PASS |
| 「在画布中打开」生效 | PASS（toast：已将该对话设为上下文投影来源） |
| Context Strands 打开 | PASS（1 条关系链） |
| Strands 来源标签 | PASS（Mr. Ideal 创意构思 · 展开 1 hop） |
| Strands 节点数 | PASS（94 = 会话 + 91 章节 + 2 文件引用） |
| 大纲 | PASS（94 行，来源正确） |
| 思维导图 | PASS（94 objects，与大纲同构） |
| 局部关系 | PASS（94 local objects · 1 center） |

验证链：web lint（仅存量 warning）→ typecheck 通过 → web 单测 251/251 →
build 通过 → 浏览器 9/9 检查通过。

## 遗留（诚实清单）

- 91 章节标题为解析器原文，含少量重复标题与系统噪音（如「Response annotations:」），
  实体化时对重复标题加了序号；如需语义去噪（决策/备注/阶段总结精选），属于后续 Agent
  整理能力，本次未做。
- sample 老 fixture（brief/script/reference/feedback）未删除，避免破坏 E2E seed；
  当前现场仍可同时看到它们与对话章节。
- 章节节点 preview 状态为 not-generated（无磁盘文件，属预期）。
- `.codex-runtime/` 两个验收脚本被 gitignore，未入库；数据已在 Core SQLite 落盘，
  重启不丢。
- 浏览器截图存档在 `.codex-runtime/verify-03-context-flow.png` 等（gitignore）。

## 回滚

- 代码：`git revert 53ed897`（仅前端行为，不影响已落盘数据）。
- 数据：删除 91 个 `*conv-c7d34880*` artifact/view/relation 即可恢复原样；
  会话记录本身保留。
