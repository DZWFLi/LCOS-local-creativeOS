# Local Creative OS v0.6.0 · 完整前端回归

## 0. 测试身份与原则

测试对象必须是本包全新解压目录，不能覆盖旧仓库，也不能复用旧 Vite 进程。

建议地址：

```text
http://127.0.0.1:5193/
```

测试环境：真实 Windows Chrome；主视口 1440×900；补测 1366×768 与 125% 页面缩放。

正常交互优先。Fixture URL 只能在某条正常链路失败后继续验证独立状态，不得替代正常路径通过。

## 1. 质量链

```bash
npm ci
npm run check
```

必须记录：

- npm install / vulnerabilities；
- lint；
- typecheck；
- unit test 文件数和测试数；
- build module 数与 bundle 大小；
- smoke；
- 应用 Console error / warn。

任一质量链失败，报告为 FAIL，但仍可继续独立浏览器 QA，前提是不修改源码。

## 2. P0 停止条件

出现以下任一问题，停止当前交互链并保留干净证据：

1. 页面空白、框架错误覆盖层或应用 Console 阻断 error；
2. 执行确认打开时 Canvas Camera、节点位置或节点数量变化；
3. `Ctrl/Cmd + Enter` 跳过确认直接创建 Process / Run；
4. Project 切换后 Graph、选择、Undo 或 Artifact 混入另一个项目；
5. Child Scope 无法返回父 Scope；
6. 删除 Child Container 导致父 Scope 原 Artifact 被删除；
7. 同时出现两个 Work Rail / Command 大面板；
8. Artifact Return 覆盖已有节点且无法访问；
9. Accept 后 Canvas、Work Rail 和 Run 状态互相矛盾；
10. 外层页面产生无法恢复的滚动或 Canvas 被永久挤出安全区。

## 3. Project Drive 与多项目

### 3.1 Project Drive

1. 打开应用；
2. 点击左上品牌返回项目磁盘；
3. 确认 `[data-testid="project-drive"]` 唯一存在；
4. 搜索项目；
5. 打开 PortaSplit；
6. 再回项目磁盘并打开华新项目。

预期：

- 两个项目 Tab 同时存在；
- Graph 节点 ID 集不同；
- 项目切换不会复制 Canvas DOM；
- 每个项目恢复自己的 Camera、Scope、Workspace 与 Work Rail。

### 3.2 Project Tab 关闭

验证：

- 关闭非活动项目，当前现场不切换；
- 关闭活动项目，切换到剩余项目；
- 关闭全部项目，返回 Project Drive；
- 重新打开项目，恢复上次现场。

截图：Project Drive、双项目、关闭后状态。

### 3.3 空白项目

创建“v0.6 完整回归空白项目”。

预期：

- 有本地目录字段；
- 1 个 Root Scope；
- 1 个 Workspace；
- 0 个节点；
- 刷新后项目卡仍存在；
- 新项目不会污染 PortaSplit / 华新 Graph。

## 4. Workspace Semantic Viewport

在 PortaSplit 中：

1. 新建 Workspace；
2. 自定义名称；
3. Intent 设为空，再修改为探索，再移除；
4. 双击或编辑改名；
5. 复制 Workspace；
6. 排序；
7. 移动 Camera 并保存视角；
8. 切换到其他 Workspace，再切回。

预期：

- 切换 Workspace 只改变 Scope、Camera、Zoom、聚焦和可见层；
- 不创建第二套 Graph；
- 同一 ArtifactView 数量不因切换增加；
- Camera 精确恢复；
- 删除 Workspace 不删除节点或 Artifact。

## 5. Canvas 基础编辑

### 5.1 选择与移动

- 单选节点；
- Shift 多选；
- 框选；
- 整组拖动；
- 空白拖动画布；
- Space + Drag；
- 滚轮缩放；
- Mini-map Locate 与 Fit。

多选时必须：

- 只有一个 Group Box；
- 没有单节点连接锚点；
- 没有 Resize Handle；
- 节点相对位置不变。

### 5.2 密度

验证紧凑 / 标准 / 展开：

- 紧凑只保留核心身份与状态；
- 展开增加页数、备注、关系、时间、来源等信息；
- 不要求任意 Resize Handle。

### 5.3 Clipboard 与历史

验证：

