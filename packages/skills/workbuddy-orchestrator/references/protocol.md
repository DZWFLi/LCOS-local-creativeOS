# Protocol Reference

## Mission

Codex is the orchestrator.
WorkBuddy is the executor.
AI Bridge is the task and state layer.
watcher is the near-real-time router and claimer.

## Minimal Verified Loop

1. Codex preprocesses the request.
2. Codex chooses the correct `project_id`.
3. Codex calls `create_task(...)`.
4. watcher claims and routes the task into the mapped project inbox.
5. WorkBuddy executes from the project inbox context.
6. WorkBuddy submits the result.
7. Codex reviews artifacts and acceptance criteria.

## Routing Rule

`project_id` is not bookkeeping only.

It determines which `.workbuddy` inbox receives the task through `watcher_config.json`.
If `project_id` is wrong, the task may be valid in Bridge but land in the wrong project context.

## Never Do

- never replace WorkBuddy with a Codex thread
- never ask the user to manually forward the task unless there is no bridge path
- never declare success from intent alone
- never collapse review into "looks fine" without checking artifacts
- never call the system fully automatic if chat wake-up still depends on product limits

## Reminder

If the bridge only exposes `pending`, `in_progress`, `completed`, `failed`, and `needs_revision`, report those actual states and do not pretend that richer state transitions already exist.

If watcher routing is part of the current production path, verify the inbox-side evidence as well as bridge-side evidence.
