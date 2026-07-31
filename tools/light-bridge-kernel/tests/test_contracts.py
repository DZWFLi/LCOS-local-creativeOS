from __future__ import annotations

import pytest
from pydantic import ValidationError

from lcos_bridge.canonical.models import TaskEnvelopeV1
from tests.helpers import make_analyze_envelope, make_create_envelope, make_revise_envelope


def test_create_supports_multiple_declared_outputs():
    envelope = make_create_envelope(expected_count=2, max_files=5)
    assert len(envelope.expected_outputs) == 2
    assert envelope.output_intent == "create"


def test_create_requires_declared_or_additional_outputs():
    payload = make_create_envelope().model_dump(mode="json", by_alias=True)
    payload["expectedOutputs"] = []
    payload["outputPolicy"]["allowAdditionalFiles"] = False
    with pytest.raises(ValidationError):
        TaskEnvelopeV1.model_validate(payload)


def test_revise_contract_is_one_modified_output():
    envelope = make_revise_envelope()
    assert envelope.output_policy.max_files == 1
    assert envelope.expected_outputs[0].action == "modified"


def test_analyze_requires_zero_file_permission():
    payload = make_analyze_envelope().model_dump(mode="json", by_alias=True)
    payload["outputPolicy"]["allowZeroFiles"] = False
    with pytest.raises(ValidationError):
        TaskEnvelopeV1.model_validate(payload)


def test_expected_output_cannot_escape_output_root():
    payload = make_create_envelope().model_dump(mode="json", by_alias=True)
    payload["expectedOutputs"][0]["absolutePath"] = "C:\\outside\\bad.md"
    with pytest.raises(ValidationError):
        TaskEnvelopeV1.model_validate(payload)
