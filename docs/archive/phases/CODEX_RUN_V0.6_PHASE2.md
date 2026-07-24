# Local Creative OS v0.6 Phase 2 浏览器验收

## 目标

验证一条无需用户手动进入 Relations、Context、Activity 或创建 Command Node 的主流程：

```text
选中 → 输入 → 确认执行 → 等待输入 → 自动回收 → 接受 / 继续修改
```

Phase 1.1 的 Canvas 锁定回归仍是 P0 前置条件。

## 启动

```bash
npm ci
npm run check
npm run dev -- --port 5190
```

测试环境：真实 Windows Chrome，1440×900 / 100%，补测 1366×768。

## P0 停止规则

出现以下任一情况立即停止：

- `/?state=confirm` 的遮罩手势关闭面板、解除 `data-locked` 或改变 Camera / 节点；
- Work Rail 同时出现两个实例；
- 开始执行前已经创建 Process Node / Run；
- 开始执行后 Work Rail 没有自动进入 `data-mode="run"`；
- Artifact 返回后没有自动进入 `data-mode="review"`；
- Accept 后结果仍是 Draft，或旧 Target 仍为 Current；
- 应用侧 Console error。

## A. Phase 1.1 锁定回归

使用：

```text
http://127.0.0.1:5190/?state=confirm
```

重复原 Phase 1.1 遮罩单击、左键拖动、中键拖动、滚轮与 Ctrl+滚轮检查。全部通过后继续。

## B. 单文件黄金路径

入口：

```text
http://127.0.0.1:5190/?state=phase2-single
```

1. 预期 Working Artifact 已选中；
2. Work Rail：`data-mode="selection"`；
3. Composer 显示：
   - 目标为当前提案；
   - 参考为当前工作视角相关资料；
   - 执行为 Codex；
4. 修改输入内容，按 `Ctrl/Cmd+Enter`；
5. 居中确认面板出现，Canvas `data-locked="true"`；
6. 确认面板只显示修改要求、目标、参考和折叠执行方式；
7. 点击“开始执行”；
8. 预期：
   - 新增一个 Process Node；
   - Work Rail `data-mode="run"`；
   - Header 显示 Run ID；
   - Composer 仍存在，但发送按钮在运行期禁用；
   - Canvas 未卸载。

## C. 自动等待输入与继续执行

1. 等待 Fixture 进入 `waiting_input`；
2. Work Rail 自动变为 `data-mode="waiting-input"`；
3. 不通过其他路由，直接选择 35%；
4. Work Rail 自动回到 `run`；
5. Composer 中若输入了草稿，内容应保留。

## D. Artifact Return 与 Review

1. 等待结果返回；
2. 预期：
   - 新 Generated Draft 出现在原 Target 右侧；
   - 不与现有结果重叠；
   - Camera 自动带入结果；
   - Work Rail 自动扩宽并进入 `data-mode="review"`；
   - 显示前后预览、修改摘要、变化文件、接受与继续修改；
3. 不允许用户手动寻找 Compare Route。

## E. 继续修改

1. 在 Review 点击“继续修改”；
2. 预期：
   - Pending Artifact 被选为下一轮 Target；
   - Composer 聚焦；
   - 文本以“继续修改：”开头；
   - 仍只有一个 Work Rail；
3. 补充一句要求并发送；
4. 确认面板的 Target 应是返回的 Draft。

## F. 接受为当前版本

重新进入 `/?state=review`，点击“接受为当前版本”：

- Pending Artifact：`kind=working`、`current=true`、`draft=false`；
- 旧 Target：`current=false`；
- Work Rail 进入 `selection`，显示“已接受为当前版本”；
- Process Node 变为紧凑模式；
- Run 关系不再流动；
- Checkpoint 建议出现；
- Composer 可立即输入下一轮修改。

## G. 多选推断

入口：

```text
http://127.0.0.1:5190/?state=phase2-multi
```

预期：

- Work Rail `data-mode="multi-selection"`；
- 当前提案自动成为“修改目标”；
- 客户反馈与参考图自动成为“参考资料”；
- 无歧义时不出现完整高级配置；
- 选择两个可编辑主文件时，只出现“这次主要修改哪个文件？”的轻量问题。

## H. 快捷键与 Workspace

- `C` 只聚焦 Composer，不创建 Process Node；
- 切 Workspace 清空当前选择并回到 Workspace 摘要；
- queued / running / waiting_input 等需要注意的状态仍优先显示；
- Work Rail 的 collapsed / width 保持项目级持久化。

## 必交证据

至少提供：

1. 单选文件与 Composer；
2. 居中确认与 Canvas 锁定；
3. Running；
4. Waiting Input；
5. Artifact Return / Review；
6. Continue Modify；
7. Accept 后当前版本与 Checkpoint；
8. 多选 Target / Context 自动判断；
9. 1440×900 与 1366×768；
10. DOM / 几何 / Console 摘要。
