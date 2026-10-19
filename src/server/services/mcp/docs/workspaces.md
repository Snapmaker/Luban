# Human-gated workspace origins

Prefer one established work coordinate system, including across indexed B cuts. Multiple
workspaces are frowned upon but supported when necessary to utilise an existing G-code job.
A valid datum may become physically obstructed after rotation: retain its coordinate reference
and use a verified entry point, rather than returning to zero or creating another offset.

`set_workspace_origin` stages a replacement of all XYZ for explicit G54 through G59.3.
`origin_machine` names where work XYZ=0 should lie in machine coordinates; Z is **toolhead Z
for the fitted tool**, not physical surface Z. `datum_reference` records measurement/job
references, tool and B context; `reason` explains the change. Neither field is automatically
proof of physical registration. Independently check an accessible measured reference.

`select_workspace` stages selection of an existing workspace, with the same explicit target
and reason, but never sends G92. Both tools return a confirmation link and require the
operator's approval through `start_gcode_job`. No axis moves; a measured or derived origin
can be assigned while parked, without visiting it. Workspace setting is not clearance proof.

## Execution and failure contract

The runner refuses changed position, B, current offset, connection or MCP command sequence
since staging. It requires idle/homed status, toolhead off, no overtravel and fresh heartbeat.
It invalidates older staged approvals before sending commands and again on completion/failure
to catch jobs staged against an intermediate offset.
Restage later jobs after verification; approving the old job again does not update its review.

The firmware sequence is G21, standalone G53, the requested G5x and M114. The G53 transition
forces a selection change so the runner can require `Select workspace <index>` acknowledgement
(0–8). It obtains two distinct agreeing heartbeat reports before proceeding. For an origin
write, G92 XYZ is calculated as stationary machine position minus the requested machine origin;
it writes once, then checks two fresh reports for unchanged machine/B and the expected offset
and work position. All other stored workspace origins remain untouched. G21 leaves units in mm;
no G90/G91 or B/E origin change is sent.

The requested workspace remains active. Other MCP procedures commonly restore G54, including
transport/probing helpers; `restore_work_frame` explicitly restores G54. Verify/reselect the
workspace before an existing job. The thread converter and CAM probing importer retain their
own G54-only restrictions. This feature does not change those postprocessors.

Missing acknowledgement, timeout, stop, connection loss or mismatched readback produces an
unverified result with whether selection/write was attempted and any verified previous offset.
The controller may already have changed. No retry, rollback or recovery motion is sent; inspect
and re-establish a coherent frame before continuing. Firmware variants without the expected
workspace acknowledgement fail before G92. This path has offline tests, not hardware qualification.

## File review

The heartbeat reports one offset without a workspace identifier or complete offset table.
The validator recognises G54–G59.3 but leaves machine extents unresolved for named-workspace
files, mixed frames and origin rewrites. It cannot honestly resolve a G55 section using an
unidentified current offset. Verify every required workspace and review each section against
its own offset. An unchanged file with no workspace selectors, declared `frame: "work"`, can
still resolve against the reliable current offset. So can a submitted file that selects only
G54 before its first move, such as converted thread-milling output. Its report sets
`machineZResolvedFor: "G54"` and the confirm page states the condition. After approval,
`start_gcode_job` selects G54 through the same no-motion runner as `select_workspace`
(acknowledgement plus two agreeing readbacks). It refuses to upload or stream unless G54's
offset Z matches staging within 0.05 mm (`ending.kind: "workspace-unverified"`). When the
selection changed the offset, other staged jobs are invalidated. Server-emitted envelopes do
not run this check and remain unresolved. Do not strip selectors to silence warnings.

Firmware references:
[workspace selection](https://github.com/Snapmaker/Snapmaker2-Controller/blob/main/Marlin/src/gcode/geometry/G53-G59.cpp)
and [G92 origin updates](https://github.com/Snapmaker/Snapmaker2-Controller/blob/main/Marlin/src/gcode/geometry/G92.cpp).
