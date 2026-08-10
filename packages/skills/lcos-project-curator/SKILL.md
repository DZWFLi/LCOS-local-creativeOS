---
name: lcos-project-curator
description: 把对话、文件、URL、当前 Selection 整理进 LCOS 项目——搜索已有内容、提炼少量高密度 Text Node、按价值导入资源、建立有阅读价值的关系、加入合适的 Presentation。触发词：整理进 LCOS / 沉淀到 LCOS / 记录这几轮讨论 / 把这些内容放进项目 / 整理当前 Selection / curate。绝不创建 Managed Run，绝不擅自扩大来源范围。
role: agent
estimatedTokens: 1300
readOrder: ["references/source-reading.md", "references/curation-principles.md", "references/cli-recipes.md"]
---

# LCOS Project Curator V1

## 何时用 / 何时不用

用：用户明确要求把讨论/文件/网页/当前选择「整理进 LCOS、沉淀到 LCOS、记录进项目」。
不用：普通代码实现、普通创意写作、用户没有要求 LCOS 的场景；消息以 `LCOS 接单提示` 开头的执行器回合（去 `lcos-executor-run`）。

## 最小流程

```text
1. Resolve Project（用户给了项目名/路径就绑定；没有就列出项目请用户选，绝不猜）
2. Determine Source Scope（只读用户指定的来源：这几轮、@ 的文件、当前 Selection；不扩大）
3. Search Existing（任何 create 前先 lcos search，找重复与已有相关节点）
4. Read Relevant（lcos node read / selection read，只读需要的）
5. Curate（create / update / reuse / skip 判断见 curation-principles.md）
6. Apply（node create-text / curation apply / presentation patch）
7. Verify（presentation show + related + node read 抽查）
```

## 章节目录

| 章节 | 文件 | 什么时候读 |
|---|---|---|
| 来源读取边界 | references/source-reading.md | 确定读什么/不读什么时 |
| 策展原则 | references/curation-principles.md | 每次 create/update 判断前 |
| CLI 配方 | references/cli-recipes.md | 执行任何 CLI 命令前 |
| Presentation 规则 | references/presentation-guidelines.md | 决定加入哪个工作区/如何强调时 |
| 关系规则 | references/relation-guidelines.md | 建立任何关系前 |
| 去重与更新 | references/dedupe-and-update.md | 搜到相似节点时 |
| 验证 | references/verification.md | 收尾抽查时 |
| 失败目录 | references/failure-catalog.md | 结果看起来不对时 |
| 示例 | references/examples.md | 需要参照粒度时 |

## 硬规则

1. 不创建、不 dispatch Managed Run：普通 Text / Presentation 策展只走 CLI（`node create-text`、`curation apply`、`presentation patch`）。
2. 不擅自扩大 Source Scope：用户说“今天这三轮”就只读这三轮 + search 结果；不默认读全部历史/整个项目/整个磁盘。
3. 任何 create 之前必须先 search（重复检测是前置步骤，不是可选项）。
4. 不覆盖用户手写的重要文本：来源不确定时「新建 + Relation」比覆盖安全。
5. Relation 只连未来有阅读价值的关系，不做 all-to-all；Agent 关系必须带 `origin=agent`，有来源时尽量写 `evidenceRefs`。
6. 摘要每个节点独立可读、高信息密度；禁止一句话一个节点，也禁止整场对话一个超级节点；禁止固定“10 条/5 点”模板。
7. 不自动重排用户整个项目；大范围整理走 Proposal（Ghost），不直接改现有手工布局。
8. 资源（文件/URL/PDF/Figma/Feishu/GitHub）只在“用户明确依赖 / Agent 实际修改 / 多次引用 / 关键判断依据 / 最终交付”时导入；临时日志、依赖、build 输出不导入。
9. 验证不是 exit 0：必须抽查 `presentation show` + `related` + `node read` 的实际内容。
