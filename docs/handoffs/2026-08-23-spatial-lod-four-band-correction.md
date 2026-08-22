# Spatial LOD Four-Band Correction

## 摘要

按冻结的大数据量规划修正 Main Canvas 节点 LOD。旧实现只有三档，81–149 个节点仍完整渲染，151–299 个节点也缺少独立聚合档。

## 新契约

```text
0–80      full
81–150    simplified
151–299   aggregate
300+      overview
```

- aggregate / overview 中，未选中且非 Pending 的普通节点使用轻量语义代理。
- 选中节点和 Pending 目标保持完整面孔与操作能力。
- overview 继续使用视口裁剪与 180 个候选上限。
- LOD 只改变 Presentation 成本，不改变 Entity、Selection 或 Project Truth。

## 修改文件

- `apps/web/src/features/spatial/spatialTypes.ts`
- `apps/web/src/features/spatial/spatialLod.ts`
- `apps/web/src/features/canvas/canvasGeometry.ts`
- `apps/web/src/features/canvas/ProjectCanvas.tsx`
- `apps/web/tests/spatialCamera.test.ts`

## 验证

- Web typecheck：PASS。
- Spatial camera + Canvas geometry：2 files / 20 tests PASS。
- `git diff --check`：无空白错误，仅 Windows LF/CRLF 提示。

## 风险

- aggregate 当前采用单节点语义代理，不伪装已实现真正的关系簇 Cluster renderer。
- 真实浏览器仍需记录 80 / 81 / 150 / 151 / 299 / 300 节点边界的交互和帧率。

## 回滚

单独 revert 本批提交。