- 单节点复制粘贴；
- 多选复制内部关系；
- 外部关系不随多选复制；
- Duplicate 创建额外 ArtifactView，不复制真实文件身份；
- 连续粘贴自动错位；
- 删除节点后 Undo 恢复节点与关系；
- Redo 再次删除；
- 关系复制模板粘贴到两个有序选中节点。

## 6. Work Rail 与选择跟随

### 6.1 默认 Workspace

没有选择、没有 Run 时：

- Work Rail 唯一存在；
- 显示当前 Workspace 摘要、最近结果和待处理；
- 底部 Composer 存在；
- 不显示通用“你好，我能帮你什么”的聊天空状态。

### 6.2 单选

单击 `proposal`：

- `data-mode="selection"`；
- 显示文件、版本、预览、备注与关联数量；
- Target 自动为 proposal；
- 一度关系在 Canvas 轻微提亮。

### 6.3 多选推断

选择 proposal + feedback + reference：

- `data-mode="multi-selection"`；
- proposal = Target；
- feedback / reference = Context。

再加入第二个可编辑主文件：

- 只出现轻量问题“这次主要修改哪个文件？”；
- 选择 Target 后其他可编辑文件转为 Context；
- 不展开完整高级配置表单。

## 7. Phase 1.1 Canvas Lock 累计回归

打开：

```text
/?state=confirm
```

记录：

- Canvas transform；
- 8 个节点的 left / top；
- Canvas DOM Node；
- `data-node-count`；
- Process 数量。

执行：

- 遮罩单击 ×5；
- 遮罩左键拖动 ×5；
- 遮罩中键拖动 ×3；
- Wheel ×10；
- Ctrl + Wheel ×5；
- textarea 连续输入 100 字；
- 打开 / 关闭确认并恢复 ×5。

确认框打开期间必须：

- `[data-testid="canvas"][data-locked="true"]`；
- Camera 不变；
- 节点坐标不变；
- 节点数量不变；
- Canvas DOM 不重建；
- 确认框不因遮罩手势关闭；
- 外层页面不滚动。

## 8. Phase 2.1 黄金任务闭环

### 8.1 快捷键

在正常页面：

- 按 `C`，活动元素必须成为 `[data-testid="work-rail-composer-input"]`；
- 输入修改要求；
- 按 `Ctrl/Cmd + Enter`。

第一次快捷键之后必须：

- `[data-testid="run-confirm-dialog"]` 出现；
- Canvas locked；
- Process 数量不变；
- Active Run 不存在；
- Target / Context 正确。

点击 `[data-testid="run-confirm-start"]` 后：

- Process 只增加 1；
- Work Rail 进入 `run`；
- Run ID 可见；
- Command / Context Snapshot / Run 只创建一次。

### 8.2 Running / Waiting Input

等待 Fixture 推进：

- queued / running 显示当前阶段；
- Composer 仍存在但发送禁用；
- waiting_input 自动切到 `data-mode="waiting-input"`；
- 选择 35% 后继续运行；
- 不需要用户手动寻找 Activity Route。

### 8.3 Artifact Return / Review

进入 Review 后：

- Work Rail 自动 `data-mode="review"`；
- Pending Artifact 位于 Target 右侧且不重叠；
- Pending Return Zone 只容纳 Draft / Pending；
- Current Artifact 不要求进入该区域；
- 前后预览、变化摘要、Changed Files、接受与继续修改可见；
- Compare 扩宽同一个 Work Rail，不得出现第二面板。

### 8.4 Continue Modify

点击 `[data-testid="continue-modify"]`：

- 返回 Draft 成为下一 Target；
- Composer 自动聚焦；
- 文本以“继续修改：”开头；
- 再次发送打开确认；
- Target 为返回 Draft；
- 不直接原样重跑旧任务。

### 8.5 Accept

点击 `[data-testid="accept-current"]`：

- Generated Draft 晋升 Working / Current；
- 原 Target 不再 Current；
- Work Rail 回到 selection 或 completed 合理状态；
- 显示“已接受为当前版本”；
- 当前 Run Process 精确变为 completed + compact；
- 输出关系停止流动；
- Checkpoint 建议出现；
- Canvas、Run、Work Rail 状态一致。

## 9. Phase 3.1 Canvas Scope

### 9.1 创建 Child Scope

在 Root Canvas 选择 proposal + feedback + reference，创建子画布。

确认：

