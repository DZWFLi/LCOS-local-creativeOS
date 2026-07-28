# 10 — Reference Feature Status

## Reference / Feedback MVP expression

Reference and Feedback are represented through existing entities:

```text
Artifact
ArtifactRevision
FileRecord
ArtifactView
Relation
Note
```

No new Domain type is required for the current MVP.

## Current sample mapping

| Concept | MVP representation | Status |
| --- | --- | --- |
| Brief | Markdown Artifact + FileRecord + Revision | Implemented |
| Script | Text Artifact + FileRecord + Revision | Implemented |
| Reference | Image Artifact + FileRecord + Revision | Implemented |
| Feedback | Markdown Artifact + FileRecord + Revision + Note | Implemented |
| Relationships | Existing Relation records | Implemented |
| Workspace placement | Existing ArtifactView records | Implemented |
| Identity display | Work Rail Runtime identity panel | Implemented |
| Preview status visibility | Read-only PreviewRecord API + Work Rail status | Implemented |
| Real content preview | Preview worker/rendering path | ADR proposed |

## What this proves

The MVP can show that project materials are not merely floating frontend Fixture nodes. They have Runtime-backed file identity and revision identity.

## What it does not prove

It does not yet prove:

- rich preview rendering;
- page-level PDF/PPT notes;
- external file observation;
- artifact return from execution.

## Preview status rule

The UI may show whether a PreviewRecord is:

- available;
- unsupported;
- failed;
- not yet generated.

Do not fake rendered file contents as Preview cache output.

Implementation must follow:

```text
docs/architecture/ADR_MVP_STAGE5_PREVIEW_WORKER_PLAN.md
```
