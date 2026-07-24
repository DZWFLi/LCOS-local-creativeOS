# Codex 浏览器验收：v0.6 Phase 3.1

只运行、测试、截图和报告，不修改产品代码。

## 质量链

```bash
npm ci
npm run check
npm run dev -- --port 5193
```

## P0 停止条件

发现以下任意一项立即停止并报告：

1. Child Scope 的“返回上级”或父级面包屑不能回到父 Canvas；
2. 返回父 Canvas 后 Container 不存在，或再次双击不能进入同一 Child；
3. `Ctrl/Cmd+Enter` 直接创建 Run，未先打开确认并锁定 Canvas；
4. Scope 创建后所选对象之间原有的内部关系没有被复制；
5. 页面出现应用侧 Console Error 或 Canvas 被卸载。

## 必测路径

### 1. Phase 2.1 快捷键回归

打开：

```text
/?state=phase2-single
```

- 按 `C`；活动元素必须为 `work-rail-composer-input`；
- 输入指令后按 `Ctrl+Enter`；
- 必须出现确认框；
- Canvas `data-locked=true`；
- Process 数量不变；
- 点击“开始执行”后 Process 只增加 1。

### 2. Child Scope 正常创建与返回

打开：

```text
/?state=scope-create
```

- 创建 Child；
- Child Canvas `data-node-count=3`；
- `data-edge-count=2`；
- 两条 `.edge` 必须带 `data-edge-from` 与 `data-edge-to`；
- 点击“返回上级”；
- 必须回到 Root Canvas；
- Container 可见；
- 双击 Container 必须重新进入同一个 Child；
- 点击父级面包屑必须再次返回 Root。

### 3. 删除闭环

在父 Canvas 删除刚创建的 Container：

- Child Scope 与内部 ArtifactView 被删除；
- 父 Canvas 原 Artifact 仍存在；
- 指向 Child 的 Workspace 回退父 Scope；
- 刷新后没有孤儿 Scope 或 Workspace。

### 4. Project Tab

- 打开 PortaSplit 与华新；
- 每个 Tab 必须存在独立“关闭项目 …”按钮；
- 关闭非活动 Tab 不切换当前项目；
- 关闭活动 Tab 自动切换到剩余项目；
- 全部关闭回到 Project Drive；
- 重新打开项目恢复各自 Graph 和 Camera。

### 5. 响应式

在 1440×900、1366×768 和 125% 等效视口验证：

- 面包屑与返回按钮可点击；
- Tab 关闭按钮不被裁断；
- 无外层滚动；
- Safe Insets 仍成立。

## 必交截图

1. Child 正常创建且 2 条关系可见；
2. 返回父 Canvas 与 Container；
3. 重新进入 Child；
4. Project Tab 独立关闭按钮；
5. 全部关闭后的 Project Drive；
6. `Ctrl+Enter` 打开的锁定确认框；
7. `C` 聚焦 Composer 的 DOM 证据；
8. 删除 Container 后父 Artifact 保留。
