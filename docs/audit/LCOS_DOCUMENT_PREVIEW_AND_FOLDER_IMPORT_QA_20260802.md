# LCOS Document Preview and Folder Import QA — 2026-08-02

## 任务摘要

- 修复 multipart 上传中文文件名乱码。
- 创建 Project 时先扫描非空目录，并将目录文件导入为 Canvas 节点；允许用户明确取消导入。
- 为 Project 内已持久化的 PDF、PPTX 增加只读预览。

## 变更流程

```text
选择 Project 目录
→ Local Core 只读扫描并返回数量
→ 用户确认是否导入
→ 创建 Project 并索引文件
→ Canvas 恢复 Runtime 节点
→ 节点信息 → 只读预览
→ Local Core 校验 Project/FileRecord 归属并返回文件字节
→ 浏览器本地显示 PDF 或解析 PPTX
```

## 安全与边界

- 浏览器不能传入任意本地路径读取文件，只能读取属于当前 Project 的持久化 FileRecord。
- 文件必须为 `current`，单个预览文件上限 50 MiB。
- 响应禁止缓存并设置 `nosniff`。
- PDF/PPTX 不上传第三方；不提供编辑。
- PDF 使用浏览器原生只读预览，PPTX 使用 MIT 许可的 `@pagus-kit/react` 在浏览器本地解析。

## 验证证据

- Local Core HTTP 测试覆盖 UTF-8 中文 PDF 文件名、字节和 MIME 返回。
- 隔离 QA Project 从非空目录生成 2 个真实 Runtime 节点。
- PDF 对话框存在 1 个预览 iframe。
- PPTX 对话框渲染 3 个 SVG，错误面板数量为 0。
- 浏览器运行日志 error/warn 均为 0。

## 未包含

- 不提供 PDF/PPT/PPTX 编辑。
- 不实现在线 Office/Google Viewer，也不向外部服务上传本地文件。
- 已经以乱码名称持久化的旧节点不会自动改名；重新导入后使用正确文件名。

## 回滚

- 移除只读内容端点、`DocumentPreviewDialog`、节点预览入口与 `@pagus-kit/react` 依赖即可回滚；现有 Project、Artifact、Revision 和 Schema 不受影响。
