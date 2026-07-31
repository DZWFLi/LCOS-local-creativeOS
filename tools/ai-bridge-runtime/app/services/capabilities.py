"""
AI Bridge — Capability service
"""
from __future__ import annotations

from pathlib import Path

from app.repositories.capabilities import CapabilityRepository
from app.runtime.storage import RuntimeStorage

REPORT_MODES = {"full", "short", "silent"}


class CapabilityService:
    def __init__(self, storage: RuntimeStorage, registry_path: Path, repository: CapabilityRepository):
        self.storage = storage
        self.registry_path = registry_path
        self.repository = repository

    def ensure_registry(self) -> None:
        if self.repository.exists():
            return
        default_registry = {
            "agents": [
                {
                    "agent_id": "workbuddy",
                    "capabilities": [
                        {"name": "code_refactor", "default_report_mode": "silent"},
                        {"name": "code_execution", "default_report_mode": "silent"},
                        {"name": "file_ops", "default_report_mode": "short"},
                        {"name": "research", "default_report_mode": "full"},
                        {"name": "document", "default_report_mode": "full"},
                        {"name": "presentation", "default_report_mode": "full"},
                    ],
                }
            ]
        }
        self.repository.save(default_registry)

    def get_registry(self) -> dict:
        self.ensure_registry()
        return self.repository.load()

    def default_report_mode(self, capability: str) -> str:
        capability = (capability or "").strip()
        if not capability:
            return "short"
        registry = self.get_registry()
        for agent in registry.get("agents", []):
            for item in agent.get("capabilities", []):
                if item.get("name") == capability:
                    mode = item.get("default_report_mode", "short")
                    if mode in REPORT_MODES:
                        return mode
        return "short"
