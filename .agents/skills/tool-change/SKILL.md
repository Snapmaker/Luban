---
name: tool-change
description: "Change the CNC tool and keep the work origin true — measure the old tool on the tool setter, park for a manual swap, measure the new tool, and shift the work origin Z by the length difference, all through the Luban MCP tool surface. Use whenever the user wants to change bits/tools mid-job-setup without re-touching the stock."
---

# Tool change without losing the work origin

> **Load `cnc-motion-rules` first; do not plan motion without it.** The motion laws,
> coordinate doctrine and position-of-record rules live there and are assumed here.

A tool change replaces the one physical thing the work origin Z was calibrated
through: the tool tip. The tool setter (fixed switch on the bed, probe feed
channel `toolsetter`) measures each tool's trigger height, and the difference
between two measurements IS the length difference — so the work origin can be
shifted exactly, without ever re-touching the stock.

## Preconditions

- Probe feed connected (`get_probe_feed_status` to check; `connect_probe_feed`
  if not - the feed auto-connects at start when configured) and the machine
  homed and idle. If the status shows `unavailable: true` / `bridge: not
  detected`, the USB sensor bridge is unplugged - tell the operator, do not
  work around it. If a tool refuses with "the tool setter is disabled
  (Settings -> MCP Server)", the operator switched that sensor off in the app;
  ask them to enable it - never proceed without the sensor. The tool setter's overtravel switch is a tripwire ONLY while
  this procedure (or other MCP motion) is running: pushing the setter past
  contact mid-run latches the alarm; by hand with the machine idle it just
  flashes the Workspace pill. The Workspace -> Connection pills (Tool Setter /
  Setter Overtravel) should both read green before you start.
- Tool setter reference and the tool-change park position stored
  (`get_tool_setter_config`; the operator sets them once with
  `set_tool_setter_config` — on this machine the park is Z at the homing
  height, X at the far end, Y free).
- Every motion step below stages a job the OPERATOR approves on a confirm page.
  Call `start_gcode_job` with `wait_for_approval_ms` (e.g. 110000) after
  delivering the confirm URL and ending the staging turn: their click starts it
  with nothing to copy (`approved: false` on
  timeout means call again). If hand-off is disabled in their settings, the
  one-time code they give you goes in as `confirm_token`.

## Two flows — ask which one the operator is using

In both flows, a successful `run_tool_setter` replaces the active clearance tool with the
measured protrusion (`active_tool_replaced` reports old → new). Re-read `get_active_tool`
after each measurement and after the manual swap; a shorter tool lowers physical-basis
clearances. Tool-change parking and reconnect/restart mark the persisted assertion stale.
If the operator wants a conservative longer clearance bound to govern, explicitly reassert
it with `set_active_tool` after measurement; never overwrite probe contact calibration with it.

Ask it in the same single message as the other unknowns (both tools' approximate protrusion,
whether the work origin was set with the tool now fitted). Flow A is four approvals — measure
old, park, measure new, apply — each announced; the swap itself is the operator's hands and
their word, never inferred.

**A. MCP-managed offset** (operator at the computer): measure old → park → swap
→ measure new → `apply_tool_length_offset` shifts the work origin. Steps below.

**B. Touchscreen manual-swap wizard** (operator at the machine): the FIRMWARE
matches the tip positions itself, so no origin shift is applied by MCP — the
agent's job is only to find and HOLD the trigger height for each tool:

1. `run_tool_setter` with `stay_at_trigger: true` — one move up, over to the
   setter, measure, and hold the tip in contact. Send no other motion.
2. The operator confirms the position on the touchscreen and swaps the tool by
   hand; the wizard returns the new tool over the setter near height.
3. `run_tool_setter` again with `stay_at_trigger: true, start_from_current:
   true` (skips travel; verified over the centre within 1.5 mm). The operator
   confirms the matched position on the touchscreen — the firmware applies the
   offset. Do NOT also call `apply_tool_length_offset` (it would double-apply).
4. Only after the operator says the wizard is finished may motion resume.

If the new tool reads already-triggered before the second run (a longer tool
pressed into the setter by the wizard), the run refuses to start - the
operator raises it slightly from the touchscreen first.

