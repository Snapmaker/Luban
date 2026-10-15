# Agent guide to this repository

This is a fork of Snapmaker Luban. On top of the upstream app it adds an **MCP server inside the
Luban backend** that lets AI agents drive a connected Snapmaker machine (built and verified on an
A350 CNC), plus the agent skills that say how to use it safely. This file is the entry point; the
detail lives in the documents it links.

> **Health and safety.** The MCP server commands real motion. It is for operators who accept the
> risk of software-commanded motion; the machine is never left unattended while it runs, and the
> operator wears eye and hearing protection.

## Before anything that moves the machine

Load the **`cnc-motion-rules`** skill first, before planning, describing or reasoning about any
motion, position or coordinate. The rules in it are operator law, not model judgment: a tool
refusal is the rule catching you, so fix the plan and never work around it. Motion needs an
explicit instruction in the operator's latest message and then their click on the staged job's
confirm page in Luban; chat alone is not a gate.

## CNC evidence and persistent handoffs

Before modelling a cut or requesting more probing, read the
[measurement-evidence rules](.agents/skills/cnc-motion-rules/references/measurement-evidence.md).
Retrieve and reconcile existing surveys first. Never repeat a covered measurement merely
because an agent lost context. Estimates and unresolved contradictions cannot become cutting
inputs; a CAD/NC agreement using shared assumptions is not independent physical validation.
Handoffs and memories must retain evidence links, applicability, uncertainty and unresolved
contradictions, not bare axis/stock constants. These rules apply across chats and tool changes.

## Skills

The skills live in [`.agents/skills/`](.agents/skills/README.md). `.claude/skills` is a symlink to
the same directory, so Claude Code and Codex load identical files in this checkout.

| Skill | Load when |
|---|---|
| [`cnc-motion-rules`](.agents/skills/cnc-motion-rules/SKILL.md) | Always first, for any motion, position or coordinate question |
| [`cnc-probing`](.agents/skills/cnc-probing/SKILL.md) | Touch-probe measurement, surface scans, probe calibration |
| [`cnc-visual-alignment`](.agents/skills/cnc-visual-alignment/SKILL.md) | Camera frames, visual servo, locating stock or a datum |
| [`cnc-camera-operations`](.agents/skills/cnc-camera-operations/SKILL.md) | Camera inspection, remote saved frames, bootstrap and one-approval survey sequences |
| [`tool-change`](.agents/skills/tool-change/SKILL.md) | Swapping bits without re-touching the stock |
| [`cnc-thread-milling`](.agents/skills/cnc-thread-milling/SKILL.md) | Thread-milling exports, cutter setup, conversion and staging |

Outside this checkout, add the repo as a plugin marketplace to get the skills and the MCP server
together: `codex plugin marketplace add tyeth/Luban --ref startup/base`, then
`codex plugin add luban-cnc@luban` (the ChatGPT desktop app reads the same marketplace,
[`.agents/plugins/marketplace.json`](.agents/plugins/marketplace.json)).

## The MCP server

- It is part of Luban, not a separate program, and is **off by default**. When enabled it listens
  on `http://127.0.0.1:40889/mcp` (loopback only). HTTPS on port 40890 and LAN access are opt-in;
  LAN access has **no authentication**.
- Claude Code in this checkout connects through the root [`.mcp.json`](.mcp.json). Codex:
  `codex mcp add luban --url http://127.0.0.1:40889/mcp`, or install the plugin above.
- If the tools are missing or the connection is refused, Luban is not running, MCP is disabled, or
  the machine is not connected. Tell the operator and point them at the setup below. Do not reach
  the machine by other routes (raw sockets, backend requests, credential edits).

### First-time setup for a new user

1. Install this fork's Luban: the pre-releases on
   [tyeth/Luban releases](https://github.com/tyeth/Luban/releases), or build from source (below).
   Upstream Snapmaker releases do not contain the MCP server.
2. Close Luban, then preview and apply the setup helper from the repo root (Python 3.8+, standard
   library only; `py -3` on Windows):
   `python3 src/server/services/mcp/setup.py`, then the same with `--apply`. It enables MCP on
   port 40889 and backs up the config first. Alternatively turn it on in Luban under
   **Settings → MCP Server**.
3. Start Luban, connect the machine, and check the health panel on **Settings → MCP Server**.
4. Optional extras, each documented in the MCP README: a camera (ffmpeg device or snapshot URL),
   probe and tool-setter feeds (MQTT, or GPIO with `setup.py --blinka --apply`), and HTTPS for
   phones on the LAN (`setup.py --https --lan-ip <address>`).

## Where the documentation is

| Document | Holds |
|---|---|
| [`src/server/services/mcp/README.md`](src/server/services/mcp/README.md) | The engineering reference: configuration keys, installing, setup helper, HTTPS, job dashboard, camera stream, architecture, motion laws, safety model, machine facts, coordinate frames, tool surface, development workflow |
| [`src/server/services/mcp/docs/TOOLS.md`](src/server/services/mcp/docs/TOOLS.md) | Per-tool reference for every MCP tool |
| [`src/server/services/mcp/docs/`](src/server/services/mcp/docs/) | Topic guides: thread milling, probe inspection, workspaces, CAM probing posts, simulator spec |
| [`.agents/skills/README.md`](.agents/skills/README.md) | Skill load order and the rules every skill shares |

## Working on the code

- The MCP source is `src/server/services/mcp/`. Pull requests target **`startup/base`** on
  `tyeth/Luban`; nothing is pushed to `Snapmaker/Luban`.
- Commit subjects follow commitlint: `Type: Capitalised subject`, with Type one of Feature,
  Improvement, Fix, Refactor, Perf, Test, Build, Chore, Docs.
- Checks CI runs: `npm run lint`, `npm run typecheck:server`, `npm run typecheck:app`,
  `npm run typecheck:mcp`, `npm test`, `npm run test:mcp`.
- Building needs Node 16 and Python 3.11 for node-gyp. `gulp` exits 0 even when it fails, and the
  build modifies `src/package.json` and a `.jsx` file; revert those before committing. The
  "Development workflow" section of the MCP README has the details.
