# v0.6 Phase 3 Browser QA

必须在全新临时目录解压，确认服务进程来自本次包。

## 1. 工程质量链

```bash
npm ci
npm run lint
npm run typecheck
npm run test
npm run build
npm run smoke
npm run check
```

P0 停止规则：白屏、应用 Console 阻断错误、Canvas Lock 回归、项目 Graph 串数据、进入子画布后无法返回、创建 Scope 时原节点被删除。

## 2. Phase 2.1 回归

### Canvas Lock

打开 `/?state=confirm`：

- 拖遮罩、滚轮、Ctrl+滚轮、中键拖动；
- Dialog 保持；
- `data-locked=true`；
- Camera 和节点坐标不变。

### 任务闭环

打开 `/?state=phase2-single`：

- `C` 聚焦 Composer；
- Ctrl/Cmd+Enter 只打开确认，不创建 Process；
- 确认后才创建一个 Process；
- Waiting → Review → Accept 路径正常。

## 3. Project Drive

打开 `/?state=drive`：

- 页面显示 PortaSplit 与华新出海 VI；
- 搜索可以筛选；
- 点击 PortaSplit 进入 PortaSplit Graph；
- 点击 `+` 返回 Drive；
- 打开华新项目后标题和节点内容必须完全不同；
- 两个 Project Tab 同时存在；
- 在两个项目中分别移动节点，切换后各自位置恢复；
- 关闭一个 Tab 不删除项目数据；
- 关闭全部 Tab 返回 Project Drive。

## 4. 新建空白项目

- Project Drive 点击“空白项目”；
- 输入项目名称与目录；
- 进入空 Root Canvas；
- 只有一个 Workspace、一个 Root Scope、0 个节点；
- 拖入文件后出现 Source View；
- 刷新后项目仍在 Project Drive，节点仍在该项目，不出现在其他项目。

## 5. Child Canvas Scope

打开 `/?state=scope-create`：

- 已选中 proposal、feedback、reference；
- 点击“子画布”或已打开创建 Dialog；
- Dialog 居中于 Canvas 可用区域，Canvas 锁定；
- 创建“第二轮客户反馈”；
- 自动进入 Child Canvas；
- Child Canvas 中出现 3 个 View；
- DOM 检查同名 View 的 `data-artifact-id` 与父画布一致；
- 父画布原节点仍存在；
- 所选节点之间的内部关系在 Child Canvas 中存在；
- 面包屑显示 `Project / 第二轮客户反馈`；
- 返回上级恢复父 Scope Camera；
- 双击 Container 再次进入同一 Child Scope，不创建第二个 Graph。

## 6. Workspace 与 Scope

- 在 Child Scope 新建 Workspace 并保存当前视角；
- 切换其他 Workspace 后返回；
- 应恢复 Child Scope、Camera 和 Focus；
- Workspace 切换只改变 Scope / Camera / Focus，不复制节点。

## 7. 自动布局与固定对象

打开 `/?state=layout`：

- 只出现 Ghost Preview，真实节点坐标不变；
- 取消后完全不变；
- 选中一个节点，在 Work Rail 点击“固定位置”；
- 再预览布局，该节点没有 Ghost，其他节点避开它；
- Apply 后只移动当前 Scope 的未固定 Views；
- 自动 Fit 后节点不被 Dock、Mini-map、Work Rail 遮挡。

## 8. 删除 Scope

- 返回父 Scope；
- 删除刚创建的 Container View；
- Container 与 Child Scope 消失；
- 父画布原 Artifact Views 保留；
- 刷新后没有孤立 Scope 或指向已删除 Scope 的 Workspace。

## 9. 响应式与 Safe Insets

1440×900、1366×768、125%：

- Dock 展开 / 折叠；
- Mini-map 展开 / 折叠；
- Work Rail 展开 / Compact；
- Fit Scope、Workspace 切换、Artifact Return、Child Scope 进入；
- 节点不得被三块固定 UI 遮挡；
- 外层页面不得滚动。

## 10. 必交截图

```text
01-project-drive.png
02-two-project-tabs-portasplit.png
03-two-project-tabs-huaxin.png
04-blank-project.png
05-scope-create-dialog-locked.png
06-child-canvas.png
07-parent-canvas-container.png
08-layout-preview-locked-anchor.png
09-layout-applied.png
10-1366-safe-insets.png
11-phase21-confirm-lock.png
12-phase21-review-accept.png
```
