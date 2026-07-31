from __future__ import annotations

from app.runtime.storage import RuntimeStorage


class MetricRepository:
    def __init__(self, storage: RuntimeStorage):
        self.storage = storage

    def load_all(self) -> dict:
        return self.storage.get_metrics()

    def save_all(self, data: dict) -> None:
        self.storage.save_metrics(data)

    def upsert(self, metric: dict) -> None:
        data = self.load_all()
        items = data.setdefault("metrics", [])
        for index, existing in enumerate(items):
            if existing.get("task_id") == metric.get("task_id"):
                items[index] = metric
                self.save_all(data)
                return
        items.append(metric)
        self.save_all(data)
