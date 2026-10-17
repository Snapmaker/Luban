This is a plan only. Nothing will be staged, captured, calibrated or moved now. I’m applying the CNC motion, camera operations, visual alignment and probing skills. The historical fixture supplies the starting scenario below; it is not live evidence, and the current repository tool contracts govern the proposed calls.

The core route needs **five confirm pages**, with **two spare pages** for calibration, a targeted refinement or a necessary recovery. It can locate a future hole to ±0.2 mm only if the recovered or newly measured datum evidence supports that bound. Fine camera views alone do not establish it.

The fixture preflight is:

- State: connected, position `heartbeat`, warnings `[]`, `machineStatus: IDLE`, but `isHomed: false`. Fixture toolhead machine XYZ is **150.2, 210.4, 296.0**, B180. These are historical hypothetical readings, not today’s position.
- Frame: all proposed coordinates are machine coordinates. No work-origin arithmetic or origin write is needed.
- Height: fixture motion floor is machine Z320; park is machine Z328. Use machine Z328 for survey coverage and ordinary transfers.
- Obstacles: fixture rotary box machine X140–200/Y0–350 and setter box machine X38–89/Y269–303 both demand legacy toolhead machine Z328. The whole route, including entering/leaving a box, matters. A shorter active tool cannot lower those requirements.
- Tool: fixture active tool is absent. “Probe, about 75 mm overall” is not yet a confirmed conservative fitted protrusion. Fixture effective probe length 70.9 mm and tip diameter 2 mm have historical provenance; they are separate from clearance length.
- Authority: this request authorizes planning only. Future execution needs an explicit instruction, then each staged job’s confirm click. Homing requires an explicit instruction and turns the rotary stock from its current B to B0.

Before future staging, refresh `get_connection_status {}`, `get_position {}`, `get_stored_state {}`, `get_active_tool {}`, `get_probe_feed_status {}`, `get_machine_profile {}`, `get_mcp_diagnostics {}`, `list_cameras {}` and `get_camera_model {}`. Require idle, spindle/toolhead off, usable position with no warnings, enabled healthy sensors, and current limits/obstacles. Do not interfere with a running job. If position is stale or awaiting resync, stop for supported resynchronization; do not use a stale-position homing override without the operator’s specific instruction.

**One question batch, before execution**

Please supply these together when you want this plan carried out:

1. Explicit permission to home, knowing that Z rises first and **B turns to 0**, and the intended enclosure face/B for the final survey. State whether stock/clamps clear that rotation; give the maximum swept radius of the current stock and clamping if a later B return is needed.
2. Has the enclosure been unclamped, moved, re-clamped, cut in the relevant region, or rotated since jobs `031c3eb1fe38` and `d677bd88d31a`? Has the probe been refitted or altered since the 2026-09-29 length measurement? Are the setter reference and mounting unchanged?
3. Which face/region is “the enclosure at the tailstock end,” and where is the proposed screw-hole centre relative to its intended edges/datums? Give hole diameter/depth and whether ±0.2 mm is a per-axis or radial positional bound. A marked existing image or drawing is sufficient to identify the region; do not invent machine coordinates.
4. Confirm a conservative **protrusion from the collet** for clearance, plus fitted probe exposed stylus length and body diameter. Confirm the stored 2 mm ball diameter if unchanged. Overall 75 mm is not the effective contact length. State any added obstacles/clamps and their bounds/heights, especially in the tailstock-end region, and resolve any conflict with the stored boxes.
5. If the existing 2,000-event buffer is insufficient, can you set Diagnostic buffers → job events to **20,000** before the measurement phase? The dry run will check the actual estimate; if still too small, or you decline, we stop/restrict the unresolved measurement scope without weakening the tolerance. If camera identification or solver export requires operator help, supply that identification/export with this batch; otherwise I will inspect the returned images and solve locally.

Answers remain dependencies. If an answer needed later remains unavailable, the dependent branch stops rather than producing a second question batch or inventing a value.

**Recover the existing evidence first — no pages**

