# LCOS Phase 5 Slice 1 Handoff — capture/v1 网关

## Status
SLICE COMPLETE；PHASE 5 = NOT COMPLETE（继续 Slice 2）

## Scope implemented

- `CaptureRequestV1` 契约（page/selection/image/link/screenshot/text；target auto|project|staging）。
- `/capture/v1` 网关（免 core Bearer，走扩展 token + Origin 白名单 + 大小限制 + opId 重放幂等）。
- 载荷映射：URL/文本/图片 dataUrl→blob；显式项目校验；staging 直连并写回执。
- Staging 查询增强：search/kind/limit。

## Files changed

- `packages/contracts/src/capture.ts`、`index.ts`
- `apps/local-core/src/capture-gateway-service.ts`（新增）
- `apps/local-core/src/server.ts`（/capture/v1 路由在鉴权白名单区 + staging 查询参数）
- 测试：`capture-gateway-service.test.ts`（7 用例）

## Contract changes
- CaptureRequestV1 / CaptureGatewayResultV1（纯载荷契约，无 Core 实体）。

## State ownership
- 回执：Core capture receipts（operationId 幂等真相）。
- Staging：既有 capture_staging_items。

## Failure behavior
- 401/403/400/404/413 结构化；重复 operationId 幂等。

## Restart evidence
- Core restart 后网关 201/重放 200 实测。

## Targeted tests
- capture-gateway-service（7）；全量 core 377/377、web 355/355、lint/typecheck/build 绿。

## Browser flow tested
- HTTP：首次 staged 201 → 重放同 ID 200；错误 token 401；staging search 命中。

## Visual review
不涉及新 UI（本 slice 为服务层）。

## Hidden-debt scan
已扫；无本轮新增。

## Discovered Debt
无（staging 直连漏写回执的重放缺陷已修复并复验）。

## Remaining Debt（Phase 5 剩余）
- Web Staging 面板（时间分组/多选/分配/预览）
- 从暂存创建项目命令（§8.11）
- MV3 浏览器扩展（popup/context menu/拖拽 dock/截图）
- 桌面快速捕获（全局快捷键）
