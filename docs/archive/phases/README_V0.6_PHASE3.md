# Local Creative OS v0.6 · Phase 3

Phase 3 完成 Project Drive 与 Canvas Scope 的前端空间骨架，同时完整保留 Phase 1.1 Canvas Lock 和 Phase 2.1 任务闭环。

## 用户主流程不变

```text
选中内容 → 输入要求 → 确认执行 → 自动回收结果 → 接受或继续修改
```

Phase 3 只增加“项目和空间从哪里进入、如何进入子画布、同一内容如何在多个空间复用”。

## 本版重点

- Project Drive 成为系统根入口；
- 多项目标签可打开、切换、关闭并恢复各自 Graph / Scope / Workspace；
- 新建空白项目后直接进入 Root Canvas；
- Root Canvas 与 Child Canvas 共用一个 Project Graph；
- 多选内容可创建子画布，原对象留在父画布，子画布创建同 Artifact 的 View；
- 容器节点双击进入子画布，面包屑和返回上级可用；
- Workspace 继续保存 Scope、Camera、Focus 和 Context Policy；
- 自动布局先显示 Ghost Preview，固定对象不会移动；
- Dock、Mini-map、Work Rail 持续参与 Safe Insets；
- Project 状态使用项目级 localStorage key 保存，不互相覆盖。

## QA 入口

```text
/?state=drive             Project Drive
/?state=project-huaxin    第二个独立项目 Graph
/?state=scope             已存在的 Child Canvas
/?state=scope-create      多选后创建子画布
/?state=layout            自动布局 Ghost Preview
/?state=phase2-single     Phase 2.1 黄金路径回归
/?state=confirm           Phase 1.1 Canvas Lock 回归
```

完整浏览器验收见 `CODEX_RUN_V0.6_PHASE3.md`。