Retrieve both original records before deciding whether additional probing is needed:

```jsonc
get_gcode_job_status {"job_id":"031c3eb1fe38"}
get_gcode_job_status {"job_id":"d677bd88d31a"}
```

Read raw contacts, trace surface lines, partial results, endings, calibration/date, B, sampled extent and datum/mounting context. `get_inspection_report {"job_id":"<id>","format":"json"}` applies only if the job actually contains a CAM inspection report. For ordinary probe programs/outlines/traces, use `get_gcode_job_status.result`; the report tool is not a universal exporter. Follow evidence links in these records to relevant other surveys and handoffs.

Classify each required quantity—surface plane, X/Y references, yaw, hole offset, accessible clearance, calibration and independent check—as covered, derivable, contradicted or missing. Preserve the original measurement-time probe calibration; do not recalculate old contacts with a new tool length. Reuse unchanged evidence regardless of age. An unavailable record is a retrieval gap, not automatic permission to recreate its survey.

B180 contacts do not directly give a B0 approach height after homing. Either return through an approved `rotate_b` operation with unchanged clamping, or use a physically validated rotary transform with its uncertainty. The fixture’s undated axis X170.1/physical Z112.4 is not such validation. If clamping continuity is unresolved, old records locate the region qualitatively and only specific invalidated constraints are measured again.

**Prepare the selected camera and homed state — no confirm pages**

```jsonc
preview_cameras {}
select_camera {"device":"<device identified in its preview>","confirm_frame_id":"<that device's preview frame_id>","reason":"Verified toolhead camera from the preview"}
capture_frame {}
```

Both fixture cameras can produce plausible images. The pinned Generic name alone is not proof of identity. Selection invalidates geometry associated with another device. Keep frame IDs, `camera.file`, timestamps, camera identity, resolution and stamped machine XYZ/B. If images cannot be inspected, require operator-marked targets/device identity; do not claim visual findings.

Only after the explicit future homing instruction:

```jsonc
home {}
get_position {}
get_stored_state {}
```

`home` runs on the call, with no confirm page; announce the B rotation first. Do not attempt `move_z` or a camera procedure while unhomed. Do not prepend an unnecessary separate raise: homing itself raises first. Confirm homed, reliable idle state afterwards.

If the operator confirms the conservative protrusion bound:

```jsonc
set_active_tool {"protrusion_mm":<confirmed bound>,"source":"operator","note":"Fitted probe; conservative collet protrusion bound for clearance only; operator statement and date"}
get_active_tool {}
```

Never overwrite the 70.9 mm effective contact conversion with “about 75 mm.” If that calibration remains applicable, retain it. If invalidated, a setter calibration uses one of the two spare pages **before new contact measurements**:

```jsonc
run_tool_setter {"bit_length_mm":<confirmed fitted protrusion>,"accept_probe_contact":true,"reason":"Measure refitted probe; prior effective length is specifically invalidated"}
// After approved successful completion and a verified setter reference:
set_probe_geometry {"probe_effective_length":<measured trigger machine Z minus verified physical setter surface Z>,"reason":"Setter job <id>, date, trigger convention, repeat spread and reference provenance"}
get_active_tool {}
```

Setter contact and stylus contact can differ through pretravel; preserve that uncertainty. If the setter reference is unverified, calibration is incomplete and the contact-dependent branch stops.

**Core page 1: bootstrap search**

With homed, reliable idle state and cleared current obstacles:

```jsonc
camera_bootstrap {"stage":"search","reach_mm":260,"pitch_mm":40,"y_span_mm":240,"reason":"Find the setter in a broad XY search at park height without assuming camera direction or offset"}
```

These are search parameters, not claims about camera geometry. Current travel clips the band; inspect the returned coverage/clipping. The broader Y search avoids the default single-row assumption. All search motion uses the park height. Retrieve its saved index and inspect frames; identify the setter by evidence, and derive the viewing offset’s sign from stamped toolhead poses. Do not guess it from a remembered camera layout.

