# Changelog

## 0.2.0

- 新增 `create | revise | analyze` Output Intent；
- 新增 TaskEnvelopeV1 / ResultEnvelopeV1；
- 支持多文件与零文件结果；
- 新增 outputRoot 第一层隔离校验；
- 支持 created / modified，不支持 deleted；
- 新增 warnings / suggestedNextActions；
- Provider capabilities 公布 Output Intent 和合同版本；
- SQLite Schema v2，旧 V0 Task 可迁移读取；
- 禁止创建新 V0 Task和自动 Legacy 回退；
- 新增多文件、分析、修改、目录逃逸、迁移等测试。
