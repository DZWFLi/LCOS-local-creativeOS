# Local Creative OS v0.6 Phase 1.1 浏览器验收

## 目标

只验收 Phase 1 P0 热修：确认面板打开期间，任何遮罩手势都不得关闭面板、解除 Canvas 锁定或改变 Camera / 节点坐标。

## 启动

```bash
npm ci
npm run check
npm run dev -- --port 5190
```

保留测试地址：

```text
http://127.0.0.1:5190/?state=confirm
```

使用真实 Windows Chrome，先测 1440×900、100% 页面缩放，再补 1366×768。

## P0 停止规则

出现以下任一情况立即判 FAIL 并停止后续测试：

- 点击或拖动面板外遮罩导致确认面板关闭；
- `data-locked` 在显式关闭之前消失；
- Camera transform 改变；
- 任一节点 `left / top` 改变；
- Canvas DOM 或节点数量发生变化；
- 出现应用侧 Console error。

## P0 操作

1. 打开 `/?state=confirm`。
2. 记录：
   - `data-testid="run-confirm-dialog"` 是否存在；
   - Canvas `data-locked`；
   - `.canvas-world` transform；
   - Generated、Working、Source 各一个节点的 `left / top`；
   - Canvas DOM 数量与节点数量。
3. 在确认框外、Canvas 空白对应区域完成以下操作：
   - 单击 5 次；
   - 左键拖动 5 次，每次至少 180px；
   - 中键拖动 3 次；
   - 滚轮 10 次；
   - Ctrl + 滚轮 5 次。
4. 每轮后重新采集同一组几何数据。
5. 预期：
   - 确认面板始终存在；
   - Canvas 始终 `data-locked="true"`；
   - Camera、节点坐标、DOM 数量完全不变。
6. 只有以下操作可以关闭确认面板并解除锁定：
   - Header 关闭按钮；
   - “返回修改”；
   - Esc。
7. 关闭后验证 Canvas 恢复拖动和缩放。

## P0 通过后继续 Phase 1 原验收

- 1440×900 与 1366×768 居中；
- 外层页面无滚动；
- 首屏只显示：修改说明、修改目标、参考内容、执行方式；
- 高级设置默认折叠；
- 两个可编辑文件时，仅出现轻量 Target 选择；
- 打开、关闭、输入约 30 字、再次打开，共 5 轮；
- 打开确认前不创建 Command / Run / Process；
- 点击“开始执行”后才创建 Command ID、Context Snapshot ID、Run ID；
- Work Rail 自动进入 Running；
- Console 应用侧 error / warn 为 0。

## 必交证据

- 1440×900 居中截图；
- 1366×768 居中截图；
- 遮罩拖动后的锁定截图；
- 显式关闭后 Canvas 恢复截图；
- Target 歧义截图；
- 开始执行后的 Running 截图；
- 几何数据表与 Console 摘要。