**Core page 2: bootstrap poses, then offline solve and held-out check**

Select at least two useful fit XY poses and a distinct holdout from the actual search frames. Prefer more informative views when available; pose count alone does not prove conditioning. Numeric pose coordinates remain unresolved until those frames exist.

```jsonc
camera_bootstrap {
  "stage":"poses", "reason":"Solve camera geometry with an excluded independent holdout",
  "poses":[
    {"label":"fit-a","x":<observed useful machine X>,"y":<observed useful machine Y>},
    {"label":"fit-b","x":<second useful machine X>,"y":<second useful machine Y>},
    {"label":"check","x":<distinct observed machine X>,"y":<distinct observed machine Y>,"holdout":true}
  ],
  "step_mm":2,"floor_z":320
}
```

XY transfers remain at park. The sweep changes Z with XY stationary. Legacy boxes can eliminate machine Z320–326 stops even with the probe recorded as active. Inspect dropped poses and surviving Z stops; keep at least two useful fit poses plus the excluded holdout. Do not lower/delete a box to obtain a baseline. If the surviving views/targets cannot constrain perspective, use a spare page for a widened search or better poses only if the remaining total can still fit seven; otherwise stop with an incomplete bootstrap.

Check target provenance. The fixture setter configuration implies physical machine Z100.5 (=175.5−75), conditional on its unchanged verified reference. The approximate air-post height and historical rotary axis are not interchangeable exact targets. Inspect the index’s target sources, mark only identifiable verified targets, and refuse an under-constrained solve. Do not add guessed target geometry.

For every completed or partial bootstrap/survey:

```jsonc
get_gcode_job_status {"job_id":"<job>"}
get_camera_capture_set {"directory":"<result.directory>"}
get_frame {"file":"<index.frames[i].file>"}
```

These are server artifact paths passed to MCP, not local shell paths. Save the returned index as `index.json` and retrieved image bytes by basename in a local solve directory. The offline command, **not run now**, is:

```bash
python3 .agents/skills/cnc-visual-alignment/scripts/camera_bootstrap.py <local-directory> --out <local-model.json>
# If automatic detection fails, add --marks <local-marks.json>
```

Holdout-tagged frames must remain excluded. Inspect fit residuals, actual Z band, target spread, distortion assumptions and conditioning, including field-of-view/known-size sanity checks. The solve emits the complete `set_camera_model` payload:

```jsonc
set_camera_model {
  "offset":{"x":<solved>,"y":<solved>,"z":<solved>},
  "rotation":[[<r00>,<r01>,<r02>],[<r10>,<r11>,<r12>],[<r20>,<r21>,<r22>]],
  "intrinsics":{"fx":<solved>,"fy":<solved>,"cx":<solved>,"cy":<solved>,"k1":<solved or null>},
  "valid_band_z":[<actual minimum>,<actual maximum>],"central_region":<constrained fraction>,
  "residuals":{"rms_px":<measured>,"max_px":<measured>,"rms_mm":<measured>,"n_points":<count>,"n_poses":<count>},
  "survey_id":"<bootstrap id>","targets":["<verified target name>"]
}
```

The runner visits the holdout last and finishes at park Z above its XY; verify `result.finalMachine` and current position. Take a **fresh** frame there after model storage, then:

```jsonc
capture_frame {}
verify_camera_model {
  "target":{"x":<known physical machine X>,"y":<known physical machine Y>,"z":<known physical machine Z>},
  "pixel_u":<measured fresh-frame u>,"pixel_v":<measured fresh-frame v>,
  "tolerance_px":8,"note":"Fresh frame <id/file>; independent holdout excluded from solve; target provenance <source>"
}
```

No additional movement/page is needed for this check if the known target is visible at the reported finish. Eight pixels is the model usability gate, **not ±0.2 mm certification**. `plan_view_pose` is used only after verification passes; never use it to choose the initial holdout. A local 2×2 fit or `verify_calibration` inverse check cannot replace this camera-model solve and independent check.

