# Presentation 规则

## 可判断

```text
group        —— 同一轮整理结果放一起
hierarchy    —— 父子/层级关系
emphasis     —— primary/normal/secondary/muted
renderer     —— 适合的展示方式
```

## 禁止

```text
算坐标（布局是 Presentation Engine 的事）
自动重排用户整个项目
覆盖已有手工锚点（pinned）
```

## 默认行为

同一轮新整理结果 → 加入当前合适的 Presentation（context 或 workflow）成员，设合理 emphasis。

## 大范围整理

用户说“重排整个项目” → 先 Proposal（Ghost），不直接改现有布局。
