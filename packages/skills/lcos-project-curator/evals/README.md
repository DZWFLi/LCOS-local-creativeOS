# Evals

fixtures（规划目录，逐步实装）：

```text
tests/skill-fixtures/lcos-project-curator/
  01-three-conversations/
  02-large-codex-session/
  03-existing-duplicate/
  04-selection-reorganize/
  05-file-url-reference/
  06-capture-batch-ambiguous-project/
  07-manual-pin-reorganize/
  08-user-correction-regression/
```

判定标准（不比较 exact prose）：

- node count 在合理范围（无 raw explosion）
- provenance 存在
- duplicate avoided / resource reuse
- manual pin preserved
- 未创建 Managed Run
- module load set 与 intent 匹配（load budget ≤40%）
