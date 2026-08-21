# LCOS 全栈收尾源码包说明

- Branch：`codex/backend-hardening-20260802`
- HEAD：`a7343d0`
- 打包日期：2026-08-04
- 包含当前工作树尚未提交的自动接单稳定性修复与最终工程需求。

## 包含

- Web、Local Core、根级前端入口与静态资源；
- Domain、Contracts、UI、Skills；
- Light Bridge、LCOS Agent CLI/MCP、Codex Orchestrator；
- Launcher、托盘、构建脚本；
- Architecture、Integration、Web、Core 测试；
- 产品、架构、设计、审计和交接文档；
- npm/Python 依赖声明与工程配置。

## 排除

- Git 元数据、依赖目录、构建产物和测试输出；
- `.data`、SQLite、Runtime Snapshot、日志、PID、浏览器配置；
- `.env`、Token、Cookie、私密凭证；
- 用户真实项目文件。

开发方首先阅读：

1. `docs/product/LCOS_PREMERGE_FINAL_ENGINEERING_REQUIREMENTS_20260804.md`
2. `AGENTS.md`
3. `README.md`
4. `docs/handoffs/LCOS_CODEX_AUTODISPATCH_STABILITY_FIX_20260804.md`
