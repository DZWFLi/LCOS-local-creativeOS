# Backend Phase 0 Worktree Ready

> 日期：2026-07-23
> 分支：`codex/backend-phase-0`
> Worktree：`E:\Codex 项目\OS开发-backend-phase-0`
> 集成基线：`74bf4f8196bd06cbcd12ccaee21e450ac8304dbc`

## 结果

三个接手阻断已经解决：

1. v0.6.0 候选已从固定 SHA256 输入整合为 Git 基线；
2. Web 测试范围显式限定，根质量门显式覆盖 Web、Domain、Contracts；
3. 后端已获得独立干净 worktree，不再依赖原脏工作区。

## 冷启动验证

在本 worktree 执行：

| 命令 | 结果 |
|---|---|
| `npm ci` | PASS；63 packages；0 vulnerabilities |
| `npm run check` | PASS |
| lint | 0 error；候选已知 7 warning |
| typecheck | Web、Domain、Contracts PASS |
| test | Web 20/69、Domain 1/3、Contracts 1/1 |
| build | 1802 modules |
| smoke | 2 assets；React root present |

首次冷启动发现一条测试对 LF/CRLF 敏感，已在 `74bf4f8` 中统一读取后的换行格式并复验通过。

## 当前边界

- `apps/local-core` 尚不存在；
- 未引入 SQLite、Watcher、Bridge 或真实文件写入；
- v0.6.0 产品回归仍是 `PARTIAL PASS`，Child Scope 与同链 Accept/Checkpoint 缺口没有被伪装为完成；
- 原工作区 `E:\Codex 项目\OS开发` 的用户改动与未跟踪文件保持原状。

## 下一条任务

可以在本 worktree 开始已提案的最小安全编码任务：只绑定 `127.0.0.1` 的只读 Local Core 骨架，提供 health、Project root 校验、只读 Catalog、结构化错误、取消与 graceful shutdown；不接 SQLite、Watcher、Bridge，不写真实用户文件。
