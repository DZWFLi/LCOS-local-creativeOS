---
name: lcos-skill-author
description: 把项目里实际积累的方法炼成可复用 LCOS Skill——读取当前 Selection（执行标准/踩坑经验/检查规则/交付规范），按 SKILL_SPEC 生成 SKILL.md + references，验证并安装。触发词：把这些炼成 Skill / 把经验做成 Skill / skill author / 沉淀成方法论。
role: agent
estimatedTokens: 1100
readOrder: ["references/skill-structure.md", "references/method-vs-fact.md"]
---

# LCOS Skill Author

## 何时用 / 何时不用

用：用户在 GUI/项目里选定一组「执行标准、踩坑经验、检查规则、内容要求、交付规范」，要求炼成可复用 Skill。
不用：普通文档整理（那是 Curator）、单个一次性脚本、没有可复用方法的内容。

## 最小流程

```text
1. lcos selection read <project> —— 只读用户框选内容
2. 判断哪些是可复用方法（Method），哪些只是项目事实（Fact）——method 进 Skill，fact 留在节点
3. 形成结构：ROUTE / INPUT BUDGET / METHOD / CONSTRAINT / DIAGNOSTIC / FAILURE CATALOG / FALLBACK
4. 按 SKILL_SPEC 写 SKILL.md（≤2K tokens）+ references
5. validate（SKILL_SPEC 规则自查 + 结构检查）
6. install（npm run lcos:install-skill 或脚本同步）
7. 登记 provenance：Skill 目录/文件作为 Resource/Artifact，Relation「derived from」→ 源节点
```

## 章节目录

| 章节 | 文件 | 什么时候读 |
|---|---|---|
| Skill 结构规范 | references/skill-structure.md | 写任何 Skill 前（必读） |
| 方法与事实判断 | references/method-vs-fact.md | 判断哪些进 Skill 时 |
| 质量检查 | references/quality-checks.md | validate 前 |

## 硬规则

1. 不新建 LCOS 顶层模块 / Skill Domain Runtime：Skill 就是文件 + Revision，纳入 Resource/Artifact + Relation。
2. SKILL.md ≤ 2K tokens；细节进 references；一个角色一个 Skill（agent / executor 分开）。
3. 不把项目事实当方法：具体项目的人名、日期、客户专有信息留在节点，不写进可复用 Skill。
4. 必须包含 ROUTE、INPUT BUDGET、METHOD、CONSTRAINT、DIAGNOSTIC、FAILURE CATALOG、FALLBACK 七个部分（可合并小节但不可缺）。
5. 生成后必须 validate（结构 + 触发词 + 体积），通过才 install。
6. 登记 provenance：Skill 包建立到 LCOS 的 resource/artifact，并连「derived from」关系指向源 Selection 节点。
