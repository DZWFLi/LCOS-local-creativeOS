# 质量检查（validate）

```text
[ ] frontmatter 完整（name/description/role/estimatedTokens/readOrder）
[ ] 触发词明确，与现有 Skill 互斥
[ ] SKILL.md ≤ 6KB（~2K tokens）
[ ] 七段结构齐全（ROUTE/INPUT BUDGET/METHOD/CONSTRAINT/DIAGNOSTIC/FAILURE CATALOG/FALLBACK）
[ ] 硬规则 3–10 条且内联
[ ] references 按章命名、按需读取
[ ] 不含项目私有事实（脱敏）
[ ] install 后 managed-by-lcos.json sourceHash 与仓库一致
```

任一失败 → 修正后重新 validate，不跳过。
