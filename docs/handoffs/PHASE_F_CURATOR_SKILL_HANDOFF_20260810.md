# Phase F Handoff

## Completed

- **lcos-project-curator V1 包**：SKILL.md（~1.3K tokens）+ 9 个 references
- **入口**：触发词（整理进 LCOS / 沉淀到 LCOS / 记录这几轮 / 放进项目 / 整理当前 Selection / curate）、不触发（普通代码/创意写作/未要求 LCOS）
- **7 步主路径**：Resolve Project → Source Scope → Search → Read → Curate → Apply → Verify
- **9 条硬规则**（SKILL.md 内联）：不建 Managed Run、不扩大来源、search 前置、不覆盖手写文本、relation provenance、摘要粒度、不自动重排、资源五判据、真实验证
- **Golden Fixtures**：5 case（三轮对话 / 700 消息类 / 重复节点 / Selection / 文件+URL），期望全部为 invariant（节点数区间、noRun、provenance、scopeOnly…），无 exact-text
- **安装**：install 脚本纳入 curator，已同步 `~/.codex/skills/lcos-project-curator`（6 个 LCOS skill 全托管）
- **架构契约测试**：7 用例（token 预算、触发/不触发、no-run 硬规则、search-first、provenance、references 齐全、fixtures 覆盖）

## Files changed

```text
packages/skills/lcos-project-curator/SKILL.md + references/*.md（9）
packages/skills/index.md
scripts/install-lcos-codex-skill.mjs
tests/skill-fixtures/lcos-project-curator/*（5 case）
tests/architecture/lcos-project-curator-contract.test.ts
```

## Contracts frozen

```text
Curator 主路径与 9 条硬规则（本 Phase 不可变，除非真实 Golden Case 证明）
评估方式 = invariant（非 exact text）
```

## Migrations

```text
无（Skill 阶段，零 Core schema）
```

## Tests run

```text
npm run lint / typecheck / build         : PASS
npm run test                             : web 274/274 · core 277/277 · domain 5/5 · contracts 4/4
npm run test:architecture                : 93/93（含 curator 7 用例）
```

## Acceptance evidence

```text
架构测试 93/93；skill 安装到 ~/.codex/skills（install 脚本输出 6 skills）
```

## Known compatibility paths still present

```text
lcos-project-context（普通项目会话，与 curator 触发互斥）
```

## Explicitly NOT implemented

```text
Skill Builder UI / Workflow Skill runtime / Semantic Vector / 自动修改 Skill 自身
```

## Risks for next phase

```text
F15 真实 Agent Gate 需在普通 Agent 会话执行（用户说“整理进 LCOS”）；本 Phase 已装 skill。
Phase G 语义检索若增强 curator，需保持「search 前置」硬规则不变。
```

## Repository state

```text
branch  : codex/backend-hardening-20260802
commit  : b4331e7
HEAD    : b4331e7
```
