"""
AI Bridge — Message / Conversation service
"""
from __future__ import annotations

import uuid

from app.repositories.messages import MessageRepository
from app.runtime.storage import RuntimeStorage


class MessageService:
    def __init__(self, storage: RuntimeStorage, repository: MessageRepository):
        self.storage = storage
        self.repository = repository

    def send_message(self, *, target: str, message: str, sender: str) -> str:
        target = target.lower().strip()
        sender = sender.lower().strip()
        if target not in ("codex", "workbuddy"):
            raise ValueError(f"target 必须是 'codex' 或 'workbuddy'，收到: {target}")
        if sender not in ("codex", "workbuddy"):
            raise ValueError(f"sender 必须是 'codex' 或 'workbuddy'，收到: {sender}")
        if sender == target:
            raise ValueError("不能给自己发消息")

        conv_id = str(uuid.uuid4())[:8]
        now = self.storage.now()
        convs = self.repository.load_conversations()
        convs[conv_id] = {
            "id": conv_id,
            "from": sender,
            "to": target,
            "title": message[:60] + ("..." if len(message) > 60 else ""),
            "created_at": now,
            "updated_at": now,
            "status": "open",
            "history": [{"role": sender, "content": message, "timestamp": now}],
        }
        self.repository.save_conversations(convs)
        msgs = self.repository.load_messages()
        msgs.setdefault(target, []).append(
            {
                "type": "new",
                "conversation_id": conv_id,
                "from": sender,
                "message": message,
                "timestamp": now,
            }
        )
        self.repository.save_messages(msgs)
        return conv_id

    def respond(self, *, conversation_id: str, response: str, sender: str) -> None:
        sender = sender.lower().strip()
        if sender not in ("codex", "workbuddy"):
            raise ValueError(f"sender 必须是 'codex' 或 'workbuddy'，收到: {sender}")
        convs = self.repository.load_conversations()
        if conversation_id not in convs:
            raise KeyError(conversation_id)
        conv = convs[conversation_id]
        now = self.storage.now()
        conv["history"].append({"role": sender, "content": response, "timestamp": now})
        conv["updated_at"] = now
        conv["status"] = "open"
        self.repository.save_conversations(convs)
        msgs = self.repository.load_messages()
        msgs.setdefault(conv["from"], []).append(
            {
                "type": "reply",
                "conversation_id": conversation_id,
                "from": sender,
                "message": response,
                "timestamp": now,
            }
        )
        self.repository.save_messages(msgs)

    def get_messages(self, *, target: str) -> list[dict]:
        target = target.lower().strip()
        if target not in ("codex", "workbuddy"):
            raise ValueError(f"target 必须是 'codex' 或 'workbuddy'，收到: {target}")
        return self.repository.load_messages().get(target, [])

    def ack_messages(self, *, target: str, conversation_id: str | None = None) -> int:
        target = target.lower().strip()
        if target not in ("codex", "workbuddy"):
            raise ValueError(f"target 必须是 'codex' 或 'workbuddy'，收到: {target}")
        msgs = self.repository.load_messages()
        if target not in msgs:
            return 0
        if conversation_id:
            before = len(msgs[target])
            msgs[target] = [m for m in msgs[target] if m.get("conversation_id") != conversation_id]
            cleared = before - len(msgs[target])
        else:
            cleared = len(msgs[target])
            msgs[target] = []
        self.repository.save_messages(msgs)
        return cleared

    def get_conversation(self, conversation_id: str) -> dict | None:
        return self.repository.load_conversations().get(conversation_id)

    def list_conversations(self, *, target: str | None = None, status: str = "open") -> list[tuple[str, dict]]:
        convs = self.repository.load_conversations()
        result = []
        for cid, conversation in convs.items():
            if conversation.get("status") != status:
                continue
            if target and conversation.get("to") != target and conversation.get("from") != target:
                continue
            result.append((cid, conversation))
        return result

    def close_conversation(self, conversation_id: str) -> bool:
        convs = self.repository.load_conversations()
        if conversation_id not in convs:
            return False
        convs[conversation_id]["status"] = "closed"
        convs[conversation_id]["updated_at"] = self.storage.now()
        self.repository.save_conversations(convs)
        return True
