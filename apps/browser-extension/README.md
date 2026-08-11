# LCOS Capture（Browser Extension）

MV3 最小权限扩展：把当前网页 / 图片 / 链接 / 选中文字收进 LCOS。

## 权限边界（Phase C 冻结）

- 只申请 `activeTab` / `contextMenus` / `storage`；host 只允许 `http://127.0.0.1/*`。
- **不监听所有浏览行为、不扒 Web Chat 请求**（C26）。
- 不上传任何内容到外部：请求只发本地 Core（loopback）。

## 安装（开发模式）

1. Chrome/Edge → `chrome://extensions` → 打开"开发者模式" → "加载已解压的扩展程序" → 选择本目录。
2. 在 LCOS 运行端执行：`lcos runtime extension-token`（或 `node tools/lcos-agent/cli.mjs runtime extension-token`）。
3. 点扩展图标 → 粘贴配对码 → 保存。

## 使用

- 右键网页 / 图片 / 链接 / 选中文字 → "保存 … 到 LCOS"。
- 快捷键 `Alt+Shift+S` 保存当前页（可在扩展快捷键设置里改）。
- 高置信 Affinity 自动进项目；不确定进 Staging（Project Home 会显示"最近捕获"计数）。

## 开发

`src/service-worker.js`：菜单 + 快捷键。
`src/capture-client.js`：CaptureRequest 构造与发送。
`src/popup.*`：配对与手动保存。
