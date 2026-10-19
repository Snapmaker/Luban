# Connection incident evidence

Collect `get_connection_status`, `get_position`, `get_mcp_diagnostics` and the raw reply from
`query_firmware_position` (M114) before recovery. M503 S via `query_firmware_configuration`
is a secondary check of currently used configuration. Empty text is not proof of liveness.

`get_mcp_diagnostics.connection` identifies the server instance, production build, HTTP
connection attempt and session. It includes heartbeat worker lifecycle, poll-start/response/report
timestamps and up to five snapshots captured automatically before recovery or connection changes.
`heartbeat_overdue` is emitted after ten seconds without an accepted status while polling is
expected; it does not require a subsequent beat. Explicit worker stops carry reasons; unexpected
worker completion/rejection is distinct. Command responses carry status/error codes and timing,
without request URLs, tokens or raw error messages.

On the installed Pi, persistent structured evidence is in
`~/.config/snapmaker-luban/Logs/connection-diagnostics.log` and its rotated siblings (three files,
5 MiB each). Existing lifecycle/MCP command output remains in `Logs/server.log`. The current
launch may additionally capture stdout/stderr in `/tmp/luban-launch.log`; verify the actual
running process's destination instead of assuming that filename. Log timestamps ending in Z
are UTC; UK time on September 28 is UTC+1. Preserve original timestamps.

If an operator's Connect action is missing from server logs, the existing renderer keeps its
last 50 diagnostic entries in local storage at `luban.connectionAttempts.v1`. Read that key
through existing developer/browser inspection, without opening a backend/socket connection.
Match its `attemptId` and acknowledged `serverInstanceId`/`serverBuild` to MCP. A record without
a server acknowledgement suggests a delivery/instance investigation, not expired machine
credentials. Missing records may reflect eviction or unavailable storage and do not disprove
an operator's action.

A status response indicating authentication-wait does not establish a visible touchscreen
prompt or invalidation/replacement of another saved token. `tokenPresent` and `tokenReturned`
are only booleans. Never inspect or print token values to establish session identity.

Use only `recover_machine_connection` to recover a retained session; it snapshots first,
checks status with the existing token, and never calls the pairing endpoint. If unavailable
or refused, report the limitation. Do not invent another connection route. After recovery,
require a new reliable position before motion; report the original cause as unknown if its
trace remains incomplete.
