# 八个托管 Skill 契约收口

日期：2026-08-23

## 摘要

`lcos-workspace-steward` 进入托管清单后，canonical managed skills 为 8 个。架构检查仍写死 7 个，并且 frontmatter 检查不兼容 Windows CRLF。本轮同步契约并恢复 Curator 不应被压缩掉的硬边界。

## 已完成

- 托管数量契约更新为 8，仍检查唯一性与索引一致性。
- frontmatter 检查兼容 LF / CRLF。
- Curator 明确当前 Selection 是一等输入。
- 恢复 Search before create、超预算说明的原始强约束。
- Skill Spec 明写 `Saved Context ≠ ActiveContext`。
- 8 个托管 Skill 已安装到 Codex managed 副本并通过静态验证。

## 验证

- Skill validator：8 / 8 PASS。
- 两个相关架构文件：11 / 11 PASS。

## 回滚

可回滚本提交，但若保留 Workspace Steward，则不能把托管数量恢复为 7。
