# LCOS 最新全栈源码包交接（2026-08-15）

## 任务摘要

把当前 `codex/r1-vision-merge-20260812` 工作树按完整源码快照打包，供后续开发、UI 修复和合并使用。包包含当前未提交的 A4–B3R5 集成改动，不 Commit、不 Push。

## 包含范围

- `apps/web`、`apps/local-core`
- `packages/domain`、`packages/contracts`、`packages/ui`、`packages/skills`
- Bridge、Runtime、CLI、工具脚本
- 单元、合同、E2E 测试
- 产品、架构、设计、审计和 handoff 文档
- lockfile、根配置和启动脚本

## 排除范围

- `.git`、`node_modules`、`dist`、`build`、coverage、test-results
- `.codex-runtime`、`.dev-launcher`、`.workbuddy`、`.agents`、临时目录
- `.env*`、数据库、SQLite、日志、Python虚拟环境和缓存

## 当前质量状态

沿用打包前最近一次完整的 A4–B3R5 验证结果，详见根目录 `BUILD_INFO.md`。当前静态/单元/typecheck/build 为通过状态；18 条 GUI 手操反馈和 B3R5 完整交叉 Drop 真机矩阵明确保持未关闭，不把源码快照标记为正式发布版。

## 恢复与启动

```powershell
npm ci
npm run dev:stack
npm run dev:open
```

## 风险与回滚

- 包是脏工作树的可复现源码快照，不对应一个单独 Git commit。
- 接收方应先核对随包 `.sha256`，再解压到新目录，禁止覆盖唯一工作副本。
- 如需回退，以原工作树或前一份校验包为准；不得对现有开发树执行 `reset --hard`。
