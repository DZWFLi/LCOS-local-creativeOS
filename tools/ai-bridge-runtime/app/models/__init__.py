"""
AI Bridge — Models Layer
Extracted from bridge_server.py for V4 directory structure.
"""
from __future__ import annotations

from pathlib import Path


def task_summary(task: dict) -> str:
    return (
        f"[{task['task_id']}] {task.get('status', '?')} "
        f"{task.get('assignee', '?')} · {task.get('task_type', '?')} · "
        f"{task.get('instruction', '')[:60]}"
    )


def upgrade_task(task: dict) -> dict:
    """将旧版任务字段升级到 V3/V4，保持向后兼容"""
    from app.validators import validate_report_mode, v3_status

    task["status"] = v3_status(task.get("status", "queued"))
    for field, default in {
        "session_id": None, "executor": None, "priority": "normal",
        "report_mode": None, "short_summary": None, "changed_files": [],
        "milestone_report_path": None, "timeout_seconds": None,
        "retry_count": 0, "retry_reason": None, "error": None,
        "cancel_reason": None, "cancel_requested_at": None, "cancelled_at": None,
        "superseded_by_task_id": None, "supersedes_task_id": None, "superseded_at": None,
        "artifact_ids": [], "heartbeat": {"last_at": None, "source": None},
        "dependencies": [],
        "contract_version": None, "lcos_run_id": None,
        "idempotency_key": None, "request_fingerprint": None,
        "runtime_input_pack_path": None,
    }.items():
        if field not in task:
            task[field] = default
    for ts_field in ("queued_at", "assigned_at", "started_at", "reviewed_at", "completed_at"):
        if ts_field not in task:
            task[ts_field] = None
    if task.get("executor") is None:
        task["executor"] = task.get("assignee", "workbuddy")
    task["report_mode"] = validate_report_mode(task.get("report_mode"))
    return task


def make_artifact_id() -> str:
    import uuid
    return f"art_{uuid.uuid4().hex[:8]}"


def normalize_artifacts(artifacts_input):
    """接受旧版纯路径数组或新版结构化数组，统一输出结构化数组"""
    if not artifacts_input:
        return [], ""
    if not isinstance(artifacts_input, list):
        return [], "artifacts 必须是数组"

    from app.validators import is_absolute_path, validate_artifact_type

    type_map = {
        "md": "document",
        "docx": "document",
        "pdf": "document",
        "pptx": "presentation",
        "xlsx": "spreadsheet",
        "csv": "spreadsheet",
        "png": "image",
        "jpg": "image",
        "jpeg": "image",
        "mp4": "video",
        "py": "code",
        "js": "code",
        "ts": "code",
    }
    result = []
    for item in artifacts_input:
        if isinstance(item, str):
            if not is_absolute_path(item):
                return [], f"artifact 路径必须是绝对路径: {item}"
            ext = Path(item).suffix.lstrip(".").lower()
            result.append({
                "artifact_id": make_artifact_id(),
                "type": type_map.get(ext, "document"),
                "name": Path(item).name,
                "path": item,
                "summary": "",
            })
            continue
        if not isinstance(item, dict):
            return [], "artifacts 数组只能包含字符串路径或对象"

        normalized = dict(item)
        normalized.setdefault("artifact_id", make_artifact_id())
        normalized.setdefault("summary", "")
        for field in ("artifact_id", "type", "name", "path", "summary"):
            if field not in normalized:
                return [], f"artifact 缺少字段: {field}"
        normalized["type"] = validate_artifact_type(normalized.get("type"))
        if not is_absolute_path(normalized["path"]):
            return [], f"artifact.path 必须是绝对路径: {normalized['path']}"
        result.append(normalized)
    return result, ""
