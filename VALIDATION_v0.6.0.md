# Local Creative OS v0.6.0 · 本次打包验证

## 已完成

- 从最新 Phase 3.1 累计代码建立干净发布目录；
- Phase 1.1、Phase 2.1、Phase 3.1 源码、测试与合同全部保留；
- 根包与 Web 包版本统一为 `0.6.0`；
- package-lock 顶层与 Web Workspace 版本同步；
- 历史 Phase 文档移入 `docs/archive/`；
- 移除 node_modules、dist、Vite 缓存与日志；
- 新增完整回归测试稿、正式 README、Release Notes、前端基线和已知边界；
- JSON、锁文件、目录完整性与静态结构完成检查。

## 未声称完成

本环境的 npm registry 下载依赖超时，且离线缓存缺少 `why-is-node-running`，因此本次打包环境没有重新完成：

- npm ci；
- oxlint；
- TypeScript Project Check；
- Vitest；
- Vite Build；
- Smoke；
- 真实 Chrome 累计回归。

这些检查必须由 Codex 按 `CODEX_RUN_V0.6.0_FULL_REGRESSION.md` 在开发机执行。
