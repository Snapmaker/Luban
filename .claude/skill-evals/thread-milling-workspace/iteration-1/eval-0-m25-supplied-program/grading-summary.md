# Grading summary: eval 0 (m25-supplied-program)

## Pass rate per config

| Config | Pass | Fail | Total | Rate |
| --- | --- | --- | --- | --- |
| opus | 13 | 0 | 13 | 100% |
| sonnet | 7 | 6 | 13 | 54% |
| haiku | 4 | 9 | 13 | 31% |

`[APPROVAL]`/`[WAIT]` tags, counted literally in plan.md (never the plan's own Counts line):

| Config | Literal approvals | Literal waits | Plan's self-reported | Matches? |
| --- | --- | --- | --- | --- |
| opus | 5 | 2 | "approvals=5, operator waits=2, questions=7 (8)" | yes |
| sonnet | 5 | 6 | "1/1 (no-change branch) or 5/5 (tool-change branch)" | no — neither branch total matches the literal 6 waits, since both branches' tags live in one document |
| haiku | 1 | 0 | "Approvals: 3, Operator waits: 4" | no — most of the staging/waiting is described only in prose, untagged |

## Assertions each model missed

**opus**: none. All 13 assertions pass with direct textual evidence (see `opus/run-1/grading.json`).

**sonnet** missed 6/13, all clustered around the cutter-geometry read and two motion-safety checks:
- Did not catch that `CUTTER DIAM=1.38` is the operator's *neck* diameter baked into the tool-centre path, not the (unknown) cutting OD — explicitly called it consistent ("Cutter geometry lines up... same diameter... nothing to configure for it").
- Consequently never asked for a measured thread-form OD, and never flagged `L=2.25 [MULTI TOOTH]` (5 rows @ 0.45) against the operator's "triple row" cutter (~1.35 mm) — no uncut-band warning at all.
- Because neither problem was seen, it never recommended regenerating the program; it converts and submits the file's geometry unchanged.
- Never asked whether work X0/Y0 is actually at the hole centre (only asked about the Z/tool-fit side of the origin).
- Never noted that the program's first `G00 X0 Y0` runs at the head's current, unproven Z — no park-height precondition anywhere.

**haiku** missed 9/13, and the misses are more severe than "didn't catch it" — several are actively wrong:
- Same cutter-geometry misses as sonnet (neck-vs-OD, L=2.25 mismatch, no regeneration recommendation).
- **Factually wrong domain claim**: asserts S17991 "exceeds the 200W CNC's maximum of 18000 RPM" and that the converter "will REJECT" it. 17991 is inside 8000–18000. This single error drives a whole fabricated operator question (regenerate vs. accept a "capped" 18000 RPM) and an invented converter behavior ("I adjust the expected upper bound to 18000") that contradicts the doc it read ("rejects... instead of silently clamping").
- **Safety-critical miss**: plans to run the cutting job with the touch probe still in the spindle ("no tool change required for thread milling"), directly contradicting its own quoted `get_stored_state` fact that the probe is fitted. No tool-change flow appears anywhere in the plan.
- Muddles the work-origin write: proposes `set_landmark` (a landmark tool, not an origin write) and an ad-hoc `probe_point`/`traverse_xy` to an undefined hole location as ways to establish the work origin, instead of routing through `apply_tool_length_offset` or simply asking the operator.
- Omits `head_type` from `submit_gcode_job`.

## Important observations the assertions don't cover

- **All three configs independently caught the same real documentation gap**: `convert_thread_milling_gcode` is entirely absent from `TOOLS.md`'s "54 tools" reference — the only routes to it are `README.md`'s one-paragraph pointer and `thread-milling.md` itself. Opus and sonnet both note a fresh agent that trusts `TOOLS.md` as the tool index (as `cnc-motion-rules` §7 implies) would never discover the tool and would submit the raw Fanuc file. This is a correct, important, ungraded finding and should move `thread-milling.md`/`TOOLS.md` editing up in priority.
- **Opus's uncovered good catches** (not asserted, all correct): the probe tip (~2.5 mm) can't enter the 2.05 mm pilot hole, so `probe_circle` can't verify the hole's XY — trust has to come from the operator's word alone; a drilled-depth-vs-drill-point-geometry check (is "6 mm deep" full-diameter or to the point?) that tightens the margin from ~0.94 mm to ~0.3 mm; that measuring the probe as tool-change "old tool" needs `accept_probe_contact: true` or it trips a crash alarm; and that `M08` coolant is stripped so the operator must flood the hole by hand. These are exactly the kind of "genuinely succeeded because it understood the domain" signals worth turning into assertions in a future iteration.
- **Sonnet's tool_length_applied sequencing is looser than ideal but not wrong**: its offline `convert_thread_milling_gcode` call (step 6) always passes `tool_length_applied: true`, even in the branch where a tool swap is later found to be necessary (step 9, after step 6). Since the call is offline and the actual submission happens after the swap, this doesn't reach the machine incorrectly, but it is worth noting as a discipline gap — the same pattern appears in opus's plan (which converts once for review before questions, again after), so this is more a shared idiom of the run structure than a sonnet-specific defect.
- **Haiku's self-contradiction is worth flagging on its own**: its Step 0 preflight explicitly quotes "probe fitted" from `get_stored_state`, then two paragraphs later Q3 asks the operator to confirm "The cutter is M2.5×0.45×D4... currently in the spindle, fitted" — treating the probe and the cutter as the same object without noticing the swap. This is the kind of error a discriminating assertion should catch directly (e.g., "identifies that the currently-fitted tool per the stand-in is the touch probe, not a cutting tool, and that a tool change is required before any spindle-on motion").
- **Haiku's tap-drill catch is correct and unasserted**: 2.05 mm is the standard pilot hole for M2.5×0.45 — a small positive signal in an otherwise weak run.

## Eval / skill-doc edit suggestions

1. **`src/server/services/mcp/docs/TOOLS.md`** — add a `convert_thread_milling_gcode` entry to the per-tool reference table (it currently has zero mentions of "thread"). Suggested location: new subsection after "G-code jobs" (around the `submit_gcode_job`/`validate_gcode` entries, line ~21), one line giving the argument names and pointing to `docs/thread-milling.md` for the full semantics. All three configs (independently) identified this exact gap — it's the single highest-value doc fix from this eval.

2. **`src/server/services/mcp/docs/thread-milling.md`, "Usage" section** — add an explicit line distinguishing "the neck/shank diameter a vendor advertises" from "the CUTTER DIAM the generator needs" (the tool-centre-path radius input), with the arithmetic hint already used correctly by opus (`2 * tool-centre-radius + cutter_OD = programmed major diameter`, from the arcs' `I`/`J` values). This is the exact distinction sonnet and haiku both missed, and it's currently left for an agent to reverse-engineer from the raw G-code.

3. **`thread-milling.md`, "Generator option coverage" table, "Cutter flutes / axial forms" row** — currently says "do not infer one from the other" (flutes vs. axial rows), which correctly warns against confusing flute count with tooth rows. Add a parallel, explicit sentence for axial *cutting length* vs. row count: "the operator's stated tooth-row count (e.g. 'triple row') implies an approximate cutting length (rows × pitch) — check it against the file's `L=` value before converting; a mismatch means the wrong cutter or the wrong generator settings were used." This is the check opus made from first principles and sonnet/haiku both skipped entirely.

4. **`thread-milling.md`, `tool_length_applied` bullet** — add a line stating this declaration is a claim about *live machine state* the converter cannot verify: "confirm the fitted tool and the work-origin history (which tool was in the spindle when Z0 was set) before declaring this true; if unknown, treat it as blocking and route through the `tool-change` skill." Both weaker configs either assumed it silently (sonnet, conditionally) or worse, assumed no tool change was needed at all (haiku) while the stand-in's own `get_stored_state` says the probe — not a cutter — is fitted.

5. **Cross-reference from `cnc-motion-rules` §7 ("Running a program someone else generated")** — add one sentence noting that a Machining Doctor / thread-milling Fanuc export is not a Luban/slicer export and must go through `convert_thread_milling_gcode` first; §7 currently reads as if any "Luban, Fusion, hand-written" program goes straight to `submit_gcode_job`, which is what let an agent relying on motion-rules alone (per its own trigger description, "for a plain 'run this file' this is the only skill you need") miss the conversion step.

One line: **opus 13/13, sonnet 7/13, haiku 4/13**
