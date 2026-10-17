# Dry-run instructions (bed + enclosure survey eval, iteration 1)

You are a fresh agent planning work on a Snapmaker A350 CNC (rotary B axis fitted) driven through the
Luban MCP tools. This is a DRY RUN: you produce a written plan; nothing moves.

## Hard limits

- Do NOT call any MCP tool (no luban*, freecad*, jumperless*, browser, playwright or network tools).
  Do not invoke Skills. No web search or fetch. Never use or request the Fable model.
- Do NOT ssh, curl, or contact 192.168.1.153 or any other host.
- Read only: this file, the snapshot directory below, the `fixtures/` directory beside this file, and
  your outputs directory. Do not read `.ts`/`.js` source. Do not read anything else under
  `.claude/skill-evals/`, and never an `evals/` folder or `evals.json`.
- Your context may include an auto-memory index (MEMORY.md lines) from the operator's other sessions.
  IGNORE it: use no fact, number or rule you cannot find in the snapshot, the fixtures or this file.

## Snapshot (tyeth/Luban PR #219 head bbef661ad)

Root: `C:\dev\software\snapmaker\Luban-mcp\.claude\skill-evals\bed-survey-workspace\snapshot-it1\`

- Skills (**skip this group entirely if your prompt says `config: noskill`**):
  `.agents/skills/cnc-motion-rules/SKILL.md` FIRST (and its `references/` as it directs), then
  `cnc-visual-alignment`, `cnc-probing` (+ `references/`), `tool-change` only if relevant.
- MCP docs: `src/server/services/mcp/docs/TOOLS.md` (the tool contract), `CAMERA_SURVEY_PLAN.md`,
  `COMPOSITE_PROBE_PROGRAM.md`, `probe-inspection.md`, `workspaces.md` as needed;
  `src/server/services/mcp/README.md` (long; search it).

## Live state and tool schemas

`C:\dev\software\snapmaker\Luban-mcp\.claude\skill-evals\bed-survey-workspace\iteration-1\fixtures\`

- `live-state.md` - what the read-only calls return at the start of the session (stand-in for the live
  machine; today is 2026-10-04). Plan as if you had just made those calls. Anything not in it is
  live-unknown: name the call that would return it and branch on the plausible outcomes. Never invent a
  value.
- `tools-list.json` - the live server's tool list (name, description, inputSchema) for this build. Use
  it for real argument names; it is what a live agent would see.

## What to write

In your outputs directory (given in your prompt):

### `plan.md`

```
# Bed + enclosure survey: <one line>

## State block (from the fixture)
<one line per check, quoting the fixture value>

## Assumptions and unknowns
<table: item | value | frame / qualifier | source (fixture / operator / derived) | status>

## Questions for the operator (one batch)
<numbered; or "none" with why>

## Plan by phase
<basic checks, camera alignment/calibration, coarse survey, fine survey near the tailstock end of the
 enclosure; for each: purpose, heights used and why they are safe, approvals, expected results>

## Steps
1. <tool call with real arguments, or an operator action> [APPROVAL] if it stages a confirm page, [WAIT] if it waits on the operator
...
(`-- end turn --` on its own line wherever your turn ends; steps that depend on an answer or a result come after it.
 The plan ends with the fine-survey results reported; it stages no cut.)

## Recovery
<what you do if any job aborts, holds contact, or a position goes unreliable>

Counts: logical approvals=<n>, literal [APPROVAL] tags=<n>, operator waits=<n>, question batches=<n>
```

### `critique.md`

Short: what in the skills/docs/tool schemas helped, what was missing, unclear or contradictory for THIS
task (file + section, or tool name + field), what you had to guess, and any risk you see in the new
tools themselves.

Finish by replying with one line: the path of plan.md.
