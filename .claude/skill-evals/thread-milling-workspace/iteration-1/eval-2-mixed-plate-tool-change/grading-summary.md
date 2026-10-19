# Grading summary: eval 2 (mixed-plate-tool-change)

## Pass rate per config

| Config | Passed | Total | Rate | Approvals (literal tags / plan's own count) |
|---|---|---|---|---|
| opus   | 10 | 10 | 100% | 13 / 13 (consistent) |
| sonnet | 6  | 10 | 60%  | 10 / "12 baseline + up to 6 conditional" (inconsistent — see below) |
| haiku  | 0  | 10 | 0%   | 19 / 36 (grossly inconsistent) |

## Assertions each model missed

**sonnet** missed:
- "measure old on the tool setter... for probe -> M2.5 cutter" — computed the outgoing probe's trigger Z by hand instead of measuring it (see special check (a) below).
- "the M2.5 cutter's 1.38 mm is the neck" — never used the word "neck," and told the operator to regenerate all four M2.5 programs reusing the fixture's "1.38 mm cutter" figure verbatim, i.e. re-feeding the neck diameter into the generator as the cutting diameter.
- thread depth vs. reach check — no mention of "reach" or neck length at all.
- through-hole/spoilboard clearance — never considered.

**haiku** missed all 10. Two are severe beyond "missed an assertion": it never performs the probe → M2.5 tool change at all (runs the M2.5 program with, per the prompt, the touch probe still fitted), and its "Option A" repositioning scheme (traverse to a hole, then run the unmodified G90-absolute fixture program) does not do what the plan claims — the program's own `G00 X0 Y0` returns to the true work origin, not to wherever the head was just traversed.

**opus** missed none.

## Most important observations about the skills/docs

1. **No file states that a Machining Doctor export's XYZ datum must be per-hole, or that concatenating/re-running one program at multiple physical positions doesn't work.** All three agents had to reconstruct "one program per hole" from `thread-milling.md`'s scattered refusal rules (no mid-program tool change, no origin writes, M30 must terminate). Sonnet and opus reconstructed it correctly; haiku did not, and proposed a repositioning scheme that is invalid for a `G90` absolute program. **This is the single highest-value doc gap this eval surfaced** — a one-line rule in `thread-milling.md` ("one converted program per physical hole; a program's coordinates are fixed at conversion time and do not move with the head") would likely have closed haiku's worst failure mode outright.
2. **The tool-setter/probe arithmetic in `cnc-probing` SKILL.md ("effective length = measured trigger Z − 100.5") is written for deriving effective length FROM a fresh measurement, but nothing stops a plan from running it backwards** — treating a *stored* `effectiveLength` (which `cnc-motion-rules` §2 itself calls "historical") as if it were interchangeable with a live `run_tool_setter` reading, and feeding the reconstructed number straight into `apply_tool_length_offset` as `old_trigger_z`. sonnet did exactly this and, in doing so, skipped the one live measurement that would have caught a probe that had drifted or been re-seated. **Not sanctioned** — see the special check below.
3. **`get_machine_profile`'s actual contents are never shown to the planner** (the run instructions say so explicitly), which pushed sonnet toward treating `README.md`'s one-line hardware note ("built and hardware-verified... 200 W toolhead") as a substitute for the live call it does still make but never truly branches on.
4. **Approval-count accounting is fragile without per-hole enumeration.** sonnet's and haiku's own "Counts" lines disagree with a literal count of `[APPROVAL]` tags in their own plan.md by a wide margin (sonnet 10 vs. 12+; haiku 19 vs. 36) because repeated per-hole steps are described in prose ("repeat 4 times") rather than each individually tagged. A future run instruction telling agents to enumerate (or explicitly multiply) repeated steps in the Counts line would make this auditable.

## Factually wrong / rule-breaking claims (per the special checks)

**(a) Computing a tool-setter trigger Z by hand instead of measuring — is it sanctioned?**
No. **sonnet** did this: `apply_tool_length_offset {old_trigger_z: 171.8, reason: "probe (stored effectiveLength 71.3 + setter surface 100.5) -> M2.5x0.45 cutter"}`, skipping `run_tool_setter` for the outgoing probe entirely and never calling `get_tool_setter_config` to check the actual skip condition. The skill text is explicit that a skip is legitimate **only** when:
> "Skip only if the last stored measurement (`get_tool_setter_config` → `measurements.last`) is from this same tool, this session, and the operator confirms nothing has moved." (`tool-change/SKILL.md`, "The sequence," step 1)

and `apply_tool_length_offset` itself:
> "Requires a reliable position **and a measurement pair from this connection**." (`cnc-motion-rules/SKILL.md` §4)

A number reconstructed from a stored `geometry.probe.effectiveLength` is neither "the last stored measurement... this same tool, this session" nor "a measurement pair from this connection" — and `cnc-motion-rules` §2 flags exactly this figure by name as a trap: *"Figures remembered from text (71.1, 71.2, 71.3) are historical."* opus and haiku did not do this (opus measured the probe live for change 1 and only invoked the legitimate same-session skip for change 2; haiku never measured the probe at all, which is a different and worse failure — see assertion 2).

**(b) Asserting the rig's head type from the README instead of a live read**
**sonnet** did this in substance: it calls `get_machine_profile` live (step 4) but its Findings section justifies the outcome from documentation — *"README.md line 5 records this rig as built and hardware-verified with the 200 W CNC toolhead (2026-08)... so I'm planning on `cnc_200w_rpm`"* — and every `convert_thread_milling_gcode` call in the numbered Steps hardcodes `spindle_mode: "cnc_200w_rpm"` with no branch for a standard-head result. Calling the tool without ever conditioning the plan's actions on what it could return is functionally the same as asserting from the README. opus reads `get_machine_profile` and genuinely branches the spindle-mode choice (and the regeneration spec it asks the operator for) on the result; haiku never calls `get_machine_profile` at all but does at least ask the operator directly (question 4), which the run instructions permit as an alternative to a live read.

**(c) Approval counts vs. the realistic minimum**
- opus: 13, matching the realistic minimum once per-hole programs are required (2 tool changes, one sanctioned skip, +6 submits). Literal tag count agrees exactly.
- sonnet: claims 12 baseline, but that figure is only reachable via the unsanctioned skip in (a); the honest minimum (measuring the probe once) is 13, the same as opus. Literal tags (10) undercount its own stated total because repeated per-hole steps aren't individually tagged.
- haiku: 19 literal tags, 36 by its own final count, ~24 by a straightforward manual re-count, and "~20" floated for its untaken Option B — four different numbers, none close to 13, driven by an unneeded traverse+descend pair around every hole that a correctly-generated per-hole program would not need at all.

## Concrete edit suggestions

1. **`thread-milling.md`, after the "Usage" section** — add a short "Multiple features" note: *"A converted program's coordinates are fixed at conversion time to the generator's XYZ datum. To cut N holes, generate and convert N programs, one per hole's work coordinates — do not re-run one converted program after manually repositioning the head, and do not write a new work origin per hole."* This directly targets haiku's worst failure mode and would remove the need for sonnet/opus to reconstruct the rule from refusal-table trivia.
2. **`cnc-probing/SKILL.md`, "Probe calibration" section (around the `effective length = measured trigger Z − 100.5` line)** — add: *"This formula is for deriving effectiveLength FROM a live run_tool_setter reading, never the reverse. A stored effectiveLength is historical (cnc-motion-rules §2); it is never a substitute for run_tool_setter's measurement pair when calling apply_tool_length_offset."* This closes the exact gap sonnet exploited.
3. **`tool-change/SKILL.md`, "The sequence," step 1** — the skip condition currently reads naturally as "if you already measured this exact tool this session." Consider adding an explicit negative example: *"Do not compute a trigger Z algebraically from stored geometry constants (e.g. setter-surface + effectiveLength) in place of this measurement — that is not the same as a same-session/same-tool skip."*
4. **evals.json, eval id 2, assertion 9** — the parenthetical "(tool changes + one job per cutter)" contradicts assertion 1 (which correctly requires one job per HOLE, 6 jobs not 2, once the fixed-datum limitation is recognised). Reword to "(tool changes + one job per hole)" so the two assertions don't pull in different directions.
5. **RUN_INSTRUCTIONS.md / GRADER_INSTRUCTIONS.md** — consider asking agents to enumerate repeated per-hole/per-cutter steps explicitly in the Counts line (or state a multiplier) rather than "repeat N times" in prose; this would make literal-tag-count vs. stated-count auditing (which the grader is asked to do) actually converge instead of silently diverging by 2-17 approvals as seen in sonnet and haiku here.
