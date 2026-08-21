# LCOS Phase 5 Handoff — Capture 网关 + 暂存 + MV3 扩展

## Status
Phase 5 = **NOT COMPLETE**
- Slice 1（capture/v1 安全网关 + Staging 查询）DONE
- Slice 2（Staging 面板 + 从暂存创建项目）DONE
- Slice 3（MV3 浏览器扩展）DONE（BROWSER ACCEPTANCE PENDING）
- §8.9 桌面快速捕获（全局快捷键 / Runtime Host 托盘）NOT DONE → Phase J

## Scope implemented（Slice 3）

- `extension/` MV3 包：popup（页面/选区/截图 + auto/staging）、右键菜单
  （图片/链接/选区）、拖拽 dock（drop 目标 + 点击兜底）、`captureVisibleTab` 截图。
- `shared/capture-message.js` + `localhost-client.js`（UMD；`extension/package.json`
  声明 commonjs 供 vitest require）。
- `apps/local-core/src/server.ts`：`/runtime/extension-token` 移入鉴权白名单区
  （仅本机回环，免 core Bearer；正式版 Runtime Host/native messaging 接管）。

## Files changed（595bc68）

- `apps/local-core/src/server.ts`
- `extension/`（manifest.json、service-worker.js、content-script.js、
  popup/index.html、popup/popup.css、popup/popup.js、shared/*.js、
  test/capture-message.test.mjs、README.md、package.json）

## Contract changes
- 无新 Core 实体；`/runtime/extension-token` 从 Bearer 内移入白名单（行为：仅回环可达）。

## State ownership
- 捕获真相：Core（capture gateway → staging/project）。
- 扩展：只构造请求、不做项目归属判断、不接触项目数据。

## Failure behavior
- 非法请求在扩展侧与 Core 侧双重拒绝；Core 不可用时 popup 显式报错。

## Restart evidence
- Core 重启后扩展 token 路由可用；真实 HTTP 链路（token → capture/v1 → staged）通过。

## Targeted tests
- 扩展单测 4/4；`npm run check:fast` 全绿（web 358、core 379、domain 5、contracts 4、架构 104）。

## Browser flow
- 人工：Edge/Chrome `chrome://extensions` → 开发者模式 → 加载已解压 → `extension/`。
- 验证路径：popup 捕获页面/选区/截图 → 暂存区卡片出现；右键图片/链接/选区；
  拖拽图片/链接到页面底部 dock → 自动/暂存。**BROWSER ACCEPTANCE PENDING**。

## Visual review
VISUAL ACCEPTANCE PENDING（扩展 UI 需真机人工验收）。

## Hidden-debt scan
已扫；无新增隐藏欠账。

## Remaining Debt
- §8.9 桌面快速捕获（全局快捷键 / 文件 / 剪贴板 / 浮动窗口）→ Phase J
- Popup/右键"最近项目 chips"（不实现归属逻辑）
- 截图整页拼接（DEFERRED，不做半成品）

## Next Step（计划）
- Phase 1–5 全链路 Golden Gate：新建项目 → 拖文件 → 画布 → Command → Run → 审核 →
  捕获（扩展）→ 暂存 → 建项目/分配 → 重启恢复，真实浏览器串联验收。
