# Choosing and verifying a milling work coordinate system

Read before choosing a CAM work coordinate system (WCS), registering a model for cutting,
or declaring a setup ready for the probe-to-cutter swap. This is planning guidance under
`cnc-motion-rules`, not a new origin-write or motion permission.

First apply [measurement evidence](measurement-evidence.md): retrieve existing datum and
survey records, derive missing geometry from them, and reconcile contradictory assumptions.
Re-use valid saved reference checks; verification does not automatically require another
contact. A fresh controller state check does not invalidate a historical physical survey.

## Select a datum that can be established and checked

Prefer accessible, stable reference surfaces/features that can be probed in the mounted
setup and rechecked for the operations that need them. Decide this before finishing CAM or
removing the probe. A convenient CAD centre, bounding-box corner or current G54 offset is
only a candidate until its measurement method, registration and approach are established.

For each candidate, record:

- **XYZ and axis directions:** which face, edge, fitted hole/boss centre or other reference
  establishes each coordinate and orientation; whether the zero is a direct contact or a
  derived point; the selected work system and B orientation. One top contact establishes a
  height at that XY, not X/Y zero, stock squareness or rotational alignment.
- **Measurement access:** entry/exit columns and lateral approach corridors, search bounds,
  ball diameter, exposed stylus reach, probe body/collet clearance and nearby stock/fixtures.
  The ball reaching a point does not prove the body clears a lip or jaw. A bore smaller than
  the ball cannot be an internal probing datum; choose accessible exterior references or
  another supported measurement method.
- **Persistence and repeatability:** which reference survives the cut or remains accessible,
  its measurement uncertainty and required recheck tolerance. If machining removes it, define
  a measured reference transfer or witness feature before removal. A sacrificial tab or
  unregistered CAD surface is not automatically a repeatable datum.
- **Return access, if needed:** where work X0/Y0 resolves in machine coordinates and whether
  a complete route there is clear with the probe or fitted cutter/holder at the intended B.
  Check machine travel and the whole swept route, not only the endpoint. The datum can remain
  valid where physical access is blocked: mark it reference-only at that orientation and
  choose a separate verified approach/entry point. Do not require a visit to zero to use it.

The mathematical origin need not itself be touchable. A fitted bore centre, virtual corner
or rotary-axis origin can be legitimate when derived from accessible measured references,
with an explicit recheck method and safe approach. Do not place a probe at that virtual
point or send it to work Z0 as a way to verify the calculation. For a setup requested to
have a directly probeable zero, prefer an accessible retained surface/feature and explain
any proposed derived alternative before treating it as the selected datum.

## Keep the model, work frame and tool reference distinct

A CAD modeling origin is not evidence of the physical setup. Record the measured registration
between model geometry and the intended work frame, including axis directions, units and
indexed B orientation. Do not silently relabel a model's XYZ as G54, or call a stored physical
rotary-axis height a machine toolhead Z. CAD placements belong in the CAD/CAM setup; live
work-frame job extents are resolved by MCP against the verified controller offset, not by
hand-editing an exported program's coordinates.

A coherent `get_position.originOffset` proves the controller's current mapping, not which
physical surfaces or tool established it. Retain an existing work frame when its datum
history and independent checks are valid; otherwise establish the missing references rather
than adopting the snapshot to make the model match. Reading, homing, `restore_work_frame`,
`goto_work_origin` and `set_landmark` do not set or validate a new milling datum.

Acquire missing datum evidence with bounded machine-frame probing under the existing motion
rules, not with motion dependent on the unverified work frame. Setting/re-zeroing the work
origin can use the human-gated `set_workspace_origin` workflow below or the operator's
supported touchscreen/Luban workflow. `apply_tool_length_offset` transfers an established
Z reference across tools. Do not inject G92/G10 or choose another workspace to hide a
registration mismatch. Re-read the selected live frame after setting it
and check an accessible reference with a predicted coordinate/tolerance, not merely the
zero display. Keep that check separate from the measurements used to construct the datum: a
contact that fed the origin cannot also verify it (an origin set as rim + 30 and "checked" by
re-probing the rim is circular — use another face, an edge, or the opposite-angle rim).

