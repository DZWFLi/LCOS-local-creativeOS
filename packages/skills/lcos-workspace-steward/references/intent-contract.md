# Workspace Steward Intent Contract

## Input

```text
projectState
surface: main | context | workflow
componentSemantics
selection / focus
manual / pinned layout
active state
coarse geometry
webWorkbenchState
```

## Output

```text
intent
targets
reason
```

`intent` 只能来自：`preserve`, `foreground`, `cluster`, `sequence`, `make room`, `place beside`, `deemphasize`, `collapse inactive`, `suggest region`, `restore arrangement`。

几何层负责确定位置和尺寸，SurfaceOps 负责校验。任何 pinned 对象必须保持原 bounds；无法安全安排时返回建议而不是强行移动。