**Core page 3: coarse full reachable-bed views**

With fixture travel confirmed unchanged, a qualitative sweep is:

```jsonc
survey_bed {"machine_z":328,"x_min":-19,"x_max":339,"y_min":0,"y_max":342,"margin_mm":0,"pitch_mm":40,"reason":"Coarse coverage of the reachable bed and location of the enclosure/tailstock region"}
```

This is toolhead grid coverage; the field of view determines actual scene coverage. Inspect all clipping, dropped frames, blind strips and occlusions. Do not silently call an uncovered region surveyed. Without measured `bed_plane_z`, do not invent `plane_z: 0` as a physical plane or claim a metric mosaic. If a valid measured bed plane was recovered, add `plane_z:<physical bed Z>` and `overlap_fraction:0.4`; the verified model derives the overlap pitch, capped by `pitch_mm`.

Retrieve the index/frames and any mosaics through MCP. The bed-plane mosaic does not locate the raised enclosure accurately: elevated surfaces have parallax. Use these views to identify the requested enclosure, candidate references and missing coverage, not to certify clearances or future hole coordinates.

**Core page 4: applicable B and only missing datum evidence**

Use unchanged saved B180 data where applicable. If final work is at B180 after homing, include the explicitly authorized return in this program. A return-only branch can be `rotate_b` followed by `capture`, with no repeated probing. If no return or measurements are needed, omit this page entirely.

Choose accessible retained X/Y references with enough separated contacts to establish yaw, plus a local Z/plane reference and an independent check excluded from the datum fit. Use recovered contacts first. A top profile alone cannot establish X/Y and orientation. Camera localization supplies search bounds, not a safe descent. Probe-body reach and fixture clearance must be established for each entry corridor.

Below are exact call/operation shapes; angle-bracket values are numeric dependencies to resolve before staging, not runnable arguments. Include only the operations needed for identified missing constraints:

```jsonc
probe_program {
  "name":"Enclosure datum gaps", "reason":"Resolve <named missing constraints>; reuse jobs 031c3eb1fe38 and d677bd88d31a",
  "dry_run":true,
  "keep_out":[{"name":"<current excluded fixture>","machine":{"x0":<min>,"y0":<min>,"x1":<max>,"y1":<max>},"clearance_z":<required toolhead machine Z>}],
  "ops":[
    {"id":"face","kind":"rotate_b","b":<requested B>,"require_z_at_least":328,"swept_radius_mm":<operator-bounded current sweep>},
    {"id":"find","kind":"sequence","fine_step_mm":0.05,"confirm_passes":3,"sensor_delay_ms":50,
     "steps":[
       {"kind":"hop","x":<safe entry X>,"y":<safe entry Y>},
       {"kind":"probe","name":"top","dz":-1,"max_travel_mm":<bounded safe search>,"on_miss":"abort","capture":{"label":"Datum contact","settle_ms":500}}
     ]},
    {"id":"wall","kind":"wall_follow","reason":"Missing straight edge and yaw, outside corner blends",
     "start_x":<proven free start X>,"start_y":<proven free start Y>,
     "z_machine":{"from":"find.top.z","minus":<allowed depth>,"between":[<minimum>,<maximum>]},
     "dir_x":<toward wall X>,"dir_y":<toward wall Y>,"along_x":<along wall X>,"along_y":<along wall Y>,
     "step_mm":<spacing justified by wall extent>,"stations":<count>,"max_travel_mm":<bounded search>,
     "standoff_mm":2,"on_miss":"abort","fine_step_mm":0.05,"confirm_passes":3,"sensor_delay_ms":50}
  ]
}
```

Add a second applicable edge, noncollinear Z contacts or a witness with unique op IDs only where the evidence table needs them. Omit `find` if the applicable calibrated top/approach is already measured; then supply that measured contact directly. Omit `face` if already at the required B. This is a conditional program template, not a claim that any fixture entry or wall corridor is known now.

For an unknown shoulder requiring a top-transition bracket, a bounded local alternative is:

