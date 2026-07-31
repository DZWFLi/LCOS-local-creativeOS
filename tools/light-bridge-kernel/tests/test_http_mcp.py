from __future__ import annotations

import json

from fastapi.testclient import TestClient

from lcos_bridge.core.errors import BridgeError
from lcos_bridge.settings import assert_loopback_host
from lcos_bridge.transport.http_api import create_app
from tests.helpers import make_analyze_envelope, make_analyze_result, make_create_envelope


def _rpc(client: TestClient, method: str, params: dict, request_id: int = 1):
    return client.post(
        "/mcp",
        json={"jsonrpc": "2.0", "id": request_id, "method": method, "params": params},
    )


def test_non_loopback_rejected():
    try:
        assert_loopback_host("0.0.0.0")
    except BridgeError as error:
        assert error.code == "NON_LOOPBACK_BIND_REJECTED"
    else:
        raise AssertionError("0.0.0.0 should be rejected")


def test_health_advertises_output_intent_contract(service):
    client = TestClient(create_app(service))
    value = client.get("/health").json()
    assert value["primaryContractVersion"] == "bridge-task-v1"
    assert value["multipleOutputs"] is True
    assert value["zeroFileResults"] is True
    assert value["outputRootGuard"] is True


def test_rest_analyze_zero_file_result(service):
    client = TestClient(create_app(service))
    envelope = make_analyze_envelope()
    created = client.post(
        "/v1/tasks", json=envelope.model_dump(mode="json", by_alias=True)
    )
    assert created.status_code == 201
    task_id = created.json()["task"]["taskId"]
    result = make_analyze_result(task_id)
    submitted = client.post(
        f"/v1/tasks/{task_id}/result",
        json=result.model_dump(mode="json", by_alias=True),
    )
    assert submitted.status_code == 200
    assert submitted.json()["task"]["result"]["changedFiles"] == []


def test_mcp_create_and_lookup_v1(service):
    client = TestClient(create_app(service))
    init = _rpc(client, "initialize", {"protocolVersion": "2025-03-26"})
    assert init.status_code == 200

    envelope = make_create_envelope()
    args = {"envelope": envelope.model_dump(mode="json", by_alias=True)}
    created = _rpc(client, "tools/call", {"name": "create_task", "arguments": args}, 2)
    text = created.json()["result"]["content"][0]["text"]
    task = json.loads(text)
    assert task["ok"] is True
    assert task["lcos_run_id"] == "run-create-1"
    assert task["output_intent"] == "create"

    looked_up = _rpc(
        client,
        "tools/call",
        {
            "name": "get_task_by_lcos_run_id",
            "arguments": {"lcos_run_id": "run-create-1"},
        },
        3,
    )
    value = json.loads(looked_up.json()["result"]["content"][0]["text"])
    assert value["task_id"] == task["task_id"]


def test_mcp_does_not_accept_v0_create(service):
    client = TestClient(create_app(service))
    envelope = make_create_envelope().model_dump(mode="json", by_alias=True)
    envelope["contractVersion"] = "bridge-task-v0"
    created = _rpc(
        client,
        "tools/call",
        {"name": "create_task", "arguments": {"envelope": envelope}},
        4,
    )
    value = json.loads(created.json()["result"]["content"][0]["text"])
    assert value["ok"] is False
    assert value["error"]["code"] == "VALIDATION_ERROR"
