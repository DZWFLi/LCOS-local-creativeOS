# v0.6 Browser QA

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

## 2. 浏览器环境

- Windows Chrome
- 1440×900
- 1366×768
- Chrome 缩放 100%、125%、150%
- Console 应用侧 error / warn 为 0

## 3. 核心流程

### A. 单文件派活

1. 打开默认页面。
2. 单击 `Thinker_Concept_V3.pptx`。
3. 验证 Work Rail 自动显示预览，Composer 目标为该文件。
4. 按 `C`，焦点进入 Composer。
5. `Ctrl+Enter` 发送。
6. 验证 Canvas 自动生成一个折叠 Process Node。
7. 验证 Work Rail 自动进入排队和执行状态。

通过标准：从单击到发送不超过 3 个主要动作，没有手动 Command Node。

### B. 多选推断

1. 框选 `Thinker_Concept_V3.pptx`、`客户反馈.md`、`参考与锁定元素`。
2. Work Rail 应显示：PPT 为修改目标，其余为参考资料。
3. 不应出现完整高级配置表单。
4. 参考类对象不能被设为修改目标。

### C. 等待输入与结果回收

1. 打开 `/?state=waiting`。
2. 选择 35%。
3. 等待结果返回。
4. 验证新 Revision 自动进入待确认区，并与 Target / Run 建立关系。
5. Work Rail 自动进入 Compare。
6. 接受后，新结果成为 Current，旧目标变为历史视图，并出现 Checkpoint 建议。

### D. Canvas Scope

1. 打开 `/?state=scope`，或双击 `参考与锁定元素`。
2. 验证进入子 Canvas，面包屑和返回上级可用。
3. Workspace 切换不创建第二套 Graph。
4. 返回 Root 后原 Camera 状态可恢复。

### E. 自动布局

1. 打开 `/?state=layout`。
2. 验证 Ghost Preview 不立即移动节点。
3. 取消后坐标不变。
4. 再次预览并应用，只移动当前 Scope 的 ArtifactView。

### F. Safe Insets

分别验证 Dock 展开/收起、Mini-map 展开/收起、Work Rail 展开/折叠：

- Fit Workspace
- Mini-map Locate
- Workspace 切换
- Artifact Return

节点不得被 Dock、Mini-map 或 Work Rail 遮挡。

## 4. 状态截图

至少输出：

```text
01-project-drive.png
02-workspace-summary.png
03-single-selection.png
04-multi-target-context.png
05-running.png
06-waiting-input.png
07-review-compare.png
08-accepted-checkpoint.png
09-child-canvas.png
10-layout-preview.png
11-1366-compact.png
12-150pct.png
```