```jsonc
{"id":"edge_band","kind":"surface_path",
 "start_x":<bracket start X>,"start_y":<bracket start Y>,"end_x":<bracket end X>,"end_y":<bracket end Y>,
 "stations":<justified count>,
 "start_z_machine":{"from":"find.top.z","plus":3,"between":[<min>,328]},
 "expected_z_machine":{"from":"find.top.z","between":[<min>,328]},
 "floor_z_machine":<body-safe search floor>,"hop_mode":"stepped","hop_lift_mm":2,
 "max_drop_mm":<reach-limited bound>,"fine_step_mm":0.05,"confirm_passes":3,"sensor_delay_ms":50}
```

Every descent beside a rim must respect **maximum depth below the highest rim under the body = exposed stylus length − ball diameter − stated margin**. Give each march its corresponding bounded travel; do not use overall probe length for reach. Unknown reach means no pocket/wall descent. A keep-out excludes its volume, including descent columns; never shrink it to make the program pass. A deliberately selected sensor-gated top find on an obstacle is a separate, explicit measurement choice with safe body access, not an excuse to scan through it.

For a sampled transition, spacing `p` contributes at least ±p/2. Thus 0.4 mm spacing already spends the entire ±0.2 mm allowance before other errors. Prefer directly fitted side contacts where appropriate, or e.g. a 0.2 mm edge bracket only when its ±0.1 mm sampling term leaves sufficient budget for all remaining errors. A 2 mm grid is not a ±0.2 mm edge measurement. Keep refinement local to unresolved intervals; no blanket dense survey.

Estimate event cost per job. At the fixture’s 2,000 events, even 20 stepped stations cost about 40 + 120×20 = 2,440 before program overhead and finding marches (~3 events/mm). A 21-station, 4 mm band at 0.2 mm spacing is about 2,560 before those additions. Use the actual dry-run `eventBudget`, `fitsEventLimit` and `recommendedEventLimit`; do not assume the guarded 60-events/station estimate applies to stepped scans. After a successful dry run and resolution of all dependencies, stage the same payload with `dry_run` omitted/false. One page covers the whole bounded program. Individual successful ops still retreat; batching does not retain a low pose between ops.

**Core page 5: fine enclosure views on its measured plane**

Use the recovered/new enclosure plane at the actual B. Compute its uncertainty with the original contact calibration and any validated transform. Query poses for the requested region/corners:

```jsonc
plan_view_pose {"target":{"x":<region machine X>,"y":<region machine Y>,"z":<measured physical enclosure plane Z>},"toolhead_z":328}
```

Use returned poses/FOV and coarse views to set reachable toolhead bounds that cover the target. Check model validity band, constrained central region, fixtures and occlusions. Then stage one standalone survey for a mosaic:

```jsonc
survey_bed {
  "machine_z":328,"x_min":<derived toolhead bound>,"x_max":<derived toolhead bound>,
  "y_min":<derived toolhead bound>,"y_max":<derived toolhead bound>,
  "plane_z":<measured physical enclosure plane Z>,"overlap_fraction":0.6,"pitch_mm":20,
  "reason":"Fine overlapping enclosure views at the applicable B and measured plane; locate the proposed hole against measured datums"
}
```

`pitch_mm:20` is a maximum camera-grid spacing, not a promise of 20 mm resolution; overlap derives actual spacing from the model. Do not use a sub-floor camera height to obtain finer detail. All required views inside the legacy rotary box remain at machine Z328. If the available optical resolution or view at that height cannot support the needed localization, report the limit and rely on measured datums/design offsets or stop short of the claim.

An ordered capture-only alternative uses `camera_program {"name":"Fine enclosure views","reason":"...","ops":[{"id":"park","kind":"move_z","machine_z":328},{"id":"detail","kind":"survey_bed","machine_z":328,"x_min":<x0>,"x_max":<x1>,"y_min":<y0>,"y_max":<y1>,"plane_z":<physical plane>,"overlap_fraction":0.6,"pitch_mm":20},{"id":"last","kind":"capture"}]}`. It costs one page but produces indexed frames, **not a mosaic**; use standalone `survey_bed` for this plan’s mosaic. Never put `type`, `target_z`, probe-reference expressions or a program-wide clearance exception into camera ops.

