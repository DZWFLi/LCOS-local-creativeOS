# LCOS 后端收尾源码包说明

## 基线

- Branch：`codex/backend-hardening-20260802`
- HEAD：`a7343d0`
- 打包日期：2026-08-04
- 工作树包含尚未提交的自动接单稳定性修复，详见 `docs/handoffs/LCOS_CODEX_AUTODISPATCH_STABILITY_FIX_20260804.md`。

## 包含范围

- `apps/local-core`
- `packages/domain`
- `packages/contracts`
- `packages/skills`
- `tools/light-bridge-kernel`
- `tools/lcos-agent`
- `tools/codex-orchestrator`
- `scripts`
- `tests/architecture`、`tests/integration`
- 根级工程配置、README、AGENTS 与本轮产品/交接文档

## 明确排除

- `apps/web` 与前端视觉代码；
- `.git`、`node_modules`、虚拟环境、build/dist/coverage/cache；
- `.data`、SQLite、Runtime Snapshot、日志和 PID；
- `.env`、Token、Cookie、私密凭证和用户项目文件。

## 开发入口

先读：

1. `docs/product/LCOS_PREMERGE_FINAL_ENGINEERING_REQUIREMENTS_20260804.md`
2. `docs/handoffs/LCOS_CODEX_AUTODISPATCH_STABILITY_FIX_20260804.md`
3. `README.md`
4. `AGENTS.md`

该 ZIP 是代码评审/开发交接包，不是带 Runtime 数据的可直接演示安装包。依赖通过根级 lockfile 与 Light Bridge requirements/pyproject 复现。
