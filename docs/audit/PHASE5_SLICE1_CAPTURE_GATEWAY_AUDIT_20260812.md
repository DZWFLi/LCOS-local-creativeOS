# Phase 5 Slice 1 — capture/v1 网关 + Staging 查询 Completion Audit

> 依据：`LCOS_FINAL_GUI_CAPTURE_PHASE_1_5_PLAN_V2` §8.1-8.5 / §8.12（网关/安全部分）。
> 日期：2026-08-12

## Status
SLICE COMPLETE（FUNCTIONAL QA PASS）
Phase 5 整体：NOT COMPLETE（剩余：web Staging 面板、从暂存建项目命令、MV3 扩展、桌面快速捕获、截图 dock）

## Acceptance Evidence

### CaptureRequestV1 contract（§8.2）
Code: `packages/contracts/src/capture.ts`（schemaVersion 1 / source kinds / content / target auto|project|staging / hints）。
Result: DONE

### Gateway security（§8.5 / §8.12）
Code: `capture-gateway-service.ts`：
- 扩展 token（`x-lcos-token` 与 registry extensionToken 恒等比较）——缺失/错误 → 401。
- Origin 白名单（127.0.0.1 / localhost / [::1]）——其它 → 403。
- 请求体 ≤12 MiB；图像 dataUrl ≤10 MiB。
- operationId 重放幂等（staging 直连分支也写回执；已有回执直接返回）。
Tests: 6+1 用例（401/403/校验/auto/staging/显式项目/重放）。
Live: HTTP 首次 201 staged → 重放同 stagingId 200；错误 token 401。
Result: DONE

### Gateway routing（§8.3-8.5 载荷映射）
Code: page/link→url、text/selection→text、image/screenshot→staged_blob（dataUrl 解码写 blob）；target project → targetHint + 项目存在校验（缺失 → 404）；target staging → 直连 staging。
Result: DONE

### Staging query enhancement（§8.10 子集）
Code: `GET /runtime/captures/staging` 支持 search（标题/payloadRef 子串）、kind、limit。
Live: `?search=gateway` 命中暂存项。
Result: DONE

## Failure injection
- 无 token / 错 token → 401；非回环 origin → 403；错误 schema/kind/缺内容 → 400；超大 → 413；项目不存在 → 404；重复 operationId → 幂等返回（非重复写入）。
Result: PASS

## Restart evidence
- Core restart 后网关可用（HTTP 实测）。

## Hidden-debt scan
改动文件关键词扫描：无本轮新增。

## Remaining Debt（Phase 5 剩余）
- Web Staging 面板产品化（时间分组/多选/分配/预览）
- 从暂存创建项目命令（§8.11）
- MV3 浏览器扩展（popup/context menu/拖拽 dock/截图）
- 桌面快速捕获（全局快捷键）
