# Session 10 · Golden Project E2E + Release Gate

## 当前 Verdict

**UNREACHABLE IN THIS UPLOADED SLICE**

原因不是 S10 设计未定义，而是当前上传包没有安装 workspace dependencies，也没有可供本环境启动的真实 Codex harness/provider runtime。当前包只能完成 source-level gate，不能诚实地产出 LCOS 0.1 Release PASS。

## 已建立的 Release Gate

新增：

- `scripts/productization-s10-release-gate.mjs`
- `npm run check:0.1:deterministic`
- `npm run check:0.1:release`
- `docs/handoff/SESSION_10_REAL_HARNESS_EVIDENCE_TEMPLATE.md`

### Deterministic Gate

按顺序执行：

1. lint
2. typecheck
3. unit / contract tests
4. architecture tests
5. integration tests
6. Local Core build
7. Web production build
8. Browser E2E
9. existing full deterministic golden path

其中 Browser E2E 已包含本轮新增的 `context-create-from-selection.spec.ts`，用于锁定 S2 的 Context 创建持久化回归。

### Release Gate

Release Gate = Deterministic PASS + Fresh Real Codex Harness Evidence。

真实 evidence 必须绑定当前 Git HEAD，并证明：

`真实 Project → Context → Session → 局部 Agent → Context Proposal → 第二次真实执行 Run → ArtifactReturn Accept → Feedback Revision Upgrade → Session Summary/Handoff → reload/Continuity resume`

scripted/mock worker 不计入 Release PASS。

## 为什么不把 existing full-golden 当成 S10 完成

`tests/e2e/golden-path.spec.ts` 与 `scripts/full-golden-path.mjs` 是很有价值的确定性技术链，但不能代替 0.1 用户故事里的真实 provider、局部 Agent、Proposal Review、Revision Upgrade 与 Continuity resume。因此它们被纳入 deterministic foundation，而不是被包装成最终产品验收。

## S10 Done Definition

只有以下两条同时满足时：

- `npm run check:0.1:deterministic` PASS
- `npm run check:0.1:release` PASS

才允许写：

`LCOS 0.1 Candidate = PASS`
