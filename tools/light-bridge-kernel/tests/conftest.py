from __future__ import annotations

import pytest

from lcos_bridge.core.service import BridgeService
from lcos_bridge.core.store import SQLiteTaskStore


@pytest.fixture()
def service(tmp_path):
    return BridgeService(SQLiteTaskStore(tmp_path / "bridge.sqlite3"))
