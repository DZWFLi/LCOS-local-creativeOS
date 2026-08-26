# LCOS v0.1 三大视图最大数据量投影审计

日期：2026-08-23  
范围：Main / Context / Workflow 的空间投影、LOD 与显式选择保留  
结论：代码级投影契约已统一；真实浏览器 100 / 500 / 1000 对象耗时与内存仍需在最终压力验收中实测，不在本报告中虚构数据。

## 本轮发现与修正

Main 过去维护了一份独立的可视区域裁剪逻辑。进入 overview 后，它会在最终结果上再次 `slice(0, 180)`；当显式选择超过 180 项时，后面的已选对象会从渲染投影中消失，造成“数据还在，但选中反馈丢失”的错误体验。

本轮改为 Main、Context、Workflow 共用 `spatialOverviewProjection`：

```text
完整 Surface membership
        |
        +--> 当前相机可视候选
        |
        +--> 显式选择 / Pending（强制保留）
        |
        '--> overview 采样后的渲染投影
```

DOM 投影上限只约束普通候选。显式选择数量超过默认 180 时允许投影超过 180，不能为了性能让用户已经选中的对象失去反馈。完整对象集合、导航成员和 Project Truth 不因投影裁剪而变化。

## 冻结密度契约

| 对象数量 | LOD | 预期 |
| --- | --- | --- |
| 0–80 | full | 完整内容与关系表达 |
| 81–150 | simplified | 降低细节，不改变成员关系 |
| 151–299 | aggregate | 聚合辅助信息，保留焦点 |
| 300+ | overview | 视口投影与采样，显式选择 / Pending 优先 |

## 已有代码证据

- Main 已改用共享 `spatialOverviewProjection`，不再维护第二套裁剪规则。
- 500 对象测试覆盖：渲染投影受控、最后一个显式选中对象保留、原始 500 项不被修改。
- 1000 对象测试覆盖：一次显式选择 200 项时，200 项全部保留；原始 1000 项不被修改。
- 组件基础与相机投影相关定向测试共 25 项通过。
- Web TypeScript 检查通过。

## 三大视图边界复核

1. Main、Context、Workflow 可以使用不同 Presentation，但不得复制或改写 Project Truth。
2. 当前 Presentation 候选集合可来自用户、Agent、Saved View、Selection 或 Workspace；默认启发式不是 membership 真理。
3. LOD 只改变展示密度，不能改变对象身份、选中语义、Pending 状态或持久化成员关系。
4. Context 与 Workflow 不是把 Main 全量对象重新排一次；各自应根据当前 Intent 投影所需对象。
5. Ghost / Preview 未确认不得持久化，自动排布不得覆盖稳定锚点。

## 尚未关闭的风险

- 尚未记录真实浏览器在 100 / 500 / 1000 对象下的帧耗时、交互延迟与内存曲线。
- 300+ overview 的视觉聚合仍需在真实项目数据上手操判断，单元测试只能证明身份与数量契约。
- Context / Workflow 的 Portal 创建入口尚未完全对齐 Main；现有能力边界不得包装成已经全视图可用。
- Layout Brain 的 `foreground`、`make room`、`deemphasize` 尚无对应通用操作，只能 fail closed，不能伪装为可执行。

## 回滚

回滚本轮提交即可恢复 Main 的旧投影实现；不涉及 Schema、Project Truth 或持久化迁移。
