# LCOS 本地 OCR（微信式悬停提取文字）Audit

> 日期：2026-08-12

## Status
DONE（FUNCTIONAL QA PASS / VISUAL ACCEPTANCE PENDING）

## 需求

- 不做单独按钮；鼠标移到图片上，识别出的文字区域自动变可提取（微信式）。
- 全 LCOS 生效：画布图片节点、全屏预览界面，以及其他出现图片的面。

## 引擎选择

- RapidOCR（PaddleOCR 模型 ONNX 开源版）：中文准、纯 CPU 离线。
- 模型本体 15.5MB；安装目录 249MB（onnxruntime/opencv 等依赖），装在
  `.codex-runtime/ocr-runtime`（E 盘项目内，不占 C 盘）。
- 微信 OCR 为腾讯闭源，无开源版本可用。

## 实现

- `apps/local-core/src/ocr-service.ts`：spawn Python 引擎，超时/错误结构化，
  只接受图片扩展且文件存在。
- `POST /runtime/ocr`：只收 artifactId，经 artifact → revision → fileRecord →
  observedPath 解析真实路径（不做任意路径，fail-closed）。
- `apps/web/src/features/ocr/OcrImage.tsx`：微信式悬停层。
  - 触发用 document 级 pointermove 命中检测（不依赖 img mouseenter，
    避免被画布边层 14px 可点区拦截）。
  - 文字行按 OCR box 坐标 + object-fit 映射渲染，portal 到 body 最顶层，
    不受边层遮挡；点击行复制该行文字；悬停高亮。
  - 按 artifactId 缓存识别结果，识别失败也缓存，不重复打扰。
- 接入点：画布图片节点（CanvasNodeVisual）、全屏预览（artifactViewerRegistry）、
  WorkRail 预览（PreviewSurface）、工作区对象卡片（SurfaceObject）。

## 测试

- 引擎实测：中文三行识别全对，置信度 0.968–0.999，首轮含加载 2.1s。
- `ocr-service.test.ts` 5 例（正常解析/非图片/缺文件/引擎失败/超时）。
- `ocr-image.test.tsx` 4 例（fill/contain/cover 坐标映射 + 渲染不改布局）。
- 全量：web 362/362、core 384/384、domain 5、contracts 4、架构 104、build 绿。
- 真实浏览器（Playwright）：画布悬停 → 3 行文字层出现（PASS）；
  双击进全屏预览悬停 → 文字层出现（PASS）。
  - 证据：`docs/audit/ocr-hover-canvas-evidence.png`、
    `docs/audit/ocr-hover-preview-evidence.png`

## Remaining Debt

- OCR 每次约 2–3s（含模型加载）：后续可做引擎常驻 worker 提速（Phase I 性能项）。
- 点击行仅复制该行；批量复制整段/「转为文本节点」留待用户反馈。
- 缩略图过小时（<12px 行宽）不显示文字层（避免噪点）。
- VISUAL ACCEPTANCE PENDING：等用户真机悬停确认手感。
