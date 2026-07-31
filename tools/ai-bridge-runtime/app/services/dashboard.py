"""
AI Bridge — Read-only dashboard service
"""
from __future__ import annotations

from collections import Counter
from datetime import datetime, timezone

from app.repositories.artifacts import ArtifactRepository
from app.repositories.metrics import MetricRepository
from app.repositories.sessions import SessionRepository
from app.repositories.tasks import TaskRepository
from app.services.health import HealthService
from app.validators import v3_status


class DashboardService:
    def __init__(
        self,
        health: HealthService,
        tasks: TaskRepository,
        sessions: SessionRepository,
        artifacts: ArtifactRepository,
        metrics: MetricRepository,
    ):
        self.health = health
        self.tasks = tasks
        self.sessions = sessions
        self.artifacts = artifacts
        self.metrics = metrics

    @staticmethod
    def _parse_iso(value: str | None) -> datetime | None:
        if not value or not isinstance(value, str):
            return None
        try:
            return datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError:
            return None

    def _session_health_summary(self, sessions: list[dict]) -> dict:
        now = datetime.now(timezone.utc)
        active = 0
        idle = 0
        stale = 0
        for session in sessions:
            if session.get("status") != "active":
                continue
            last_used = self._parse_iso(session.get("last_used_at")) or self._parse_iso(session.get("created_at"))
            if not last_used:
                idle += 1
                continue
            delta_seconds = (now - last_used.astimezone(timezone.utc)).total_seconds()
            if delta_seconds <= 1800:
                active += 1
            elif delta_seconds <= 86400:
                idle += 1
            else:
                stale += 1
        return {
            "total": len(sessions),
            "active": active,
            "idle": idle,
            "stale": stale,
        }

    @staticmethod
    def _top_projects(tasks: list[dict]) -> list[dict]:
        counts: Counter[str] = Counter()
        running: Counter[str] = Counter()
        review: Counter[str] = Counter()
        for task in tasks:
            project_id = task.get("project_id") or "unknown"
            counts[project_id] += 1
            status = v3_status(task.get("status", "unknown"))
            if status == "running":
                running[project_id] += 1
            if status == "review":
                review[project_id] += 1
        rows = []
        for project_id, total in counts.most_common(8):
            rows.append(
                {
                    "project_id": project_id,
                    "tasks_total": total,
                    "running": running.get(project_id, 0),
                    "review": review.get(project_id, 0),
                }
            )
        return rows

    @staticmethod
    def _artifact_breakdown(artifacts: list[dict]) -> list[dict]:
        type_counts: Counter[str] = Counter()
        project_counts: Counter[str] = Counter()
        for artifact in artifacts:
            type_counts[artifact.get("type") or "unknown"] += 1
            project_counts[artifact.get("project_id") or "unknown"] += 1
        return {
            "by_type": [
                {
                    "type": artifact_type,
                    "count": count,
                }
                for artifact_type, count in type_counts.most_common(8)
            ],
            "by_project": [
                {
                    "project_id": project_id,
                    "count": count,
                }
                for project_id, count in project_counts.most_common(8)
            ],
        }

    def snapshot(self) -> dict:
        task_items = self.tasks.load_all().get("tasks", [])
        session_items = self.sessions.load_all().get("sessions", [])
        artifact_items = self.artifacts.load_all().get("artifacts", [])
        metric_items = self.metrics.load_all().get("metrics", [])

        status_counts = Counter(v3_status(task.get("status", "unknown")) for task in task_items)
        avg_duration = [
            item.get("execution_duration")
            for item in metric_items
            if isinstance(item.get("execution_duration"), (int, float))
        ]
        retry_total = sum(int(item.get("retry_count") or 0) for item in metric_items)

        latest_tasks = sorted(
            task_items,
            key=lambda item: item.get("updated_at") or item.get("created_at") or "",
            reverse=True,
        )[:12]
        review_tasks = [task for task in latest_tasks if task.get("status") == "review"][:8]
        latest_sessions = sorted(
            session_items,
            key=lambda item: item.get("last_used_at") or item.get("created_at") or "",
            reverse=True,
        )[:12]

        latest_artifacts = sorted(
            artifact_items,
            key=lambda item: item.get("created_at") or "",
            reverse=True,
        )[:12]

        return {
            "overview": {
                "tasks_total": len(task_items),
                "sessions_total": len(session_items),
                "artifacts_total": len(artifact_items),
                "metrics_total": len(metric_items),
                "status_counts": dict(status_counts),
            },
            "metrics_summary": {
                "avg_execution_seconds": round(sum(avg_duration) / len(avg_duration), 2) if avg_duration else None,
                "retry_total": retry_total,
            },
            "session_health": self._session_health_summary(session_items),
            "project_overview": self._top_projects(task_items),
            "artifact_breakdown": self._artifact_breakdown(artifact_items),
            "health": self.health.check(),
            "tasks": latest_tasks,
            "review_queue": review_tasks,
            "sessions": latest_sessions,
            "artifacts": latest_artifacts,
            "metrics": metric_items[-12:],
        }