## Complete the datum work before removing the probe

When this swap follows setup probing, first establish and independently check the milling WCS
using [accessible work references](../cnc-motion-rules/references/work-datums.md). Record its
XYZ/orientation, B context and model registration while the probe is still available. A machine
ready to measure tool lengths is not necessarily ready to cut: swapping cannot repair missing
X/Y registration, make an inaccessible origin probeable, or validate the approach to work zero.
One established WCS may serve all indexed cuts in the same mounting; the tool-length transfer
preserves it and does not require new XYZ zeros or datum probes for each B angle. After a
rotation or tool swap, re-evaluate any planned origin return: valid offsets do not prove that
the previous route clears the rotated stock or the new cutter/holder. Retain the reference
and choose a different verified entry if zero is obstructed.

## The sequence (flow A)

First establish that the work Z reference belongs to the outgoing tool, either
from its original touch-off or a verified chain of earlier tool-length transfers.
`originOffset` does not record tool identity. If that history is unknown or broken,
measuring an arbitrary old/new pair cannot repair it: the operator must re-establish
the reference before cutting. For thread milling, this is the precondition behind
`tool_length_applied: true`; see [cnc-thread-milling](../cnc-thread-milling/SKILL.md).

1. **Measure the old tool** — `run_tool_setter` with the operator-stated
   `bit_length_mm` — the tool's PROTRUSION from the collet in mm (a length, never its
   cutting diameter; declare it low rather than high). Skip only if the last stored measurement
   (`get_tool_setter_config` → `measurements.last`) is from this same tool,
   this session, and the operator confirms nothing has moved. A completed run leaves the
   head at the traverse height (machine Z328 — `result.finalZ`), never at its start height,
   so the park move that follows needs no separate Z raise.
   If the outgoing tool is the touch probe, include `accept_probe_contact: true`.
   Never calculate `old_trigger_z` as setter surface + stored probe effective length;
   that is not a measurement from this connection and cannot satisfy the reuse rule.
   Stored probe calibration for interpreting surface measurements and a live tool-setter
   pair for transferring work Z are different evidence. Probe trigger pretravel and
   setter contact can also differ; do not invent a correction if the reference method
   is uncertain — resolve how Z0 was established with the operator.
2. **Park** — `goto_tool_change_position`. One approval, two
   `start_gcode_job` calls: Z rises to the park height first, then X/Y.
3. **The operator swaps the tool by hand.** Wait for their word; never infer
   it. Ask them for the new tool's approximate length.
4. **Measure the new tool** — `run_tool_setter` with the new `bit_length_mm`.
   The measurement history now holds previous = old tool, last = new tool.
5. **Shift the work origin** — `apply_tool_length_offset {"reason": "..."}` then
   `start_gcode_job {job_id, wait_for_approval_ms: 110000}` (defaults to those
   two measurements). It stages a single `G92` — nothing moves; the work frame
   shifts by `new − old`. A longer tool makes the current work Z read LOWER.
   This is the sanctioned tool-length transfer (`cnc-motion-rules` §4): it mirrors what
   the touchscreen wizard does after its two operator confirmations. Never `G92` by hand.
6. **Verify** — `get_position`: `originOffset.z` must have changed by the
   delta, and the operator should sanity-check the displayed work Z against
   physical reality before any cutting.

## Failure modes to respect

- The spread reported by `run_tool_setter` is the trust metric: passes that
  disagree by more than one fine step mean feed latency or a loose tool —
  re-measure before applying any offset.
- `apply_tool_length_offset` refuses deltas over 50 mm; if it triggers, the
  stored measurements are not an old/new pair (stale history, wrong bit
  declared). Pass `old_trigger_z`/`new_trigger_z` explicitly from known-good
  values instead of loosening anything.
- If the overtravel alarm latches at any point, everything stops until the
  operator physically inspects and explicitly clears it - the Clear alarm
  button on the ALARM pill in Workspace -> Connection, or
  `clear_overtravel_alarm` with their words as `reason`. Both refuse while the
  sensor still reads triggered.