Before removing the probe, record the measured registration, reference check, remaining
uncertainty and the reference orientation needed to recheck it. Preserve the established
tool-tip Z reference through the measured tool-change flow. A setter pair transfers a valid
Z reference; it cannot establish missing X/Y registration, repair an unknown old-tool
reference or validate a CAD placement.

## Reuse one WCS across indexed rotary operations

**One verified WCS can serve B0, B90, B180 and B270 cuts in the same mounting. Prefer to
retain it.** B indexing changes stock orientation; it does not require or itself perform an
XYZ re-zero. Do not create a workspace or probe a new zero merely because another face is
being cut. The measured relationship between the common WCS, rotary axis/centre and B datum
must be represented correctly in the CAM setup/post for all indexed toolpaths.

For example, a retained top reference measured at B0 can establish common Z0. At B90 the
rotated stock top can have a different work Z; that is expected and is not a reason to
re-zero Z. The reference only needs a reproducible verification method, such as returning to
its established B orientation or checking a fixed fixture reference. It need not be directly
probeable at every cutting angle. A measured rotary-axis-centred frame is also valid; the
physical access and return-path checks still apply.

Check the indexed stock/tool/fixture geometry and approaches for each operation using the
common registration. Reuse valid measured geometry and the verified rotary transform;
request additional probing only where evidence is missing or the setup has changed, not as
a mandatory per-angle cycle. Model rotation and translation must account for the measured
axis, which need not pass through work zero. Do not assume the controller rotates the XYZ
work frame or applies tool-centre-point compensation simply because a B command was sent.
The stored axis is historical until checked against opposite-face contacts for THIS clamping
and measurement-time probe calibration
([rotary-axis](../../cnc-probing/references/rotary-axis.md)). Reconcile saved contacts first.
Axis-location error contributes (I-R) times the error: zero at B0 and twice the transverse
error at B180. State its propagated uncertainty before CAM uses it; B0 agreement is insufficient.

**Each indexed visit is its own setup.** A visit at B90, a visit at B270 and a later finishing
visit at B90 are three setups: each takes the previous setup's output as its input stock, has
its own registered WCS reference and an inspectable toolpath, and is released as its own file.
Do not merge the first cuts and the finishing cuts at an angle into one setup because the angle
matches. Readings taken at another angle are in the rotated pose: rotate them about the
measured axis before mixing them with B0 coordinates; a B180 physical Z is not a B0 coordinate.
Retained-connection proofs and file release: `cutting-programs.md`.

**Retained reference does not mean retained access.** Rotation can put stock, a jaw or an
overhang over the old work-zero location or its approach. Do not automatically call
`goto_work_origin`, insert an X0/Y0 positioning move, or reuse the previous approach/descent
because the WCS remains valid. Assess the complete route and tool/holder clearance in the
new orientation before any such return. If obstructed or unverified, keep the WCS as the
coordinate reference and use an independently verified entry point at suitable clearance.
No return to zero is needed to execute correctly registered toolpaths, and no re-zero is
needed merely because zero is no longer reachable. A prior B0 route or safe arrival height
is not clearance evidence at B90.

**Multiple workspaces are frowned upon. Prefer one established WCS.** Firmware G54 through
G59.3 are supported when necessary to utilise an existing G-code job with those workspaces;
verify each required offset and its measured registration before using the job. Do not add
workspaces simply for each B angle or to conceal a registration error. Distinguish a loss of datum registration from a changed surface height
or clearance after indexing.

## Work zero is not a clearance move

