"""
AI Bridge — Schemas Layer
Shared constructors for runtime records.
"""
from __future__ import annotations


def new_session(
    *,
    session_id: str,
    project_id: str,
    agent: str,
    now: str,
    inbox_dir: str = "",
    conversation_id=None,
    status: str = "active",
    meta=None,
) -> dict:
    return {
        "session_id": session_id,
        "project_id": project_id,
        "agent": agent,
        "status": status,
        "conversation_id": conversation_id,
        "inbox_dir": inbox_dir,
        "created_at": now,
        "updated_at": now,
        "last_used_at": now,
        "last_heartbeat_at": None,
        "meta": meta or {},
    }


def new_task(
    *,
    task_id: str,
    project_id: str,
    session_id: str,
    assignee: str,
    task_type: str,
    capability: str,
    report_mode: str,
    instruction: str,
    context: dict,
    acceptance_criteria: list,
    input_files: list,
    expected_outputs: list,
    priority: str,
    timeout_seconds,
    now: str,
    contract_version: str | None = None,
    lcos_run_id: str | None = None,
    idempotency_key: str | None = None,
    request_fingerprint: str | None = None,
    runtime_input_pack_path: str | None = None,
) -> dict:
    task = {
        "task_id": task_id,
        "project_id": project_id,
        "session_id": session_id,
        "created_by": "codex",
        "executor": assignee,
        "assignee": assignee,
        "task_type": task_type,
        "capability": capability,
        "status": "queued",
        "priority": priority,
        "report_mode": report_mode,
        "instruction": instruction,
        "context": context,
        "acceptance_criteria": acceptance_criteria,
        "input_files": input_files,
        "expected_outputs": expected_outputs,
        "result_summary": None,
        "short_summary": None,
        "changed_files": [],
        "milestone_report_path": None,
        "artifacts": [],
        "artifact_ids": [],
        "retry_count": 0,
        "retry_reason": None,
        "cancel_reason": None,
        "cancel_requested_at": None,
        "cancelled_at": None,
        "superseded_by_task_id": None,
        "supersedes_task_id": None,
        "superseded_at": None,
        "heartbeat": {"last_at": None, "source": None},
        "timeout_seconds": timeout_seconds,
        "dependencies": [],
        "error": None,
        "created_at": now,
        "updated_at": now,
        "queued_at": now,
        "assigned_at": None,
        "started_at": None,
        "reviewed_at": None,
        "completed_at": None,
    }
    if lcos_run_id is not None:
        task.update({
            "contract_version": contract_version,
            "lcos_run_id": lcos_run_id,
            "idempotency_key": idempotency_key,
            "request_fingerprint": request_fingerprint,
            "runtime_input_pack_path": runtime_input_pack_path,
        })
    return task


def new_task_created_message(
    *,
    task_id: str,
    project_id: str,
    session_id: str,
    task_type: str,
    capability: str,
    report_mode: str,
    instruction: str,
    timestamp: str,
) -> dict:
    return {
        "type": "task_created",
        "task_id": task_id,
        "project_id": project_id,
        "session_id": session_id,
        "task_type": task_type,
        "capability": capability,
        "report_mode": report_mode,
        "instruction": instruction,
        "timestamp": timestamp,
    }


def new_task_assigned_message(*, task_id: str, sender: str, timestamp: str) -> dict:
    return {
        "type": "task_assigned",
        "task_id": task_id,
        "from": sender,
        "timestamp": timestamp,
    }


def new_task_result_message(
    *,
    task_id: str,
    sender: str,
    status: str,
    result_summary: str,
    short_summary,
    changed_files: list,
    artifact_ids: list,
    artifacts: list,
    milestone_report_path,
    timestamp: str,
    is_v2_compat: bool,
) -> dict:
    return {
        "type": "task_result",
        "task_id": task_id,
        "from": sender,
        "status": status,
        "result_summary": result_summary,
        "short_summary": short_summary,
        "changed_files": changed_files,
        "artifact_ids": artifact_ids,
        "artifacts": artifacts,
        "milestone_report_path": milestone_report_path,
        "timestamp": timestamp,
        "_v2_compat": is_v2_compat,
    }


def new_task_review_result_message(
    *,
    task_id: str,
    decision: str,
    review_comment: str,
    timestamp: str,
) -> dict:
    return {
        "type": "task_review_result",
        "task_id": task_id,
        "from": "codex",
        "decision": decision,
        "review_comment": review_comment,
        "timestamp": timestamp,
    }


def finalize_artifact_record(
    artifact: dict,
    *,
    task_id: str,
    project_id: str,
    session_id: str,
    created_by: str,
    created_at: str,
) -> dict:
    record = dict(artifact)
    record["task_id"] = task_id
    record["project_id"] = project_id
    record["session_id"] = session_id
    record["created_by"] = created_by
    record["created_at"] = created_at
    return record
