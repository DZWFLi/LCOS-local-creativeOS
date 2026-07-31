"""
AI Bridge — Session service
"""
from __future__ import annotations

import uuid

from app.repositories.sessions import SessionRepository
from app.runtime.storage import RuntimeStorage
from app.schemas import new_session


class SessionService:
    def __init__(self, storage: RuntimeStorage, repository: SessionRepository):
        self.storage = storage
        self.repository = repository

    def create_session(self, project_id: str, agent: str = "workbuddy", inbox_dir: str = "") -> dict:
        session_id = f"session_{uuid.uuid4().hex[:8]}"
        now = self.storage.now()
        session = new_session(
            session_id=session_id,
            project_id=project_id,
            agent=agent,
            inbox_dir=inbox_dir,
            now=now,
        )
        data = self.repository.load_all()
        data.setdefault("sessions", []).append(session)
        self.repository.save_all(data)
        return session

    def get_session(self, session_id: str) -> dict | None:
        return self.repository.find_by_id(session_id)

    def list_sessions(self, project_id: str | None = None, status: str = "active") -> list[dict]:
        result = []
        for session in self.repository.load_all().get("sessions", []):
            if session.get("status") != status:
                continue
            if project_id and session.get("project_id") != project_id:
                continue
            result.append(session)
        return result

    def touch_session(self, session_id: str | None, now: str | None = None) -> None:
        if not session_id:
            return
        data = self.repository.load_all()
        timestamp = now or self.storage.now()
        changed = False
        for session in data.get("sessions", []):
            if session.get("session_id") == session_id:
                session["last_used_at"] = timestamp
                session["updated_at"] = timestamp
                changed = True
                break
        if changed:
            self.repository.save_all(data)

    def update_heartbeat(self, session_id: str) -> bool:
        data = self.repository.load_all()
        now = self.storage.now()
        for session in data.get("sessions", []):
            if session.get("session_id") == session_id:
                session["last_heartbeat_at"] = now
                session["last_used_at"] = now
                session["updated_at"] = now
                self.repository.save_all(data)
                return True
        return False

    def resolve_session(self, project_id: str, agent: str, requested_session_id: str) -> str:
        resolved = requested_session_id.strip()
        if resolved:
            existing = self.get_session(resolved)
            if existing:
                return resolved
            return self.create_session(project_id=project_id, agent=agent).get("session_id")
        for session in self.repository.load_all().get("sessions", []):
            if session.get("project_id") == project_id and session.get("agent") == agent and session.get("status") == "active":
                return session.get("session_id")
        return self.create_session(project_id=project_id, agent=agent).get("session_id")
