# Security

## Hard boundaries

- Bind only to `127.0.0.1`.
- Set `AI_BRIDGE_RUNTIME_ROOT` explicitly.
- Do not store Runtime state inside an LCOS Project.
- Do not commit tokens, passwords, cookies, MCP authorization or `.env` files.
- Do not import `runtime-snapshot` data into a demo Runtime.
- Do not expose absolute paths to the browser.
- Validate returned paths in the future LCOS Adapter with Project Path Guard.
- Run only one Bridge server process per Runtime Root.
- Health output must not expose the Runtime Root or individual storage paths.
- Do not log RuntimeInputPack content, Task context, credentials or authorization
  headers in normal operation.

## Research-package incident

The reviewed migration ZIP contained a private worker credential despite its
sanitization note. That file and value are intentionally absent here.

The original credential must be rotated before that worker is reused. Rotation
is an external operational action and was not performed by this source import.

## Packaging denylist

```text
.token_private.json
*_private.json
*.token
.env
.env.*
runtime-snapshot/
runtime/
__pycache__/
*.pyc
worker-registry.json
watcher_config.json
```
