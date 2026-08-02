# Directory Picker and Import Entry Fix — 2026-08-02

## 任务摘要

修复项目创建/打开时要求用户手输 Windows 路径的问题，并统一核对 Canvas 资源导入入口。

## 实际范围

- Local Core 新增 loopback-only 系统文件夹选择接口。
- Windows 下由 Local Core 唤起原生文件夹选择窗口。
- 项目创建与打开对话框新增“浏览…”按钮；手输仅作为备用。
- Canvas 文件、压缩包继续使用浏览器原生文件选择器。
- Canvas 文件夹入口补齐 `webkitdirectory`，确保选择的是目录而不是普通多文件。
- 拖放入口保持不变。

## 数据流

```mermaid
flowchart LR
  UI[Project Dialog] -->|POST select-directory| Core[Local Core 127.0.0.1]
  Core --> Picker[Windows Folder Picker]
  Picker -->|explicit selected path| Core
  Core --> UI
```

## 测试结果

- `npm run check:fast`：通过。
- Web：122 tests passed。
- Local Core：173 tests passed。
- Domain：5 tests passed。
- Contracts：4 tests passed。
- Architecture：27 tests passed。
- Production build：通过。
- `git diff --check`：通过，仅有仓库既有换行提示。

## 风险与限制

- 原生目录窗口当前只在 Windows 实现；其他平台返回明确错误，不静默降级。
- 系统窗口需要人在桌面环境中完成选择，自动测试使用注入式 picker 验证 HTTP 合同。
- 用户取消选择不会修改当前路径。

## 回滚

移除 `native-directory-picker.ts`、`/system/select-directory` 路由和项目对话框的 `onBrowseDirectory` 接线；资源导入的 `webkitdirectory` 可独立保留。
