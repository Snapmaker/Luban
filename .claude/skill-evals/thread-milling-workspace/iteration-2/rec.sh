#!/bin/bash
# rec.sh <agentId> <tokens> <ms> <tool_uses>
cd "$(dirname "$0")"; read -r _ e m < <(grep "^$1 " agent-map.txt); echo "{\"total_tokens\":$2,\"duration_ms\":$3,\"tool_uses\":$4}" > "$e/$m/run-1/timing.json"; echo "$e/$m"; for c in opus sonnet haiku; do [ -f "$e/$c/run-1/timing.json" ] || exit 0; done; echo "ALL3 $e"
