from __future__ import annotations

from app.runtime.storage import RuntimeStorage


class MessageRepository:
    def __init__(self, storage: RuntimeStorage):
        self.storage = storage

    def load_messages(self) -> dict:
        return self.storage.get_messages()

    def save_messages(self, data: dict) -> None:
        self.storage.save_messages(data)

    def load_conversations(self) -> dict:
        return self.storage.get_conversations()

    def save_conversations(self, data: dict) -> None:
        self.storage.save_conversations(data)
