from __future__ import annotations

from fastapi.testclient import TestClient

from lcos_bridge.core.errors import BridgeError
from lcos_bridge.settings import assert_loopback_host
from lcos_bridge.transport.http_api import create_app
from tests.helpers import make_analyze_envelope, make_analyze_result


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
    created = client.post("/v1/tasks", json=envelope.model_dump(mode="json", by_alias=True))
    assert created.status_code == 201
    task_id = created.json()["task"]["taskId"]
    result = make_analyze_result(task_id)
    submitted = client.post(f"/v1/tasks/{task_id}/result", json=result.model_dump(mode="json", by_alias=True))
    assert submitted.status_code == 200
    assert submitted.json()["task"]["result"]["changedFiles"] == []


def test_bridge_has_no_public_mcp_surface(service):
    client = TestClient(create_app(service))
    response = client.post("/mcp", json={"jsonrpc": "2.0", "id": 1, "method": "initialize"})
    assert response.status_code == 404