`goto_work_origin` stages **XY only at the current toolhead Z**. It neither raises nor moves
to work Z0: every return to, or approach near, work zero is preceded by its own `move_z` to
the park height (machine Z328; the floor is Z320), and the plan says so and states its
traverse height in machine Z. It refuses an untrusted offset, ordinary transport below the
motion floor, out-of-travel destinations and mapped landmark conflicts. These checks do not certify an
unmapped fixture or the whole cutter/holder envelope. A good datum still requires a checked
route from the actual starting position, B orientation and tool; no datum makes every future
return safe. If that route is blocked, do not visit the origin; retain the reference and plan
another clear approach to the operation.

Review the first real positioning blocks, approach, linking moves, deepest cut, withdrawal
and final position in the selected live frame. Work Z0 is a datum, not a safe height; a
positive work Z or a CAM clearance value alone proves no machine/fixture clearance. Do not
use `G0 X0 Y0 Z0` as a setup check. Any needed raise, XY transfer and descent follow the
motion rules and the approved procedure/file envelope.

A setup is ready for cutting only when datum measurement and recheck, model/work-frame
registration, fitted-tool Z transfer, indexed orientations and complete approach/cut/exit
clearances are established for the exact program. Otherwise identify the specific missing
measurement or setup action; an attractive review model or numeric offset is not readiness.
The release route for the file itself — post word list, `validate_gcode`, the independent
parse from first move to final retraction, B words — is `cutting-programs.md`.


## Set a measured origin without travelling to zero

Call `set_workspace_origin` with an explicit `workspace` (normally G54), all XYZ in
`origin_machine`, `datum_reference` identifying measured evidence/tool/B context, and `reason`.
The requested origin is the machine-coordinate position at which work XYZ should read zero;
**Z is toolhead Z for the fitted tool**, not the physical surface height. A measured offset or
virtual centre can be assigned while the head remains at a verified parked position. Do not
spend an approval or a descent merely to position at the proposed zero before setting it.

Example values are illustrative, not authorisation for this setup:

```json
{
  "workspace": "G54",
  "origin_machine": {"x": 230, "y": 245, "z": 231.3},
  "datum_reference": "Measured rim/edge job IDs; calibrated probe fitted; B0 registration; independent witness check",
  "reason": "Establish the common measured datum for indexed cuts"
}
```

Deliver the confirm URL immediately. The operator reviews replacement of **all XYZ** in the
named workspace; `start_gcode_job` requires their approval. Staging sends no controller
commands. Execution checks that position, B, current offset, connection and command sequence
still match the staged setup. It selects the named workspace, requires firmware acknowledgement,
reads its old offset, writes once and verifies two fresh agreeing offset/position reports.
No B/E origin is written, and no other workspace's stored origin is changed.

Use `select_workspace {workspace, reason}` when an existing job needs an already established
workspace; selection is human-gated and verified without rewriting the origin. These tools
leave the requested workspace active. Standard MCP probing/transport and `restore_work_frame`
can reselect G54: recheck/reselect before the file job. The thread-milling converter and CAM
probing importer retain their own workspace restrictions; general firmware support does not
broaden those importers.

A workspace change makes earlier staged jobs stale, including previously approved jobs.
Complete and verify the setup, then restage the cutting job against it. If acknowledgement or
readback fails, report the result as **unverified**; the controller may already have changed.
There is no automatic retry, rollback or recovery motion. Inspect the frame/offset before
continuing. Successful readback verifies the coordinate assignment, not physical datum
accuracy or access: retain the independent reference check and full path review above.

A file naming workspaces cannot have all machine extents established from one anonymous live
offset. The validator marks those extents unresolved, with one exception. A submitted file
that selects only G54 before its first move resolves against the live offset on the stated
condition that it is G54's. `start_gcode_job` proves that before streaming: it selects G54
with no motion, requires the acknowledgement and two agreeing readbacks, and refuses unless
G54's offset Z matches staging. Server envelopes (direct moves, procedures) do not get this
check and stay unresolved. Review each other required workspace/section separately. Preserve
an existing file's workspace selectors instead of silently rewriting them to make the
validation display look resolved.
