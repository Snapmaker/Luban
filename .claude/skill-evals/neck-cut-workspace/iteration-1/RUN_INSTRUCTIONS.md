# Dry-run instructions (rotary neck-cut scenario eval, iteration 1)

You are a fresh agent planning work on a Snapmaker A350 CNC (with rotary B axis) driven through the
Luban MCP tools. This is a DRY RUN: you produce a written assessment and plan; nothing moves.

## Hard limits

- Do NOT call any MCP tool (no luban*, freecad*, jumperless*, browser, playwright or network tools).
  Do not invoke Skills. No web search or fetch.
- Do NOT ssh, curl, or contact 192.168.1.153 or any other host.
- Read only files inside the snapshot directory below, plus this file and your outputs directory.
  Do not read `.ts` source. Do not read anything under `.claude/skill-evals/` other than this file
  and the snapshot. Do not read any `evals/` folder or `evals.json`.
- You MAY run local computation to build geometry: `python` (numpy is installed; shapely is not)
  and headless FreeCAD, `C:/dev/software/FreeCAD/bin/FreeCADCmd.exe -c "exec(open(r'<script>').read())"`
  (set `PYTHONDONTWRITEBYTECODE=1`; opening an .FCStd takes ~40 s; never the FreeCAD GUI).
  Write every script, copied model and generated file into YOUR outputs directory; never modify the
  snapshot. Copy an .FCStd into outputs before opening it if you intend to save.

## Snapshot (tyeth/Luban PR #202 branch at 1778779c0)

Root: `C:\dev\software\snapmaker\Luban\.claude\worktrees\pr-202-scenario-skills-eval-6e349c\.claude\skill-evals\neck-cut-workspace\snapshot-1778779\`

- The task: `docs/skills-evals/cnc-neck-cut-reassessment.md` (read it in full first)
- The prior agent's evidence: `docs/skills-evals/cnc-neck-cut-evidence/` (README, JSON, reference
  enclosure and review .FCStd files, macros, images; `PROVENANCE.md` explains what it is)
- Skills (**skip this group if your prompt says `config: noskill`**): `.claude/skills/cnc-motion-rules/SKILL.md`
  FIRST and its `references/work-datums.md`, then `cnc-probing` (+ `references/`), `cnc-visual-alignment`,
  `tool-change`, and `cnc-thread-milling` only if relevant
- MCP docs: `src/server/services/mcp/docs/TOOLS.md` (the tool contract), `workspaces.md`,
  `probe-inspection.md`, `COMPOSITE_PROBE_PROGRAM.md`, `post/` as needed; `src/server/services/mcp/README.md` (long; search it)

## Live state

There is no live machine in this run. The brief's evidence is dated 26-27 September; treat today as
2026-09-28 with the live state UNKNOWN. Wherever the task needs live state (position, tool, B angle,
workspace, probe feed, stored geometry, setter history, landmarks, MCP history of the cited job IDs),
name the exact call that returns it and branch on the plausible outcomes. Do not invent a value.

## What to write

In your outputs directory (given in your prompt):

### `plan.md`

```
# Neck-cut reassessment: <one line>

## Evidence ledger
<table: item | value | frame (machine toolhead Z / physical Z / CAD / work) | source | status (measured / nominal CAD / inferred / live-unknown)>

## Live-state re-read (before anything)
<numbered calls and what each must show>

## WCS
<choice, touchable vs derived, CAD and rotary-axis mapping per B, independent check, how it is set>

## Stock and fixture reconstruction
<registration, shell vs groove vs tenon vs jaws, open questions, bounded measurements proposed>

## Retained connections: four corner tabs vs two C
<method (how the 3D sweep / connectivity was checked), numbers for both, recommendation and why>

## Machining plan
<round 1 setups, round 2 setups; per setup: B, tool orientation, first entry, stepdown, links, exit, holder sweep>

## Release gate
<ordered checks before anything runnable>

## Remaining measurements and operator actions
<numbered>

## Steps
1. <tool call with real arguments, or an operator action> [APPROVAL] if it stages a confirm page, [WAIT] if it waits on the operator
...
(`-- end turn --` on its own line wherever the turn ends; steps that depend on an answer come after it)

Counts: logical approvals=<n>, literal [APPROVAL] tags=<n>, operator waits=<n>, questions=<n>
```

Also write a diagram (`.svg`, `.png` or `.jpg`) in outputs that labels the retained connections of your
recommended variant, and keep any geometry scripts you ran there.

### `critique.md`

Short: what in the skills/docs helped, what was missing, unclear or contradictory for THIS task
(file + section), what you had to guess, and anything in the brief itself that was ambiguous.

Finish by replying with one line: the path of plan.md.
