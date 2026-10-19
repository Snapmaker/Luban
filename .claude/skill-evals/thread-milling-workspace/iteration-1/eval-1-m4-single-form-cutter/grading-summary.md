# Grading summary: eval 1 (m4-single-form-cutter), iteration 1

## Pass rate per config

| Config | Pass rate | Literal `[APPROVAL]` tags | Plan's own `Counts:` line |
|---|---|---|---|
| opus   | 9/11 | 8 (6 main path + 2 in the un-taken branch 3a, which the plan itself says "not counted below") | `approvals=6, operator waits=2, questions=6` |
| sonnet | 5/11 | 5 | `approvals=5, operator waits=3, questions=5` |
| haiku  | 6/11 | 2 (one tag covers the whole 4-step tool-change block instead of one per approval) | No `Counts:` line — haiku used a `## Counts` prose section instead of the requested template line |

## Assertions each model missed

| # | Assertion (short) | opus | sonnet | haiku |
|---|---|---|---|---|
| 1 | D4=shank/50L=length, never neck as cutter diam | PASS | **FAIL** (asks for "cutting/neck diameter" as one value) | PASS |
| 2 | Thread-form OD measured/datasheet, not invented | PASS | **FAIL** (same conflation) | PASS |
| 3 | Neck/reach unknown; 7.5 mm-like neck too short for 8 mm | PASS | **FAIL** (never raised) | **FAIL** (raises the 7.5 mm comparison but never draws the "too short" conclusion) |
| 4 | Single tooth + ~11-12 turn helix explained | **FAIL** (no turn count) | **FAIL** (says "continuous helix", no turn count) | **FAIL** (no helix/turn mention at all) |
| 5 | Flutes ≠ axial rows, entered separately | PASS | PASS | **FAIL** (says "triple-tooth (multi-flute)", conflating them) |
| 6 | D=0 tool-centre path + Fanuc | PASS | PASS | PASS |
| 7 | RPM/feed matches actual head; no power_percent-fixes-feed reliance | PASS | **FAIL** (never discusses the risk) | **FAIL** (wrongly claims the converter auto-maps spindle mode) |
| 8 | convert → submit frame=work/head_type=cnc; confirm URL last; start after | PASS | PASS | **FAIL** (submit_gcode_job omits `head_type` entirely) |
| 9 | Tool change (work Z on the mill) before declaring `tool_length_applied` | **FAIL** (converts, declaring the flag, before the tool-change flow runs) | **FAIL** (same ordering issue) | PASS (tool change is step 2, conversion is step 5) |
| 10 | One question batch; no staging before answers | PASS | PASS | PASS |
| 11 | Heights framed; no unrequested Z motion; XY at/above floor | PASS | PASS | PASS |

Every config missed assertion 4 (the turn-count arithmetic) — see below.

## Important findings no assertion covers

