from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor

import pytest

from lcos_bridge.canonical.ids import task_id_for_run
from lcos_bridge.core.errors import BridgeError
from tests.helpers import make_create_envelope


def test_task_id_is_deterministic():
    assert task_id_for_run("run-1") == task_id_for_run("run-1")
    assert task_id_for_run("run-1") != task_id_for_run("run-2")


def test_same_request_replays(service):
    first, first_replayed = service.create_task(make_create_envelope())
    second, second_replayed = service.create_task(make_create_envelope())
    assert first.task_id == second.task_id
    assert first_replayed is False
    assert second_replayed is True


def test_conflicting_fingerprint_rejected(service):
    service.create_task(make_create_envelope(fingerprint="fp-a"))
    with pytest.raises(BridgeError) as captured:
        service.create_task(make_create_envelope(fingerprint="fp-b"))
    assert captured.value.code == "IDEMPOTENCY_CONFLICT"


def test_conflicting_payload_rejected_even_with_same_fingerprint(service):
    original = make_create_envelope()
    service.create_task(original)
    changed = original.model_copy(update={"timeout_seconds": 901})
    with pytest.raises(BridgeError) as captured:
        service.create_task(changed)
    assert captured.value.code == "IDEMPOTENCY_CONFLICT"


def test_concurrent_create_produces_one_task(service):
    def create():
        return service.create_task(make_create_envelope())[0].task_id

    with ThreadPoolExecutor(max_workers=8) as executor:
        ids = list(executor.map(lambda _: create(), range(16)))
    assert len(set(ids)) == 1
