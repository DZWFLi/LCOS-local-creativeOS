from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from .core.errors import BridgeError

LOOPBACK_HOSTS = {"127.0.0.1", "localhost", "::1"}


@dataclass(frozen=True)
class BridgeSettings:
    runtime_root: Path
    host: str = "127.0.0.1"
    port: int = 43122

    @classmethod
    def from_env(
        cls,
        runtime_root: str | Path | None = None,
        host: str = "127.0.0.1",
        port: int = 43122,
    ) -> "BridgeSettings":
        raw = runtime_root or os.getenv("LCOS_BRIDGE_RUNTIME_ROOT")
        if not raw:
            raise BridgeError(
                "RUNTIME_ROOT_UNSET",
                "LCOS_BRIDGE_RUNTIME_ROOT or --runtime-root is required.",
                retryable=False,
                http_status=400,
            )
        assert_loopback_host(host)
        root = Path(raw).expanduser().resolve()
        root.mkdir(parents=True, exist_ok=True)
        return cls(runtime_root=root, host=host, port=port)

    @property
    def database_path(self) -> Path:
        return self.runtime_root / "bridge.sqlite3"


def assert_loopback_host(host: str) -> None:
    if host not in LOOPBACK_HOSTS:
        raise BridgeError(
            "NON_LOOPBACK_BIND_REJECTED",
            f"Bridge may only bind to loopback, got {host!r}.",
            retryable=False,
            http_status=400,
        )
