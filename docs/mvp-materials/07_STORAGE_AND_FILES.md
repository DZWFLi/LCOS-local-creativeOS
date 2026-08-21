# 07 — Storage and Files

## Current storage model

Local Core owns Project Truth in SQLite.

The current schema stores:

- Project
- Scope
- Workspace
- Artifact
- ArtifactView
- Relation
- Note
- Checkpoint
- FileRecord
- ArtifactRevision
- PreviewRecord cache metadata

SQLite does not store large BLOB content.

## MVP sample storage

The disposable sample project is created under:

```text
apps/local-core/.data/mvp-sample-project/
```

Sample files:

- `brief.md`
- `script.txt`
- `reference.png`
- `feedback.md`

These are dev sample files, not user files.

## Runtime identity

Each sample source file is represented as:

```text
FileRecord
→ ArtifactRevision
→ Artifact.currentRevisionId
→ ArtifactView
→ Web Canvas node
→ Work Rail Runtime identity panel
```

Stage 2 makes this identity visible without changing schema.

## Cache rule

Preview cache is disposable and rebuildable.

It is not Project Truth and must not be required for project restore.

## localStorage rule

Frontend `localStorage` may still hold demo/prototype UI state and project navigation state.

It must not silently migrate into Project Truth.

Runtime mode must remain distinguishable from Demo / Fixture mode.

## File safety

Current MVP fast-build does not:

- import arbitrary user files;
- move user files;
- overwrite user files;
- run a Watcher;
- auto-create ArtifactRevision from external change;
- write `.creative-os`.

All of those remain future red/yellow areas requiring separate approval.

