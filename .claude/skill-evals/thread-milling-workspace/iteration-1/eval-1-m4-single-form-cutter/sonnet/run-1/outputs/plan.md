# Plan: Generate the M4x0.7 single-tooth internal thread-milling program via Machining Doctor, convert it, fit the cutter, and run it

## Findings before anything moves

- The spindle currently holds the touch probe, not a cutter (given stand-in). Before this
  program can run, a **tool change** (skill `tool-change`) to the M4 single-tooth cutter is
  mandatory, and its last step (`apply_tool_length_offset`) is what makes the converter's
  required `tool_length_applied: true` declaration actually true — it must happen before
  `submit_gcode_job`, not after.
- The operator gave the M4 cutters' shank/part designation (`M4x0.7xD4x50L`) but not the
  **actual cutting/neck diameter** of either M4 cutter. Machining Doctor's "cutter diameter"
  field needs the true cutting diameter (it must be smaller than the 3.3 mm drilled hole to
  fit inside before helixing outward) — by analogy with the M2.5 cutter, whose neck (1.38 mm)
  is far thinner than its D4 shank. This can't be inferred from "D4" and isn't in the message.
- "Single thread (one tooth row)" reads as Machining Doctor's **"single tooth"** cutter-type
  option. Per `thread-milling.md`, single-tooth output is a *repeated continuous helix* the
  full 8 mm depth, unlike the multi-tooth "shorter than thread" repeated approach/turn/retract
  pattern in the M2.5 fixture. The M2.5 program is a reference for the *conversion mechanics*
  and controller/compensation choices only — not a template for this cutter's toolpath shape.
  Flute count and tooth-row count are independent per the doc ("a three-flute cutter can still
  have a single axial thread form"), so "triple flute" in the operator's M2.5 description isn't
  evidence about tooth rows either way for the M4 pair.
- `convert_thread_milling_gcode`'s `spindle_mode` depends on which CNC head is fitted (standard
  vs 200 W) — not given in the stand-in. `get_machine_profile` reads it; branch there rather
  than guess (the README's "hardware-verified against ... 200 W toolhead" line describes the
  project's general test rig, not necessarily this session's fitted module).
- RH/LH thread and climb/conventional milling aren't stated. Both are required Machining Doctor
  choices this converter preserves rather than infers (`thread-milling.md`: "Preserve G2/G3
  direction and signed Z travel") — a wrong choice produces a physically wrong helix direction,
  so this is a question, not a default.
- Machining Doctor is a web calculator behind Cloudflare (per `thread-milling.md`'s note on how
  its own fixtures were captured) — this plan cannot fetch it or fill it in directly (no network,
  dry run in any case). The deliverable here is the exact field list for the **operator** to
  enter, and the exported text comes back from them for conversion.
- `tool_center_path: true` requires Machining Doctor's cutter-compensation choice to be the
  tool-centre / zero-compensation variant (what produced the M2.5 fixture's `D=0` header even
  though `G41 D1` appears in the body) — not a left/right radius-comp selection.
- The work origin was set earlier today (`originOffset` present) but with which tool fitted is
  unknown — worth confirming it is still the hole's datum after the coming tool change, since
  `apply_tool_length_offset` shifts work Z by the length delta and assumes the origin was true
  for the *old* tool at the time it was set.
- Thread length for the Machining Doctor "thread length" field is the operator's stated 8 mm
  depth; the drilled 3.3 mm hole is the physical constraint the (unknown) cutter neck diameter
  must clear, not itself a calculator input beyond confirming clearance.

## Questions for the operator (one message)

1. What is the single-tooth M4 cutter's actual cutting/neck diameter (must clear the 3.3 mm
   hole) and its thread-form cutting length? Machining Doctor needs both.
2. RH or LH thread, and climb or conventional milling — same as the M2.5 job, or different?
3. Material/cutting-speed guidance for this aluminium block: reuse the M2.5 job's feed-and-speed
   choices, or do you have different numbers for the M4 pass?
