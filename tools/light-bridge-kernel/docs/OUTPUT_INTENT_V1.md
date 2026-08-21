# Output Intent V1 决策

## 已采纳

```text
create | revise | analyze
```

- create：无 Target，1–5 个新文件；
- revise：唯一 Target 由 Local Core 冻结，Bridge 接受一个 modified 隔离副本；
- analyze：允许零文件，以结构化 summary 为主要结果。

## 对原评审稿的一个必要补充

TaskEnvelopeV1 增加：

```text
outputRoot
```

原因：`allowAdditionalFiles` 必须绑定到可信隔离根，否则 Bridge 无法安全验证动态产物。

## 本包采用的待确认项

```text
create maxFiles = 5
多 Return 的逐项 / 全部接纳由 Local Core 处理
analyze summary 保存在 ResultEnvelope，由 Local Core 决定是否转 Artifact
Provider 可建议下一步，但不能改变 outputIntent
V0 不再创建，只允许旧任务完成生命周期
```
