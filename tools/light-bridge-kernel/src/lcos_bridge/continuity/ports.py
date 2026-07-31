from __future__ import annotations

from typing import Protocol

from ..canonical.models import ConversationRef, ConversationSnapshot


class SessionContinuityAdapter(Protocol):
    """Optional plane. It must not mutate Bridge task lifecycle."""

    def list_sessions(self, project_root: str | None = None) -> tuple[ConversationRef, ...]: ...

    def attach(self, external_session_id: str) -> ConversationRef: ...

    def capture_snapshot(self, conversation: ConversationRef) -> ConversationSnapshot: ...

    def prepare_resume(self, conversation: ConversationRef) -> dict[str, object]: ...
