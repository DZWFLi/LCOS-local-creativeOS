"""
AI Bridge — Validators Layer
Extracted from bridge_server.py for V4 directory structure.
"""
from __future__ import annotations

from pathlib import Path

_V3_STATES = {"created", "queued", "assigned", "running", "review", "completed", "failed", "timeout", "retrying", "cancelled"}
_WB_CAN_SET = {"review", "failed", "timeout"}
_CODEX_CAN_SET = {"completed", "retrying", "cancelled"}
_ARTIFACT_TYPES = {"document", "presentation", "image", "video", "code", "spreadsheet", "report", "log"}
_REPORT_MODES = {"full", "short", "silent"}
_EXPECTED_OUTPUT_ENUM = {"markdown", "document", "presentation", "spreadsheet", "code", "image", "video", "report", "log"}

# ---- 兼容旧状态映射 ----
_V2_TO_V3 = {
    "pending": "queued",
    "in_progress": "running",
    "completed": "completed",
    "failed": "failed",
    "needs_revision": "review",
}

_V3_TO_V2 = {
    "created": "pending", "queued": "pending", "assigned": "pending",
    "running": "in_progress", "review": "in_progress",
    "completed": "completed", "failed": "failed",
    "timeout": "failed", "retrying": "pending", "cancelled": "failed",
}

_V3_TO_STORAGE = {
    "created": "pending", "queued": "pending", "assigned": "pending",
    "running": "in_progress", "review": "in_progress",
    "completed": "completed", "failed": "failed",
    "timeout": "failed", "retrying": "pending", "cancelled": "failed",
}


def v3_status(v2_status: str) -> str:
    if v2_status in _V3_STATES:
        return v2_status
    return _V2_TO_V3.get(v2_status, "queued")


def normalize_assignee(value: str) -> str:
    value = (value or "").lower().strip()
    if value not in ("codex", "workbuddy"):
        raise ValueError(f"assignee 必须是 'codex' 或 'workbuddy'，收到: {value}")
    return value


def validate_priority(value: str) -> str:
    valid = {"low", "normal", "high", "urgent"}
    return value if value in valid else "normal"


def validate_report_mode(value: str) -> str:
    if value and value in _REPORT_MODES:
        return value
    return "short"


def validate_artifact_type(value: str) -> str:
    if value in _ARTIFACT_TYPES:
        return value
    return "document"


def is_absolute_path(value: str) -> bool:
    return bool(value) and Path(value).is_absolute()


def validate_changed_files(changed_files_input):
    if not changed_files_input:
        return [], ""
    if not isinstance(changed_files_input, list):
        return [], "changed_files 必须是 JSON 数组"

    result = []
    allowed_actions = {"created", "modified", "deleted", "moved"}
    for item in changed_files_input:
        if isinstance(item, str):
            if not is_absolute_path(item):
                return [], f"changed_files.path 必须是绝对路径: {item}"
            result.append({"path": item, "action": "modified"})
            continue
        if not isinstance(item, dict):
            return [], "changed_files 只能包含字符串路径或对象"

        path = item.get("path", "")
        action = item.get("action", "modified")
        if not is_absolute_path(path):
            return [], f"changed_files.path 必须是绝对路径: {path}"
        if action not in allowed_actions:
            return [], f"changed_files.action 无效: {action}"
        result.append({"path": path, "action": action})
    return result, ""


def validate_json_payload_types(expected_outputs, input_files, acceptance_criteria, context) -> tuple[bool, str]:
    if not isinstance(expected_outputs, list):
        return False, "expected_outputs 必须是数组"
    if not isinstance(input_files, list):
        return False, "input_files 必须是数组"
    if not isinstance(acceptance_criteria, list):
        return False, "acceptance_criteria 必须是数组"
    if not isinstance(context, dict):
        return False, "context 必须是对象"
    return True, ""
