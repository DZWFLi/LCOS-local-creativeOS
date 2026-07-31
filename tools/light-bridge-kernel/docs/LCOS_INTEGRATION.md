# LCOS Integration

## 推荐接线顺序

```text
1. Local Core 构建 ContextManifestV1
2. Local Core 物化 RuntimeInputPack 与 outputRoot
3. Local Core 创建 Canonical Run / Dispatch
4. 发送 TaskEnvelopeV1
5. Provider 提交 ResultEnvelopeV1
6. Local Core 做 realpath / Hash / Path Guard
7. create → Pending Return Group
8. revise → Pending Revision Return
9. analyze → Run Activity / Review
10. 用户 Accept / Reject / Retry
```

## create

Bridge 可返回多个文件。Local Core 应为每个文件创建独立 ArtifactReturn，并用同一个 `runId` 组成 Return Group。Bridge 不保存 `returnGroupId`，避免第二真相。

## revise

Bridge 只验证一个 `modified` 隔离输出。Local Core 再验证 Target、Base Revision、Base Hash 和 Accept CAS。

## analyze

Bridge 持久化 summary、warnings、suggestedNextActions。Local Core 决定把它保存为 Run Activity，还是在用户明确操作后转成新 Artifact。

## capabilities handshake

Local Core 启动时检查：

```text
primaryContractVersion = bridge-task-v1
multipleOutputs = true
zeroFileResults = true
outputRootGuard = true
```

不支持时明确拒绝，不允许创建失败后静默改用 V0 重发。