4. Tool change flow — A (MCP-managed, you're at the computer) or B (touchscreen wizard)? Either
   way: the probe's approximate current protrusion, and the M4 cutter's approximate protrusion,
   for the tool-setter measurements.
5. Was today's work origin set with the probe touching off this same hole (top/centre), so it's
   still the right datum once the cutter is fitted — or does it need re-establishing first?

Counts: approvals=5, operator waits=3, questions=5

*(A sixth question — standard-head `spindle_power_percent` — is asked only if
`get_machine_profile` in step 1 shows the standard CNC head; on a 200 W head it is skipped, so
it is folded into the batch rather than counted twice. "Operator waits" below counts only the
non-approval end-turns — the answer batch, the Machining Doctor paste-back, and the physical
tool swap; each of the 5 approvals also ends its own turn for the confirm-page click, tallied
under "approvals" instead of double-counted here.)*

## Steps

1. `get_machine_profile {}` — read-only, no approval. Determines CNC head type for
   `spindle_mode`: standard → `power_percent` (needs an operator percent); 200 W →
   `cnc_200w_rpm` (keeps source RPM, must land in 8000–18000).
2. Ask the operator the five questions above in one message (plus the conditional sixth if
   step 1 shows a standard head). [WAIT]
   -- end turn --
3. *(after the answers)* Reply with the exact Machining Doctor field list for the operator to
   enter themselves:
   - Thread standard: Metric, M4, pitch 0.7 mm; Application: **Internal**
   - RH/LH and climb/conventional: per answer to Q2
   - Cutter type: **Single tooth**; Cutter diameter / cutting length: per answer to Q1
   - Thread length: 8 mm
   - Cutter compensation: **tool-centre / zero-compensation** (not left/right radius comp) —
     required for `tool_center_path: true`
   - Controller: **Fanuc** (converter default, matches the M2.5 job — avoids the Siemens
     C/D dropdown-label ambiguity noted in the docs)
   - Units: metric in and out
   - Material/feed/speed/radial passes: per answer to Q3
   - Program/tool/D/H numbers, XYZ datum (0,0, matching the existing work origin), precision:
     defaults are fine — tool/D/H metadata is stripped on import regardless
   Ask them to run the calculator and paste the exported program text back. [WAIT]
   -- end turn --
4. *(after the operator pastes the export)* `validate_gcode {gcode: "<pasted text>"}` — read-only,
   free. Report any warnings before converting.
5. `convert_thread_milling_gcode {gcode: "<pasted text>", source_controller: "fanuc", tool_center_path: true, tool_length_applied: true, spindle_mode: "<power_percent"|"cnc_200w_rpm from step 1>", spindle_power_percent: <only if power_percent>, chord_tolerance_mm: 0.002}`
   — offline, no approval, no motion. Review `changes`, `warnings`, `sourceSpindleRpm`,
   `validation` and report them; if 200 W mode rejects `sourceSpindleRpm` (outside
   8000–18000), tell the operator to adjust the cutting-speed input on Machining Doctor and
   redo steps 3–5.
6. **Tool change to the M4 single-tooth cutter** (flow per Q4 answer; flow A shown):
   1. `run_tool_setter {bit_length_mm: <probe protrusion from Q4>, reason: "measure probe before M4 cutter swap"}` [APPROVAL]
      `start_gcode_job {job_id, wait_for_approval_ms: 110000}` [WAIT]
      -- end turn --
   2. `goto_tool_change_position {reason: "park for M4 single-tooth cutter swap"}` [APPROVAL]
      `start_gcode_job {job_id, wait_for_approval_ms: 110000}` [WAIT]
      -- end turn --
   3. Operator swaps the probe for the M4 single-tooth cutter by hand. [WAIT]
      -- end turn --
   4. `run_tool_setter {bit_length_mm: <M4 cutter protrusion from Q4>, reason: "measure M4 single-tooth cutter"}` [APPROVAL]
      `start_gcode_job {job_id, wait_for_approval_ms: 110000}` [WAIT]
      -- end turn --
   5. `apply_tool_length_offset {reason: "tool change: probe -> M4 single-tooth cutter"}` [APPROVAL]
      `start_gcode_job {job_id, wait_for_approval_ms: 110000}` [WAIT]
      -- end turn --
   6. `get_position {}` — read-only, confirm `originOffset.z` moved by the expected delta; report
      it to the operator and ask them to sanity-check the displayed work Z against the hole
      before cutting (per `tool-change` skill step 6). This satisfies `tool_length_applied: true`.
7. `submit_gcode_job {gcode: "<converted program>", name: "m4-single-tooth-thread.nc", frame: "work", head_type: "cnc"}` [APPROVAL]
   Read the operator the confirm page's Frame row and machine-resolved Z extents.
8. Deliver the confirm URL as the last line, one sentence above it saying what it approves. [WAIT]
   -- end turn --
9. `start_gcode_job {job_id, wait_for_approval_ms: 110000}` in the background (or `confirm_token`
   if hand-off is disabled).
10. `get_gcode_job_status {job_id, wait_ms: 110000, since_event: <next_event_index>}` long-polled
    to completion; report `ending.kind` and the result to the operator.

Counts: approvals=5, operator waits=3, questions=5
