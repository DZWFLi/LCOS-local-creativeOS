"""
AI Bridge — Artifact service
"""
from __future__ import annotations

from pathlib import Path

from app.models import normalize_artifacts
from app.repositories.artifacts import ArtifactRepository
from app.runtime.storage import RuntimeStorage
from app.schemas import finalize_artifact_record


class ArtifactService:
    def __init__(self, storage: RuntimeStorage, repository: ArtifactRepository):
        self.storage = storage
        self.repository = repository

    def validate_artifacts(self, raw_artifacts):
        return normalize_artifacts(raw_artifacts)

    def create_artifacts(
        self,
        raw_artifacts,
        *,
        task_id: str,
        project_id: str,
        session_id: str,
        created_by: str,
        created_at: str,
    ):
        structured, error = self.validate_artifacts(raw_artifacts)
        if error:
            return [], error

        finalized = [
            finalize_artifact_record(
                artifact,
                task_id=task_id,
                project_id=project_id,
                session_id=session_id,
                created_by=created_by,
                created_at=created_at,
            )
            for artifact in structured
        ]
        if finalized:
            data = self.repository.load_all()
            data.setdefault("artifacts", []).extend(finalized)
            self.repository.save_all(data)
        return finalized, ""

    def list_artifacts(self, task_id: str) -> list[dict]:
        return self.repository.list_by_task(task_id)

    def audit_artifacts(self) -> dict:
        stats = {
            "total": 0,
            "invalid": 0,
            "missing_session_id": 0,
            "legacy_path": 0,
        }
        for artifact in self.repository.load_all().get("artifacts", []):
            stats["total"] += 1
            if not artifact.get("session_id"):
                stats["missing_session_id"] += 1
                stats["invalid"] += 1
            path = artifact.get("path", "")
            if path and not Path(path).is_absolute():
                stats["legacy_path"] += 1
                stats["invalid"] += 1
        return stats
