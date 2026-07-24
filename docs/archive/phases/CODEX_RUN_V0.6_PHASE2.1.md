# Codex Browser QA · v0.6 Phase 2.1

使用全新临时目录解压，不覆盖旧服务。运行真实 Windows Chrome，主测 1440×900，补测 1366×768。

## 停止规则

出现以下任一项立即停止并标记 P0：

- Composer `Ctrl+Enter` 未打开确认框便创建 Process / Run；
- 确认框打开时 Canvas 可移动、缩放或拖节点；
- 点击开始执行前 Process 数量增加；
- 页面出现应用侧阻断 error。

## A. Ctrl/Cmd+Enter 确认路径

入口：`/?state=phase2-single`

1. 记录 Process 数量、Camera、Canvas DOM ID；
2. 聚焦 `data-testid="work-rail-composer-input"`；
3. 按 Ctrl+Enter 一次；
4. 必须出现 `data-testid="run-confirm-dialog"`；
5. `data-locked=true`；
6. Process 数量保持不变；
7. Active Run 不得出现；
8. 等待 300ms 后在 Dialog 内再按 Ctrl+Enter，才允许创建一个 Process 与 RUN。

另测点击“发送指令”，结果必须一致。

## B. C 聚焦

入口：`/?state=phase2-multi`

1. 点击 Canvas 空白使 BODY 获得焦点；
2. 按 C；
3. Work Rail 如折叠应展开；
4. `document.activeElement` 必须为 `work-rail-composer-input`；
5. Process 数量不变；
6. 连续执行 10 次，成功率 10/10。

## C. Continue Modify 聚焦

入口：`/?state=review`

1. 点击“继续修改”；
2. 返回 Draft 成为唯一 Target；
3. Composer 文本以“继续修改：”开头；
4. `document.activeElement` 必须为 Composer textarea；
5. 光标位于文本末尾；
6. 输入补充内容后点击发送，确认框 Target 必须为返回 Draft。

## D. Accept 紧凑化

走完整任务到 Review，或从 `/?state=review` 进入：

1. 记录当前 Run 的 `processNodeId` 对应节点；
2. 点击接受为当前版本；
3. 该节点必须同时具备 `density-compact`、Completed 状态；
4. 不得只压缩旧 Fixture Process；
5. Pending Artifact 晋升 Working / Current；
6. 原 Target 不再 Current；
7. Checkpoint 建议出现。

## E. Phase 1.1 回归

入口：`/?state=confirm`

重复遮罩点击、左拖、中键拖、滚轮、Ctrl+滚轮。全程 Dialog 存在、Canvas locked、Camera 与节点坐标不变。

## 必交材料

- 质量链结果；
- A–E 逐项结果；
- Process 数量和节点 class 前后证据；
- activeElement 证据；
- 至少 6 张截图；
- 应用 Console error/warn；
- 未验证边界。
