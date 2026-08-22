# Glyph Validator Contract Migration

## 原因

RC 静态验证器仍要求旧 `16×16 DotGlyph` 的 `pending / failed` 状态，而 v04 当前冻结实现已经迁移到 22px Glyph Micro 的 `candidate / waiting / blocked` 语义。

## 变更

- GUI Final validator 改为验证 `LcosGlyphState` 与新语义集合。
- R31B3 validator 改为验证 SurfaceObject 使用 Glyph Micro。
- 继续验证对象身份 Glyph 与状态 Glyph 分离。
- 不修改产品代码迁就旧验证器。

## 验证

- GUI Final：23/23 PASS。
- R31B3：14/14 PASS。
- `git diff --check`：无空白错误，仅 Windows LF/CRLF 提示。

## 回滚

与 Glyph Micro 回滚配套；单独回滚会恢复已经过时的验证契约。
