# 11 — Sample Project

## Identity

Project id:

```text
disposable-mvp-sample
```

Display name:

```text
LCOS MVP Sample
```

Sample root:

```text
apps/local-core/.data/mvp-sample-project/
```

## Files

| File | Role |
| --- | --- |
| `brief.md` | Source brief |
| `script.txt` | Working script |
| `reference.png` | Visual reference |
| `feedback.md` | Feedback notes |

## Graph shape

```text
Project
└─ Root Scope
   ├─ Workspace: Brief / Script
   ├─ Workspace: Reference / Feedback
   └─ Workspace: Handoff Review
      ├─ Artifact: Brief
      ├─ Artifact: Script
      ├─ Artifact: Reference
      └─ Artifact: Feedback
```

Relations:

```text
Reference → Brief
Brief → Script
Feedback → Script
```

## Expected Web behavior

- Web prefers this Runtime project when Local Core is online.
- Canvas shows sample nodes and relations.
- Selecting a sample node shows Runtime identity in Work Rail.
- Refresh should reload from Runtime graph.
- Existing sample data is not overwritten by startup seeding.

## Reset note

The seeder is idempotent: if the sample project exists, it does not overwrite it.

If a clean local sample is required later, delete the disposable local runtime data intentionally as a separate maintenance step. Do not use broad recursive deletion.

