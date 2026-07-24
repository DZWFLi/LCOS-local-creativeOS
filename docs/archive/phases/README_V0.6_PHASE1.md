# Local Creative OS v0.6 Phase 1

本包是 v0.6 分步推进的第一份可测试代码，不是最终 Alpha 后端版。

## 本轮只解决

- AI 执行确认改成 Canvas 可用区域中的居中轻量面板；
- 默认只展示修改要求、目标、参考和执行方式；
- 多目标歧义在面板内用一个问题解决；
- Canvas 在面板打开期间完全锁定；
- 取消已排队的拖动与缩放帧，避免打开面板时继续位移；
- ProjectCanvas 使用 memo 与稳定回调，编辑指令时不重绘整张节点画布；
- 点击确认之后才自动创建 Command / Run / Process Node。

## 保留的 v0.6 WIP

- Project Drive；
- Root / Child Canvas Scope；
- Workspace + Scope + Camera；
- 常驻自适应 Work Rail；
- Target / Context 自动推断；
- Artifact Return / Compare；
- 自动布局预览；
- 节点关系复制粘贴与撤销重做。

## 运行与测试

```bash
npm ci
npm run check
npm run dev -- --host 127.0.0.1 --port 5187
```

重点页面：

```text
http://127.0.0.1:5187/?state=confirm
```

完整浏览器验收见：

```text
CODEX_RUN_V0.6_PHASE1.md
```
