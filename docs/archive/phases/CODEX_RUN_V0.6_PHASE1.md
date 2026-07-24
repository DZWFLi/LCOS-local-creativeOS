# Local Creative OS v0.6 Phase 1 浏览器验收

不要修改视觉或交互方向。只运行、测试、截图并报告失败项。

## 运行

```bash
npm ci
npm run check
npm run dev -- --host 127.0.0.1 --port 5187
```

## 核心测试地址

```text
http://127.0.0.1:5187/?state=confirm
```

默认地址也要测试：

```text
http://127.0.0.1:5187/
```

## P0 验收

### 1. 居中几何

在 1440×900、1366×768 下记录：

- `.run-confirm-dialog` rect；
- Canvas 可用区域 rect，需排除当前 Dock 和 Work Rail；
- 对话框中心与 Canvas 可用区域中心的 x/y 差值。

通过标准：

- x/y 中心偏差均不超过 8 CSS px；
- 不压住 Work Rail；
- 不需要滚动外层页面才能看到主按钮；
- 小高度下仅对话框 Body 内部滚动。

### 2. Canvas 锁定

打开任务确认后：

- `data-testid="canvas"` 存在 `data-locked="true"`；
- 拖动空白、拖动节点、滚轮、触控板缩放、框选、拖线均无效；
- Camera x/y/zoom 不变化；
- 节点 x/y 不变化；
- Mini-map 和 Dock 不响应点击。

关闭后操作恢复。

### 3. 无闪烁压力

循环 20 次：

```text
打开确认 → 关闭 → 拖动画布 → 打开确认 → 关闭
```

记录：

- Canvas DOM 实例始终为 1；
- 节点数量不变化；
- 无全白、全灰或节点瞬间消失帧；
- Console 无应用 error / warn；
- Camera 不因打开或关闭确认面板自动跳动；
- 在确认面板 textarea 连续输入 100 个字符，Canvas 根节点与 8 个 Canvas Node 不应重建或闪烁。

能使用 DevTools Paint Flashing 时补证据，但不要把宿主插件网络日志算成应用错误。

### 4. 信息简化

默认确认面板首屏只能出现：

- 你想怎么修改；
- 修改目标；
- 参考内容；
- 执行方式；
- 返回修改；
- 开始执行。

Skill、Executor、Output 等不得默认展开。点击“执行方式”后才可看到 Codex 与保存为新版本。

### 5. Target 歧义

多选两个可编辑文件后输入并发送：

- 允许打开确认面板；
- 面板只提问“这次主要修改哪个文件？”；
- 选择一个后主按钮立即可用；
- 其他已选内容自动进入参考。

### 6. 执行创建时机

打开确认面板前后检查 Process Node 数量：

- 仅打开确认面板时不得创建 Process Node；
- 点击“开始执行”后创建一个 Process Node；
- 同时生成 Command ID、Context Snapshot ID 和 Run ID；
- Work Rail 自动进入排队 / 执行状态。

## 截图

至少提供：

1. 默认空 Composer；
2. 1440×900 居中确认；
3. 1366×768 居中确认；
4. 两个可编辑目标的轻量歧义确认；
5. 更多设置折叠状态；
6. 点击开始执行后的 Run Node；
7. Canvas 锁定 DOM / 几何证据。

## 报告限制

- 本轮不验真实 Local Core、Bridge、Codex Runtime；
- 不把 Fixture 定时器当作真实后端；
- 不自行恢复旧 Command 大表单；
- 不增加新的节点类型或路由。
