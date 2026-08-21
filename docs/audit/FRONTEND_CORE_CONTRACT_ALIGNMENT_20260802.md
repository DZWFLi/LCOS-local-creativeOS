# Frontend / Local Core 合同对齐审计（2026-08-02）

## 原因

后端 H0–H4 加固后，旧 UI 仍保留数处 Prototype 语义，导致用户操作文案、请求参数与 Runtime 真相不一致。

## 修复范围

1. Project 创建与打开拆分：
   - 创建新项目：提交已存在父目录与安全子目录名，由 Local Core 创建一个子目录；
   - 打开已有项目：只接受已存在目录，不创建、不移动文件。
2. Runtime Project 卡片切换重新读取 Local Core Graph，不再从 Fixture/Prototype fallback 打开。
3. Run 创建后由 Web 显式调用 dispatch；失败时诚实显示 `planned / 需要恢复`，不再误报已派发。
4. URL 默认 save-only 的提示改为“已保存，按需获取并重新理解”。
5. ZIP 用户备注通过 multipart 传入 Local Core，并进入 Resource Policy/Annotation。
6. 空 Runtime Catalog 不再提示“Demo 模式”，而是提示创建或打开 Project。

## 数据与安全

- 不改 Schema、Domain 对象和 Project Graph 语义。
- 创建目录只允许一个安全子目录名；拒绝路径分隔符、遍历、Windows 非法字符和已存在目录。
- 父目录必须存在、可读、可写，并继续受 `allowedRoot` 限制。
- Metadata 创建失败时只尝试回滚本次新建且仍为空的精确目录，不递归删除。
- 浏览器仍不能进行任意文件写入或 Shell 操作。

## 流程变化

```text
Before: UI 拼接不存在路径 → POST rootPath → existing-root validator → 404
After:  UI 选择 Create/Open intent
        Create → validate parent → mkdir one child → persist Project
        Open   → validate existing root → persist Project
```

```text
Before: create Run → planned，但 UI 显示 dispatched
After:  create Run → explicit dispatch → 显示真实 dispatch/provider 状态
```

## 回滚

本批次为独立提交，可使用普通 `git revert` 回滚。若 Metadata 写入失败，新建目录仅在仍为空时回滚。
