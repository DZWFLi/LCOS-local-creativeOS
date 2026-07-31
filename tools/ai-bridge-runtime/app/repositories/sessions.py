from __future__ import annotations

from app.runtime.storage import RuntimeStorage


class SessionRepository:
    def __init__(self, storage: RuntimeStorage):
        self.storage = storage

    def load_all(self) -> dict:
        return self.storage.get_sessions()

    def save_all(self, data: dict) -> None:
        self.storage.save_sessions(data)

    def find_by_id(self, session_id: str) -> dict | None:
        for session in self.load_all().get("sessions", []):
            if session.get("session_id") == session_id:
                return session
        return None
