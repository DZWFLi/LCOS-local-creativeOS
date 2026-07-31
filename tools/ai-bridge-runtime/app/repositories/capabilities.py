from __future__ import annotations

from pathlib import Path

from app.runtime.storage import RuntimeStorage


class CapabilityRepository:
    def __init__(self, storage: RuntimeStorage, registry_path: Path):
        self.storage = storage
        self.registry_path = registry_path

    def exists(self) -> bool:
        return self.registry_path.exists()

    def load(self) -> dict:
        return self.storage.load_json(self.registry_path, {"agents": []})

    def save(self, data: dict) -> None:
        self.storage.save_json(self.registry_path, data)
