# Dry-run instructions (thread-milling skill eval, iteration 2)

You are a fresh agent planning work on a Snapmaker A350 CNC driven through the Luban MCP tools.
This is a DRY RUN. You produce a written plan; nothing moves.

## Hard limits

- Do NOT call any MCP tool (no luban*, freecad*, jumperless*, browser, or network tools). Do not invoke Skills.
- Do NOT ssh, curl, or contact 192.168.1.153 or any other host. No web search or fetch.
- Read only files inside the snapshot directory below, plus this file and your outputs directory.
  Do not read `.ts` source. Do NOT read `docs/thread-milling-evaluation.md`,
  `docs/thread-milling-evaluation-inventory.json`, any `evals/` folder, or anything under
  `.claude/skill-evals/` other than this file and the snapshot.

## What to read (snapshot of tyeth/Luban startup/base 52d189714)

Root: `C:\dev\software\snapmaker\Luban\.claude\worktrees\thread-cutter-evaluation-8d4f82\.claude\skill-evals\thread-milling-workspace\snapshot-52d1897\`

- `.claude/skills/cnc-motion-rules/SKILL.md` FIRST (and its `references/` when it points there)
- `.claude/skills/cnc-thread-milling/SKILL.md` and its `references/import.md`, `references/setup.md`
- `.claude/skills/tool-change/SKILL.md` and `.claude/skills/cnc-probing/SKILL.md` when relevant
- `src/server/services/mcp/docs/TOOLS.md`, `docs/thread-milling.md`, `docs/workspaces.md` as needed
- `src/server/services/mcp/README.md` (long; search it)
- `src/server/services/mcp/tests/fixtures/thread-milling-m2_5-fanuc.nc` (the operator's M2.5 program)

## Hypothetical tool results (fixtures, NOT current machine state)

- connection: connected A350 CNC over Wi-Fi
- position: verified, homed, idle, machine X-19 Y342 Z328; warnings empty; a work origin exists but its
  tool history is only as specified in the prompt
- tool: touch probe fitted unless the prompt states otherwise
- geometry: stored probe effectiveLength 71.3 — this is calibration, not a same-session tool-setter reading
- limits: machine motion floor Z320, park Z328
- setter: configured; its measurement history must be read before claiming reuse
- head: `connectedHead.toolHead` is withheld; `headType: cnc` and a compatible-head list do not settle it
- landmarks: a rotary landmark exists; read full-segment clearance requirements, do not invent them
- Anything else you need: name the call that returns it; do not invent the value.

## What to write

In your outputs directory (given in your prompt), write two files.

### `plan.md`

```
# Plan: <one line>

## Findings before anything moves
<one bullet each>

## Questions for the operator (one message)
<numbered list, or "none">

## Steps
1. <tool call with real arguments, or an operator action> [APPROVAL] if it stages a confirm page, [WAIT] if it waits on the operator
...
(`-- end turn --` on its own line wherever the turn ends; steps that depend on an answer come after it)

## Readiness
- Conversion declarations: <can tool_center_path / tool_length_applied truthfully be declared now? what must be true first?>
- Submission: <what must be true before any submit_gcode_job is staged?>

Counts: logical approvals=<n per executed branch, repeats multiplied, e.g. "2 tool changes x 4 + 6 jobs = 14">, literal [APPROVAL] tags=<n>, operator waits=<n>, questions=<n>
```

### `critique.md`

Short: what in the skills/docs helped, what was missing, unclear or contradictory for THIS task
(file + section), and what you had to guess.

Finish by replying with one line: the path of plan.md.
