# Dry-run instructions (thread-milling skill eval, iteration 1)

You are a fresh agent planning work on a Snapmaker A350 CNC driven through the Luban MCP tools.
This is a DRY RUN. You produce a written plan; nothing moves.

## Hard limits

- Do NOT call any MCP tool (no luban*, freecad*, jumperless*, browser, or network tools).
- Do NOT ssh, curl, or contact 192.168.1.153 or any other host. No web search or fetch.
- Do NOT read any file outside the snapshot directory below, other than this file and your
  outputs directory. Do not read the repo's source code (`.ts` files); the docs are what an
  agent in the field gets.

## What to read (snapshot of tyeth/Luban PR #191, head 44cf04d8d)

Root: `C:\dev\software\snapmaker\Luban\.claude\worktrees\thread-cutter-evaluation-8d4f82\.claude\skill-evals\thread-milling-workspace\snapshot-pr191\`

- `.claude/skills/cnc-motion-rules/SKILL.md` (read FIRST)
- `.claude/skills/tool-change/SKILL.md`
- `.claude/skills/cnc-probing/SKILL.md` (and `references/cam-probing.md` if needed)
- `.claude/skills/cnc-visual-alignment/SKILL.md` (only if you need the camera)
- `src/server/services/mcp/docs/TOOLS.md`
- `src/server/services/mcp/docs/thread-milling.md`
- `src/server/services/mcp/README.md` (search it; it is long)
- `src/server/services/mcp/tests/fixtures/thread-milling-m2_5-fanuc.nc` (the operator's M2.5 program)

The `convert_thread_milling_gcode` tool schema (as the MCP server advertises it):

```
convert_thread_milling_gcode {
  gcode: string (required)            // complete generator output, including M30/M2
  source_controller?: fanuc|okuma|mazak|haas|siemens_c|siemens_d|mitsubishi|mori_seiki  (default fanuc)
  tool_center_path: true (required)   // declaration: tool-centre path, zero D compensation; D1 is a register number
  tool_length_applied: true (required) // declaration: fitted tool tip already accounted for in work Z; G43/H removed, its motion kept
  spindle_mode: "power_percent" | "cnc_200w_rpm" (required)
  spindle_power_percent?: integer 1-100 // only for power_percent; no RPM mapping or feed rescaling
  chord_tolerance_mm?: number 0.00001-0.01 (default 0.002)
}
-> returns { gcode, changes, warnings, sourceSpindleRpm, validation }; does not stage or run.
```

## Stand-in for the live state (what the first read-only calls would have returned)

- `get_connection_status`: connected (Wi-Fi), A350, CNC module.
- `get_position`: reliability `verified`, homed, idle, machine (X−19, Y342, Z328), warnings [].
  `originOffset` present (the operator set a work origin earlier today).
- `get_stored_state`: `geometry.probe.effectiveLength` 71.3 (SET); limits motionFloorZ 320,
  safeTraverseZ 328; tool setter configured (centre machine X79 Y293); landmarks: `rotary`
  (the rotary module, box around machine X110-230 Y130-342); the touch probe is in the spindle.
- `get_machine_profile`: NOT in this stand-in. If your plan depends on the CNC head type
  (standard vs 200 W), say which call reads it and branch on the answer, or ask.
- Anything else you would need: say which call returns it; do not invent the value.

## What to write

In your outputs directory (given in your prompt), write two files:

### `plan.md`

```
# Plan: <one line>

## Findings before anything moves
<what you noticed about the tools/program/request that changes the plan; one bullet each>

## Questions for the operator (one message)
<numbered list, or "none">

## Steps
1. <tool call with real arguments, or an operator action> [APPROVAL] if it stages a confirm page, [WAIT] if it waits on the operator
...

Counts: approvals=<n>, operator waits=<n>, questions=<n>
```

Write the steps as the conversation would go, including where you END A TURN (put `-- end turn --`
on its own line). Steps that depend on an answer come after the answer.

### `critique.md`

Short: what in the skills/docs helped, and what was missing, unclear or contradictory for THIS
task. Name file + section. Say what you had to guess.

Finish by replying with one line: the path of plan.md.
