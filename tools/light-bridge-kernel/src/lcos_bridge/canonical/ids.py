from __future__ import annotations

import hashlib
import json
import uuid
from typing import Any

TASK_NAMESPACE = uuid.UUID("2fb53fc5-6f3e-4a56-8f77-8e555ec12d21")


def canonical_json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def payload_fingerprint(value: Any) -> str:
    return hashlib.sha256(canonical_json(value).encode("utf-8")).hexdigest()


def task_id_for_run(lcos_run_id: str) -> str:
    return f"task-{uuid.uuid5(TASK_NAMESPACE, lcos_run_id)}"
