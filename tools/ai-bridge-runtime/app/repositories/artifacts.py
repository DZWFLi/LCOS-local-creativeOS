from __future__ import annotations

from app.runtime.storage import RuntimeStorage


class ArtifactRepository:
    def __init__(self, storage: RuntimeStorage):
        self.storage = storage

    def load_all(self) -> dict:
        return self.storage.get_artifacts()

    def save_all(self, data: dict) -> None:
        self.storage.save_artifacts(data)

    def list_by_task(self, task_id: str) -> list[dict]:
        return [a for a in self.load_all().get("artifacts", []) if a.get("task_id") == task_id]