- **Opus caught real flaws in the operator's own M2.5 program** even though this eval's prompt never restates the M2.5 file: "The fixture header says `CUTTER DIAM=1.38`, but the operator describes 1.38 mm as the NECK... The generator's cutter diameter must be the TOOTH diameter" and "`L=2.25 [MULTI TOOTH]`... 'triple row' at 0.45 pitch is ~1.35 mm, so that program would leave unthreaded bands." This is exactly the kind of finding GRADER_INSTRUCTIONS flags as an example of value no assertion in *this* eval id covers (it's covered by eval 0's assertions, not eval 1's). Neither sonnet nor haiku made this connection for eval 1.
- **Opus also flagged that `originOffset` doesn't record which tool set work Z0**, which matters because flow A's "old" tool-setter measurement is only valid if it is the tool that actually set Z0 — a real gap in the tool-change skill (see below) that no eval-1 assertion covers. Sonnet raised a version of this too ("worth confirming it is still the hole's datum after the coming tool change"); haiku did not.
- **Opus is the only config that noticed the program's first `G00 X0 Y0` runs at whatever Z the head is at** and pre-positions with `goto_work_origin` before submitting, specifically to avoid an un-vetted initial XY leg. This is a real, non-trivial safety improvement over the other two plans, uncovered by any assertion here.

## Factually wrong or invented claims

- **Haiku, step 3 (Machining Doctor field list):** *"Spindle: RPM (preserve the source RPM; the converter will map it to the right spindle mode based on head type)"* — this is wrong. `thread-milling.md` requires the caller to choose `spindle_mode` explicitly (`power_percent` vs `cnc_200w_rpm`); there is no automatic mapping, and `power_percent` explicitly "does not infer a motor calibration or rescale feeds." This directly caused haiku's fail on assertion 7.
- **Haiku, findings bullet 1:** *"The M2.5 reference used a triple-tooth (multi-flute) 1.38 mm cutter"* — conflates axial tooth-row count ("triple-tooth") with flute count ("multi-flute") as if they were the same attribute, which is precisely what `thread-milling.md`'s "Cutter flutes / axial forms | Do not infer one from the other" warns against.
- **Haiku, step 3 vs. Q5:** the plan asks the operator "are you planning right-hand thread ... and climb milling?" (Q5, an open question) but then states in the very same document, as a settled Machining Doctor input, "Handedness: Right-hand (RH)" and "Climb/conventional: Climb (recommended for aluminum)" — answering its own open question with an assumed default rather than waiting. Self-contradictory, not caught by any assertion (assertion 10 only checks MCP-tool staging, not Machining Doctor guidance).
- **Sonnet, Q1 / step 3 (cutter diameter field):** repeatedly asks for the "cutting/neck diameter" as a single combined quantity. Per the eval's domain facts, the neck diameter (must clear the drilled hole while repositioning) and the thread-form/cutting OD (what the tool-centre path radius is computed from) are two different, independently-unknown dimensions — the same distinction whose neglect produced the operator's own flawed M2.5 program (cutter-diameter field wrongly set to the neck value). This is a real conceptual error, not just loose wording, since it risks the operator supplying the neck measurement into a field that needs the cutting OD.

## Edit suggestions for the skills / docs

1. **`src/server/services/mcp/docs/thread-milling.md`, "Usage" section** — add one sentence distinguishing the generator's "cutter diameter" field from a cutter's *neck* diameter explicitly (not just from the shank/body "D" marking, which is already covered under "Additional form choices" / "Unified UNC/UNF..." table). Two of three configs (sonnet, and haiku's step-3/Q5 handling of related geometry) showed confusion specifically between neck and cutting-form diameter, which the current doc does not call out even though the shank-vs-cutting distinction is well covered.
2. **`src/server/services/mcp/docs/thread-milling.md`, "Generator option coverage" table, "Single tooth" row** — currently just "Preserve repeated continuous helical turns." Add the arithmetic an agent needs to state to the operator: thread length ÷ pitch ≈ number of turns (e.g. "a single-tooth path is one continuous helix of `thread_length / pitch` turns"). All three configs (opus, sonnet, haiku) missed stating this, and it's a cheap, discriminating check of whether an agent actually understands what "single tooth" produces versus just picking the right generator option.
3. **`src/server/services/mcp/docs/thread-milling.md`, spindle paragraph** — the sentence "This deliberately replaces source RPM; it does not infer a motor calibration or rescale feeds" is present but easy to miss/misread as the opposite (as haiku did — inferring the converter *does* auto-select spindle mode from head type). Consider making this its own bolded callout rather than embedded mid-paragraph, since it's the single most safety-relevant sentence for the standard-head path and one of two configs got it backwards.
4. **`.claude/skills/tool-change/SKILL.md`, step 1 ("Measure the old tool")** — add a line addressing what opus and sonnet both had to reason out for themselves: if the tool that actually set the current work origin is not known / not the "last measured" tool, flow A's chain of `apply_tool_length_offset` deltas is invalid and the origin needs re-establishing, not just measuring "the old tool" generically. This is a real doc gap surfaced independently by two of the three configs' critiques.

## Eval-quality note (per grader.md step 6)

Assertion 9 ("Plans referencing work Z with the thread mill fitted ... before declaring `tool_length_applied`") is somewhat ambiguous between two different things a plan could get right: (a) never *calling* `convert_thread_milling_gcode` with `tool_length_applied: true` until the tool change is physically done, versus (b) never *submitting* the job (`submit_gcode_job`) until then. Opus and sonnet both call convert early (explicitly noting it's offline and harmless, deferring only the submit), while haiku happens to sequence the whole tool change before conversion. All three configs actually get the safety-relevant part right (nothing is ever submitted before the tool change completes) but only haiku satisfies the assertion's literal wording. Consider splitting this into two assertions so a plan can be credited for the submission-order safety property even if it converts early.

## Reply line

opus 9/11, sonnet 5/11, haiku 6/11