- 父 Canvas 新增一个 Container Node；
- 自动进入 Child Scope；
- Child 有 3 个 ArtifactView；
- `artifactId` 与父节点一致；
- Child 有 2 条内部关系；
- 父 Canvas 原节点保留；
- Canvas `data-node-count` / `data-edge-count` 与模型一致。

### 9.2 返回、重进与面包屑

- 点击 `[data-testid="scope-back"]` 返回父 Scope；
- 父 Container 可见；
- 双击 Container 重新进入同一 Child；
- 点击父级面包屑返回；
- 每个 Scope 恢复自己的 Camera。

### 9.3 Child Workspace

在 Child 内创建 Workspace：

- 保存 scopeId、camera、zoom 和 focusedNodes；
- 切其他 Workspace 后再切回；
- 恢复同一 Child、同一 Camera 和相同节点数；
- 不复制 ArtifactView。

### 9.4 Layout Preview

- 打开自动布局预览；
- Ghost Preview 不修改真实节点坐标；
- Cancel 完全恢复；
- 固定一个节点；
- 再预览时固定节点没有 Ghost；
- Apply 只移动未固定节点；
- 自动 Fit 避开 Dock、Mini-map 和 Work Rail。

### 9.5 删除闭环

返回父 Scope，删除 Container：

- Child Scope 与后代 Scope 删除；
- Child ArtifactView 与内部关系删除；
- 父 Scope 原 Artifact 保留；
- 指向 Child 的 Workspace 回退父 Scope或被合理清理；
- 刷新后无孤儿 Scope、Workspace 或 Edge。

## 10. Safe Insets 与响应式

### 10.1 1440×900

- Work Rail 固定并排；
- Canvas 节点不在 Rail 下；
- Dock 与 Mini-map 不遮挡 Fit 结果；
- Compare 扩展后仍可操作；
- 外层页面无滚动。

### 10.2 1366×768

允许自动化宿主显示为 1367px。

确认：

- Dock 收起；
- Work Rail 300–320px 或合理 Compact；
- 节点处于安全区；
- Preview、Confirm、Compare 无文字裁断；
- 外层页面无滚动。

### 10.3 125%

- Work Rail 可切 Compact；
- 操作时 Overlay / 展开不超出视口；
- Mini-map 可折叠；
- Camera Fit 使用当前 Rail 宽度。

## 11. LOD / 性能 Fixture

分别打开：

```text
/?perf=80
/?perf=150
/?perf=300
```

记录首屏和交互：

- 80：完整节点，拖动目标 60fps 体感；
- 150：简化显示，关系降级；
- 300：总览 / 聚合，不要求全部完整卡片同屏；
- 选择、平移、缩放不能出现应用错误；
- 流动关系数量受控。

此项是前端退化策略验证，不等于生产级性能承诺。

## 12. 持久化

正常交互后刷新：

- Project Catalog；
- 打开的 Project Tabs；
- 当前 Project；
- Workspace 名称、Intent 和排序；
- Scope；
- Camera / Zoom；
- Work Rail collapsed / width；
- 节点位置、密度与固定状态；
- Child Scope；
- 接受后的 Current 状态。

若某项仅为 Fixture 临时状态，报告必须明确，不得假装持久化已接后端。

## 13. 必交截图建议

至少 24 张：

1. Project Drive；
2. 双项目 Tabs；
3. 空白项目；
4. Workspace 编辑；
5. 默认 Canvas；
6. 单选 Work Rail；
7. 多选推断；
8. Canvas Lock；
9. 快捷键打开确认；
10. Running；
11. Waiting Input；
12. Review / Compare；
13. Continue Modify；
14. Accept / Checkpoint；
15. Child 创建；
16. Child 内关系；
17. 返回父 Canvas；
18. 重新进入 Child；
19. Child Workspace；
20. Layout Ghost；
21. Layout Apply；
22. 删除 Child 后父 Artifact 保留；
23. 1366 Safe Insets；
24. 125% Compact；
25–27. 80 / 150 / 300 节点。

## 14. 报告结论格式

最终只能选择：

- PASS；
- PARTIAL PASS；
- FAIL。

每个缺陷必须包含：

- 严重级别；
- 用户看到什么；
- 正常交互复现步骤；
- DOM / 几何 / Console 证据；
- 是否能用 Fixture 继续验证其他独立模块；
- 未验证范围。

报告结尾必须重申：本轮是前端 Fixture 回归，不代表 Local Core、Bridge、Codex Runtime、真实文件写回或后端持久化已完成。
