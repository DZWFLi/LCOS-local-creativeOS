from __future__ import annotations

import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import app.runtime.storage as storage_module
from app.runtime.storage import RuntimeStorage


class PurifiedBaselineTests(unittest.TestCase):
    def tearDown(self):
        storage_module._DEFAULT_STORAGE = None

    def test_runtime_storage_requires_explicit_root(self):
        with self.assertRaises(ValueError):
            RuntimeStorage()

    def test_default_storage_requires_environment_configuration(self):
        storage_module._DEFAULT_STORAGE = None
        with patch.dict(os.environ, {}, clear=True):
            with self.assertRaises(RuntimeError):
                storage_module.get_default_storage()

    def test_default_storage_uses_configured_disposable_root(self):
        storage_module._DEFAULT_STORAGE = None
        with tempfile.TemporaryDirectory() as tempdir:
            with patch.dict(
                os.environ,
                {"AI_BRIDGE_RUNTIME_ROOT": tempdir},
                clear=True,
            ):
                runtime = storage_module.get_default_storage()
                self.assertEqual(runtime.root, Path(tempdir).resolve())


if __name__ == "__main__":
    unittest.main()
