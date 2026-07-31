from __future__ import annotations

from app.validators import v3_status


def normalize_submit_status(status: str) -> tuple[str, bool]:
    status_normalized = (status or "").lower().strip()
    if status_normalized == "completed":
        return "review", True
    return status_normalized, False


def allow_submit_from_status(task_status: str) -> bool:
    current = v3_status(task_status)
    return current in ("running", "assigned", "queued", "created") or task_status == "in_progress"
