# Plan: Convert the supplied M2.5 Machining Doctor program with `convert_thread_milling_gcode` and stage it as one file job, after confirming the tool/origin state and the fitted CNC head

## Findings before anything moves

- The fixture's header comments already answer two of the three required declarations:
  `(CONTROLER - FANUC)` matches the default `source_controller: "fanuc"`, and
  `(CUTTER COMPENSATION D=0 - TOOLPATH FOR TOOL CENTER)` confirms `tool_center_path: true` is
  correct (and the only mode the converter supports — nonzero compensation is refused, not our
  case here).
- Cutter geometry lines up: the file says `CUTTER DIAM=1.38, L=2.25 [MULTI TOOTH]`; the
  operator's stated neck is 1.38 mm diameter × 7.5 mm long, same diameter. The file's three
  near-identical `G91 G01 G41 …` blocks are the documented "multi tooth, shorter than thread"
  repeated approach/turn/retract pattern (`thread-milling.md` generator-option table) — the
  converter preserves that shape unchanged, nothing to configure for it.
- Depth looks self-consistent: the cut goes to work `Z-5.056` (thread length 5 mm, matching the
  header's `LENGTH=5 MM`) inside a hole drilled 6 mm deep — about 0.94 mm of clearance past the
  last thread pass. The drilled diameter, 2.05 mm, is the ordinary tap-drill size for M2.5×0.45.
  This is the operator's CAM input, not something the converter checks — noted as consistent,
  not verified by any tool call.
- The third required declaration, `tool_length_applied`, is a fact about the CURRENT machine
  state, not the file: is the work origin's Z already calibrated for the tool that's about to
  cut? `get_position.originOffset` is present ("the operator set a work origin earlier today")
  but the stand-in doesn't say with which tool, and the operator's message doesn't say whether
  the M2.5 cutter is already fitted. Declaring `tool_length_applied: true` is only honest if the
  answer is yes — this has to be asked, not assumed true because the schema requires the flag.
- `spindle_mode` needs the fitted CNC head type, which the stand-in explicitly withholds
  (`get_machine_profile` is "NOT in this stand-in"). The file's `S17991` sits inside the 200 W
  head's 8000–18000 RPM window, so IF the fitted head is the 200 W one, `spindle_mode:
  "cnc_200w_rpm"` reproduces the source RPM exactly with no operator input needed. If it's the
  standard head, the tool needs an operator-chosen `spindle_power_percent` (1–100) — the doc is
  explicit that there is no RPM→percent mapping, so this can only be asked, never computed.
- `convert_thread_milling_gcode` runs fully offline (no connection, no origin read, no motion, no
  approval) — it can be called the moment `spindle_mode` is known, independent of the tool/origin
  question above.
- `thread-milling.md` is explicit that the follow-up call is `submit_gcode_job` with
  `head_type: "cnc"` and `frame: "work"`; the file only ever contains `G54`, never `G53`, which
  matches the work-frame declaration and needs no hand conversion.
- Docs gap: `convert_thread_milling_gcode` is not listed anywhere in `TOOLS.md`'s per-tool
  reference table (searched, no hits) — only `README.md`'s one-paragraph pointer and
  `docs/thread-milling.md` describe it. Its argument schema had to come from the prompt, not from
  the tool index a fresh agent would normally trust first.

## Questions for the operator (one message)

1. Is the M2.5×0.45 thread mill already the tool fitted in the spindle, and was today's work
   origin zeroed with this same tool touching off the plate's top surface? If not, which tool is
   in the spindle now, and do you want to swap to the thread mill before I stage anything?
2. Only if a swap is needed: what's the thread mill's approximate protrusion from the collet
   (`bit_length_mm`) for the tool setter? All I have is its overall length (50 mm) and neck
   length (7.5 mm) — not how far it's clamped out.
3. Only if the machine turns out to have the standard CNC head rather than the 200 W head (I'll
   check this myself with `get_machine_profile` — you don't need to answer if you don't know):
   what `spindle_power_percent` (1–100) should replace the file's S17991? There's no automatic
   RPM-to-percent mapping, so I can't derive one.
4. Are the clamps holding the plate clear of the tool's travel around the hole, and is the door
   shut with extraction on before I stage the run?

## Steps

1. `get_connection_status {}` — quote: connected (Wi-Fi), A350, CNC module.
2. `get_position {}` — quote: reliability `verified`, homed, idle, machine (X−19, Y342, Z328),
   warnings [], `originOffset` present.
3. `get_stored_state {}` — quote: `geometry.probe.effectiveLength` 71.3 (SET); `motionFloorZ`
   320, `safeTraverseZ` 328; tool setter centre machine X79 Y293; landmark `rotary` (X110–230
   Y130–342); probe currently in the spindle.
4. `get_machine_profile {}` — the one live fact the stand-in withholds: which CNC head (standard
   vs 200 W) is fitted. Read-only, no approval.
5. Ask the operator the four questions above, in one message. **-- end turn --**

[WAIT for the operator's reply]

6. `convert_thread_milling_gcode` — no approval (offline, no motion, no origin touch):
   ```jsonc
   convert_thread_milling_gcode {
     "gcode": "<full unchanged text of thread-milling-m2_5-fanuc.nc, header comments through the trailing M30 and disclaimer>",
     "source_controller": "fanuc",
     "tool_center_path": true,
     "tool_length_applied": true,
     // one of, per step 4 + Q3's answer:
     "spindle_mode": "cnc_200w_rpm"
     // or: "spindle_mode": "power_percent", "spindle_power_percent": <operator's number>
   }
   ```
7. Review the returned `gcode`, `changes`, `warnings`, `sourceSpindleRpm`, `validation` — report
   anything flagged (removed G43/H, removed M08/M09 coolant, any chord-tolerance blending) to the
   operator before going further.
8. `validate_gcode {"gcode": "<converted gcode from step 6>"}` — free extra check (declared
   frame, distance-mode hazards, spindle state, extents) alongside the convert tool's own
   `validation`.
9. **Only if Q1's answer says a tool change is needed** — run the `tool-change` skill's flow A
   here, inserted before step 10: `run_tool_setter {bit_length_mm: <current tool's stated
   protrusion>}` [APPROVAL] → `start_gcode_job` [WAIT] → `goto_tool_change_position` [APPROVAL] →
   `start_gcode_job` [WAIT] → operator swaps by hand [WAIT] → `run_tool_setter {bit_length_mm:
   <Q2's answer>}` [APPROVAL] → `start_gcode_job` [WAIT] → `apply_tool_length_offset {"reason":
   "M2.5 thread mill fitted for thread-milling job"}` [APPROVAL] → `start_gcode_job` [WAIT] →
   `get_position` to confirm `originOffset.z` moved by the expected delta before trusting
   `tool_length_applied: true`.
10. `submit_gcode_job {"gcode": "<converted gcode>", "name":
    "thread-milling-m2_5-fanuc-converted.nc", "frame": "work", "head_type": "cnc"}` [APPROVAL] —
    stage the file job.
11. Read the operator the confirm page's **Frame** row (expect `WORK`) and the
    **machine-resolved Z extents**; deliver the `confirm_url` as the last line, alone, one
    sentence above it saying what they're approving. **-- end turn --**
12. `start_gcode_job {"job_id": "<id>", "wait_for_approval_ms": 110000}` [WAIT] — background poll
    for the operator's click.
13. `get_gcode_job_status {"job_id": "<id>", "wait_ms": 110000, "since_event": 0}` — long-poll to
    completion; report `ending.kind` and the stored `result` to the operator.

Counts (no-tool-change branch, the shorter of the two): approvals=1, operator waits=1,
questions=4. If Q1's answer requires the tool-change branch (step 9): approvals=5, operator
waits=5 (four tool-setter/park/apply waits plus the manual-swap wait), questions=4 (unchanged —
all four were asked together up front).