Check retrieved frames, clipped/dropped regions, mosaic affine, model ID and seams. Seam errors can mean wrong plane, raised-object parallax, wrong matches or camera movement. Do not infer a corrected height from seams alone. Re-verify a known target first; if movement is needed, count its staged page. No chains of uncounted direct vision nudges substitute for the staged plan.

**Approval budget, completion and failure**

| Phase | Confirm pages |
|---|---:|
| Bootstrap search and poses | 2 |
| Coarse survey | 1 |
| Applicable B / missing datum program, if required | 1 |
| Fine survey | 1 |
| Spare pool: setter calibration, targeted datum refinement, improved bootstrap or authorized recovery | At most 2 total |
| Maximum | **7** |

Homing, read-only calls, camera selection, active-tool recording, offline solving, model storage and verification have no confirm pages. A page spent on one optional branch is unavailable to another. Keep a running ledger; reserve all remaining dependent core phases before using a spare. If calibration, a failed bootstrap and refinement together would exceed seven, stop with explicit unresolved scope. Never promise successful completion regardless of evidence or silently add an eighth page.

For each future staged job: inspect the plan and approval summary, send its actual `confirm_url` as the last line with one sentence explaining what is approved, then **end that turn without another tool call**. In the subsequent turn use:

```jsonc
start_gcode_job {"job_id":"<existing staged id>","wait_for_approval_ms":110000}
get_gcode_job_status {"job_id":"<same id>","wait_ms":110000,"since_event":<previous next_event_index>}
```

Run long waits in the background and remain responsive. An approval timeout is not a refusal or a failed measurement: keep waiting on the same job, without restaging or withdrawing it. Inspect `ending`, complete/partial `result`, final pose and sensor state before the next phase.

On success, each ordinary procedure finishes at machine park Z328; record actual final machine XYZ/B rather than assuming a home position. Leave the requested B in place and do not add a gratuitous home or visit to work zero. Report whether ±0.2 mm is established, using a full bound including probe repeatability/pretravel, tip compensation, plane error, camera/feature localization where used, yaw propagation, datum/registration and any rotary transform. Preserve an independent check excluded from the fit. If the bound exceeds the requested radial/per-axis limit, the outcome is useful images and datum evidence with **hole position unresolved**, not a successful tolerance claim.

On failure/stop, preserve completed frames/contacts and `ending` plus the reported retreat state. Normal recoverable aborts use only the runner’s guarded **straight-up** park retreat; no XY escape or return to a lower start height. Held contact, `abort-held`, overtravel, connection closure or uncertain retreat means **HOLD**—no outer raise, no `on_fail:skip` continuation. Do not claim a retreat happened without evidence. Any later manual recovery requires a new explicit instruction, available page budget, re-established safety state and a Z-only park move before replanning; do not automatically retry a failed phase.

The handoff contains job IDs and dates; immutable raw contacts and original calibrations; camera device/resolution, frame IDs and server file paths; each capture-set directory/index and mosaic affine; solver input/marks/model payload and held-out residual; machine XYZ/B and clamping applicability; physical plane provenance; measured datum definitions, tip convention, yaw and independent check; uncertainty and coverage boundaries; exact gaps/contradictions and which artifacts depend on them; final machine/sensor/retreat state; and pages used/remaining. Archived snapshots are retrievable with `get_frame {"frame_id":"<saved>"}` or `get_frame {"file":"<camera.file>"}` beyond the 12-frame RAM cache and across restarts. Survey frames use their indexed server files. Retrieve them before proposing replacement captures.

This plan ends with a reviewable hole-location/datum proposal and its evidence, or a precise incomplete result with retained evidence. It authorizes neither cutting nor changing the work origin.
