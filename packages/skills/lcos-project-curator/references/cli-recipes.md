# CLI 配方

所有命令默认 JSON 输出；诊断在 stderr。

## 读

```bash
lcos project list
lcos selection read <project>
lcos node read <project> <viewId>
lcos search "<query>" --project <project> --limit 10
lcos presentation show <project> <presentationId>
```

## 写

```bash
lcos node create-text --project <id> --scope <scopeId> --title "标题" --body "内容"
lcos node update-text --project <id> --artifact <artifactId> --body "新内容"
lcos curation apply --project <id> --json patch.json
lcos presentation patch <project> <presentationId> --json patch.json
```

## Curation Patch 示例

```json
{
  "schemaVersion": 0,
  "operationId": "curate-round-3",
  "projectId": "<id>",
  "scopeId": "<scopeId>",
  "createTexts": [
    { "clientRef": "summary-1", "title": "…", "body": "…" }
  ],
  "relations": [
    { "from": { "clientRef": "summary-1" }, "to": { "entityId": "<existing-view-or-artifact>" }, "label": "来源于", "origin": "agent", "createdBy": "codex", "confidence": 0.8 }
  ],
  "presentation": {
    "presentationId": "presentation:context:<scopeId>",
    "expectedVersion": <先 show 读取>,
    "addMembers": [{ "clientRef": "summary-1" }],
    "setEmphasis": { "summary-1": "primary" }
  }
}
```

## 注意

- presentation patch 前先 `presentation show` 读当前 version；STALE 时重读再 patch。
- 失败 receipt 会返回 `completedSteps` + `failedStep`，按失败步骤修正后重试（同 operationId 可重放）。
