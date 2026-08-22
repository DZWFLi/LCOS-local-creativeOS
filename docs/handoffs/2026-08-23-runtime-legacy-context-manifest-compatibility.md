# Runtime 旧 Context Manifest 兼容修复

日期：2026-08-23

## 问题

schema v0 的已持久化 Context Manifest 允许 `project` 只有 `id`。新版 prompt serializer 直接规范化 `project.name`，旧项目在 Run materialize 时会因 `undefined.normalize` 失败，连带阻断 analyze / create / revise 结果链。

## 修复

- 输入契约明确兼容仅含项目 ID 的 v0 Manifest。
- 缺少项目名称时使用稳定项目 ID 作为 prompt 中的显示回退。
- 新增旧 Manifest 回归测试。
- RuntimeApplicationService 测试的注入 ID 改为确定且唯一，避免第二个 Run 与第一个 Run 主键冲突。

## 验证

相关 5 个测试文件、36 项测试全部通过，覆盖 prompt determinism、Run application、analyze、create 与 result ingestion。

## 数据与回滚

不迁移、不重写旧 Manifest，不改变 Project Truth。回滚本提交会重新暴露旧项目 Run 兼容风险。
