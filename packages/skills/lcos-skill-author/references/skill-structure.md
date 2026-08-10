# Skill 结构规范（执行版）

遵循 `packages/skills/SKILL_SPEC.md`：

```text
目录：packages/skills/<skill-name>/
  SKILL.md            ≤ 2K tokens
  references/         按需读取的细节
```

SKILL.md frontmatter 必含：

```text
name / description（含触发词）/ role / estimatedTokens / readOrder
```

正文固定顺序：

```text
何时用 / 何时不用
最小流程（4–8 步）
章节目录（表）
硬规则（3–10 条内联）
```

## 七段式方法结构

```text
ROUTE            —— 什么输入走哪条路径
INPUT BUDGET     —— 每次调用最大输入（数量/字符），防爆炸
METHOD           —— 可复现的步骤
CONSTRAINT       —— 不许做什么
DIAGNOSTIC       —— 结果不对时怎么判断哪里错
FAILURE CATALOG  —— 症状 → 根因 → 规则
FALLBACK         —— 主路径失败时的降级
```

七段可合并进 references，但 SKILL.md 的最小流程必须引用它们。
