"""
AI Bridge — Task metrics service
"""
from __future__ import annotations

from datetime import datetime

from app.repositories.metrics import MetricRepository


def _duration_seconds(start: str | None, end: str | None):
    if not start or not end:
        return None
    try:
        return max(0.0, (datetime.fromisoformat(end) - datetime.fromisoformat(start)).total_seconds())
    except ValueError:
        return None


class MetricService:
    def __init__(self, repository: MetricRepository):
        self.repository = repository

    def touch_task(self, task: dict) -> None:
        metric = {
            "task_id": task.get("task_id"),
            "project_id": task.get("project_id"),
            "created_at": task.get("created_at"),
            "completed_at": task.get("completed_at"),
            "retry_count": task.get("retry_count", 0),
            "execution_duration": _duration_seconds(task.get("started_at"), task.get("completed_at") or task.get("reviewed_at")),
            "tool_calls": None,
        }
        self.repository.upsert(metric)
