# LCOS Skill 结构规范（v1）

本文件是 LCOS 托管 Skill 的唯一结构标准。`~/.codex/skills` 下的 LCOS Skill 必须由
`packages/skills` 同步生成，禁止直接手改本地副本。

## 1. 目录形态

```text
packages/skills/
  SKILL_SPEC.md          ← 本规范
  index.md               ← 托管 Skill 索引（角色 / 体积 / 读取顺序）
  <skill-name>/
    SKILL.md             ← 入口文件（必须 ≤ 2K tokens，约 6KB 文本）
    references/          ← 细节章节，按需读取
      <chapter>.md
    managed-by-lcos.json ← 安装脚本生成，勿手写
```

## 2. SKILL.md 结构（顺序固定）

```markdown
---
name: <skill-name>
description: <触发描述，必须包含触发词>
role: agent | executor | dev-frontend | dev-backend | orchestrator
estimatedTokens: <SKILL.md 本体约 token 数>
readOrder: ["references/先读.md", "references/次读.md"]
---

# <Skill Name>

## 何时用 / 何时不用
（两行以内，写明触发词与“不该用这个 skill 的情况”）

## 最小流程
（最常用路径 4–8 步，含必须遵守的硬规则，不再展开细节）

## 章节目录
| 章节 | 文件 | 什么时候读 |
|---|---|---|
| … | references/….md | 需要…时 |

## 硬规则（全部内联，不允许挪进 references）
（3–10 条，任何流程都不得违反）
```

## 3. 规则

1. `SKILL.md` 只放入口、触发路由、最小流程、目录和硬规则；细节一律进 references。
2. `estimatedTokens` 用 `文本长度 / 3` 估算，与实测偏差超过 30% 时必须更新。
3. 一个角色一个 Skill：执行器（executor）与管理/用户面（agent）必须拆开，
   不允许同一个 Skill 同时承担两种角色的读取。
4. 触发路由要互斥：`LCOS 接单提示` 只能命中执行器 Skill；
   普通项目对话只能命中管理面 Skill。
5. references 文件按章命名，只在对应场景读取；禁止在 SKILL.md 里粘贴 references 全文。
6. 修改后必须运行 `npm run lcos:install-skill` 同步本地，并保证
   `managed-by-lcos.json` 的 sourceHash 与仓库一致。

