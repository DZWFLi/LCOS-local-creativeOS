# LCOS Gate F 实机测试清单

> 适用环境：Windows 11、已安装 Node.js、Python、Codex CLI，并完成 Codex 登录。  
> 目标：补齐当前容器无法完成的 Windows、真实 Codex CLI 和浏览器交互验证。

## 0. 准备

```powershell
npm ci
npm run audit:manifest:verify
npm run check:gatef-capabilities
npm run check:fast
npm run test:integration
python -m pytest tools/light-bridge-kernel/tests -q
```

记录：

```text
Node 版本
npm 版本
Python 版本
codex --version
当前分支 / Commit
Windows 版本
```

## 1. 启动

```powershell
npm run dev:open
npm run dev:status
```

确认：

```text
Local Core healthy
Light Bridge healthy
Codex Orchestrator 单实例
浏览器正常打开
普通 Composer 只显示真实可自动执行的 Agent
```

## 2. 用户交互

### 2.1 CommandDraft

1. 选择节点。
2. 输入 500 字以上 Prompt。
3. Ctrl/Cmd 多选另一节点。
4. 点击空白关闭输入区。
5. 切换 Workspace。
6. 刷新浏览器。
7. 重启 Local Core。

期望：Prompt、参考内容、Agent 与“结果作为新节点”完整恢复。

### 2.2 桌面选择

验证：

```text
单击单选
Ctrl + 单击切换多选
Shift + 单击兼容追加
空白框选
Ctrl + 框选增量
多选组拖动
输入框获得焦点时快捷键不误触 Canvas
```

### 2.3 ActiveContext

在 Codex 内置浏览器与 MCP 同时观察：

```text
选择顺序
Target
Pinned / Excluded
Viewport
Visible Nodes
节点摘要
一度关系
Version
```

期望：停止操作后 1 秒内读取到新版本；Core 重启后语义 Context 恢复。

## 3. 真实 Codex 固定场景

### 场景 A：revise + Session 复用

```text
选中一个 Markdown
输入修改要求
选择 Codex
关闭“结果作为新节点”
发送
```

期望：产生待确认版本，Current 不变；接受后才成为当前版本。

连续再运行两次，期望三次使用同一 `projectId + codex` Session。

### 场景 B：create + 多文件

打开“结果作为新节点”，要求同时生成：

```text
shot-list.md
storyboard.json
```

期望：Return Group 出现两个结果，可分别审核。

### 场景 C：analyze + 零文件

不选择明确修改目标，只要求分析。

期望：返回结构化总结，不制造空 Artifact。

### 场景 D：running cancel

在 Codex 执行中点击“撤回”。

期望：

```text
graceful interrupt
超时后只终止 LCOS 拥有的 Runner 进程树
Run cancelled
迟到结果只归档，不生成 Draft
Session Binding 保留
```

### 场景 E：重启恢复

在 queued、running、review 各阶段分别重启 Core/Bridge。

期望：Run、Binding、Draft、Return、Session 与 Context 可恢复，不重复创建 Task。

### 场景 F：Session 失效

关闭或破坏首选 Codex Session。

期望：恢复失败后只创建一次新 Session，并原子更新 Binding；不得无限拉新窗口。

### 场景 G：同项目连续 5 Run

期望：

```text
无重复窗口
无重复生命周期事件
无无限日志
Session 复用
每个结果正确回收
```

## 4. 性能记录

记录 P50 / P95：

```text
Run 创建 → claim
claim → Codex 开始
开始 → submit
submit → Review
Canvas 操作 → ActiveContext 新 Version
```

## 5. 通过口径

```text
[ ] 用户从选中到发送不超过 3 个核心动作
[ ] 普通 UI 不出现 outputIntent、Target ID、Task ID 等内部术语
[ ] 真实 Codex 完成 revise/create/analyze
[ ] 连续 Run 复用项目 Session
[ ] cancel 与 late result 正确
[ ] Core / Bridge 重启可恢复
[ ] CommandDraft 不丢
[ ] Ctrl/Cmd 多选稳定
[ ] ActiveContext 延迟不超过 1 秒
[ ] 全质量链通过
```
