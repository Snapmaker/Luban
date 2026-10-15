---
name: cnc-vibration
description: Diagnose the Snapmaker A350 CNC with the accelerometers on the Luban MCP surface - axis noise and reconditioning (where on the rail, which component by spatial period), toolhead vibration and deflection (tilt against a baseline, dynamic displacement), tailstock and cut chatter, spindle RPM through the structure, and the rotary chuck's absolute B angle from gravity (calibration and power-cycle offset). Use for any question about vibration, noise, chatter, rattling, bearings, lead screws, deflection, spindle speed from a sensor, or "where is B really". The vibration tools are read-only; any motion a diagnosis needs goes through cnc-motion-rules first.
---

# CNC vibration diagnostics (accelerometers)

The accelerometer tools **record and analyse; they never move anything**. Every diagnosis that
needs motion (an axis run, a B rotation, a test cut) uses the ordinary staging tools, under
[`cnc-motion-rules`](../cnc-motion-rules/SKILL.md) - load it before planning that motion, ask
for the operator's word, deliver the confirm link, and record alongside. A capture is never a
reason to move the machine, and a reading is never a reason to write a coordinate.

## Orient first

1. `get_vibration_status {live_s: 2}` - which sensors exist, where each is stuck (`location`),
   whether each streams, its measured rate, overruns, the bus load, what stops the feed, and a
   quick level/tone/gravity look. If the feed is off or unconfigured, say what it reports and stop:
   enabling it, choosing a bridge and listing sensors is the operator's job (Settings -> MCP
   Server -> Accelerometers). Never suggest putting the sensors on the probe feed's U2IF board;
   the config refuses it for a safety reason.
2. Read `orientation`: without it, tone directions are in SENSOR axes - say so instead of naming
   machine axes.
3. `list_vibration_captures` before recording again: an earlier capture may already answer the
   question (captures persist on disk; `get_vibration_capture` re-analyses them).

## Reading a report honestly

- `level.velocity_rms_mm_s` is the comparable severity number (ISO 10816 band, stated). Compare
  like with like: same sensor, same location, same state (spindle speed, feed, axis).
- `peaks[].axis_share` is the DIRECTION a tone shakes in. `displacement_pk_um` is that tone's
  amplitude.
- `rotation` is only an RPM when `locked` is true; `half_rate_ambiguous` means the fit may be
  an octave off. `non_harmonic_peaks` are chatter CANDIDATES, not a verdict - a structural
  resonance excited by the cut looks the same; check whether it moves with RPM or feed.
- Deflection: an accelerometer does not see static translation. It sees **tilt** against a
  baseline (`change_vs_baseline.tilt_change_deg`, significant only above 3x its resolution) and
  **dynamic** displacement. `lateral_displacement_um` is tilt x the lever you supplied - say so.
- A number without its sensor, location, state (S, feed, axis) and capture id is not evidence;
  quote them. Estimates from a short or gappy capture (`gaps` > 0) are labelled as such.

## Recipes

**Noisy axis (e.g. Y) - where and what.**
1. Ask once (law 7 of the motion rules): the Y range to run, the feed(s), whether the head is at
   or above the motion floor, and any component lengths the operator knows (screw lead, belt
   pitch) for `references_mm`. Never invent a lead.
2. `capture_vibration {sensors: [the y-axis and/or toolhead sensor], duration_s: <enough for all
   legs + approvals>, wait: false, label: "Y run F600 40->300->40"}`.
3. Stage the motion with `traverse_xy` (series `targets`, the stated `feed_rate`, machine frame),
   deliver the confirm link, end the turn; run the legs as the operator approves.
4. `get_vibration_capture {capture_id, wait_ms, motion: {axis: "y", feed_mm_min: 600,
   targets: [40, 300, 40], references_mm: {...}}}`. Read `position_profile.bins` (loud spots by
   position and direction - a damaged rail or ball track shows as a position, a bad bearing as a
   level along the whole travel) and `peaks_as_spatial_periods` (wavelength mm).
5. Repeat at a second feed: a tone whose WAVELENGTH stays put is a component of the drive; one
   whose FREQUENCY stays put is a resonance. That distinction is the reconditioning decision.
   If segments and legs do not match one-to-one the profile is refused - fix the targets or the
   window (`from_s`/`to_s`), do not force it.

**Toolhead deflection.** Two captures of the toolhead sensor close together in time: a baseline
(spindle on, not cutting) and the loaded state (cutting, or under the operator's stated load).
`get_vibration_capture {capture_id: loaded, baseline_capture_id: baseline, lever_mm: <mount to
tool tip, operator-stated>}`. Report tilt with its resolution and the dynamic displacement per
tone; repeat with sensors at several points on the head to see where it bends.

**Tailstock chatter.** Record the tailstock sensor through a cut (`mcpVibrationJobs` records
every file job automatically; the job's `get_gcode_job_status.vibration` gives the capture id).
Analyse with the commanded S as `rpm_hint` and the cutter's `flutes`; report the non-harmonic
peaks, their level against a non-cutting window of the same capture (`from_s`/`to_s`), and
whether they track the spindle.

**Spindle RPM.** `rpm_hint` = commanded S; `flutes` adds the tooth-passing order. Prefer the
toolhead sensor; compare with the microphone telemetry (`get_job_telemetry`) when both exist.

**Rotary absolute B.**
- Readings are still: B stopped, spindle off, at least 4 s (3 whole seconds of data). `measure_rotary_angle` reports
  `still` (and why not: vibration, gravity drift, gyro), the controller's B at start and end, and
  whether B moved.
- Calibrate once per mounting: in ONE power session, take readings at >= 4 controller B angles
  spread over >= 180 deg (0/90/180/270 is ideal). Each B change is a rotation the operator
  approves through the normal tools; each reading is `measure_rotary_angle`. Then
  `calibrate_rotary_accelerometer {readings: [{capture_id}...], reason: "<who, when, session>"}`.
  Quote the residual; above ~0.2 deg a reading was not still or a B was misreported.
- After a power cycle: `measure_rotary_angle` gives `absolute_b_deg` and
  `controller_minus_absolute_deg`. Check `trust_problems` first (a moved sensor or jig voids the
  calibration). Correcting the offset is MOTION and a frame decision for the operator: offer the
  rotation that would bring the chuck to absolute zero, staged through the normal tools on their
  word - never write the controller's B count, never inject G92, never assume the correction.

## Limits

Captures: 0.5-600 s (`duration_s`), look-back up to the ring (`mcpVibrationBufferS`), re-analysis
up to 600 s of raw samples. Readings over 60 s return at once - poll `get_vibration_capture
{wait_ms}`. Poll-mode chips (BNO055, MPU-6050, ...) are for gravity and slow vibration only; a
spectrum from them is limited by their uneven rate (`poll_jitter_ms`). The engineering reference
is the "Accelerometers" section of `src/server/services/mcp/README.md`.
