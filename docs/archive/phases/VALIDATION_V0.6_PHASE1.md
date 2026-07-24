# v0.6 Phase 1 本地验证

## 已完成

- TS / TSX 语法转译：39 files，0 diagnostics；
- 临时声明下源码语义类型检查：PASS；
- CSS `tinycss2` 解析：727 rules，0 errors；
- 居中任务确认静态契约：PASS；
- Canvas 锁定静态契约：PASS；
- drag / wheel 待执行帧取消契约：PASS；
- 多目标歧义可进入确认契约：PASS；
- 高级执行项默认折叠契约：PASS；
- 默认 Composer 空状态契约：PASS；
- ProjectCanvas memo 与稳定回调契约：PASS。

## 未完成

当前内部 npm registry 返回 HTTP 503，依赖无法完整安装，因此没有声称完成：

- oxlint；
- 正式 `tsc -p apps/web/tsconfig.json`；
- Vitest；
- Vite Build；
- 真实 Chrome 几何与闪烁验收。

开发机需按 `CODEX_RUN_V0.6_PHASE1.md` 完成真实浏览器验证。
