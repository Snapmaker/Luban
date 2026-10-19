# The stored rotary axis: historical until checked

Read before any CAM rotates geometry about `geometry.rotary`, before mixing readings taken at
different B angles, and before quoting `axis.*` in a program. Motion rules apply unchanged.

## What the store holds

The axis is a LINE, not a scalar. `get_stored_state → geometry.rotary` carries it as
`rotaryAxisPoints` — the measured `(x, z_physical)` at two or more Y stations, each with its
`source` and `measured_at` — and the line fitted through them: `axisX` / `axisZ` at
`referenceY` (the stations' centroid), `yawDeg` (from machine +Y in XY, positive = toward +X as
Y increases), `pitchDeg` (positive = rising with Y), the fit's station count, Y span and worst
residual. The operator's rotary is yawed off machine Y by about 1.2° (or ~1.2 mm over 250 mm —
which is unresolved until two stations are measured) and that is mechanically unfixable, so one
X for every Y cannot describe it: over 250 mm of stock a 1.2° yaw is 5 mm of X.

`skew: "unmeasured"` means only the legacy scalars `rotary_axis_x` / `rotary_axis_z_physical`
exist: yaw 0 is ASSUMED and the same X / Z is handed out at every Y — the pre-#155 model, kept
loading unchanged and flagged. Such a store was written by `set_probe_geometry` from one
measurement, with a reason string as its only provenance: no date field, no probe-length field,
no clamping. Once stations exist the scalars are derived from the line (its values at the
reference Y) and refuse to be set by hand. `axis.z_contact` adds the CURRENTLY stored probe
length to the physical Z — two eras in one number if the probe was re-fitted since.

Treat it as a historical estimate tied to the probe length, clamping and stock it was measured
with. On this jig it came from the 2026-09-05 four-face survey with a 71.3 mm probe on the raw
stock; the 2026-09-27 contacts on the same job, with a 70.95 mm probe and re-clamped work, put
it about 0.8 mm off in X and about 1 mm off in physical Z. These discrepancies do not by
themselves diagnose mechanical axis movement or its cause.
The later saved-contact fit for that mounting gave X169.325 / physical Z113.800, with held-out
residuals up to 0.15 mm. Neither historical value is a new setup default. Axis-location error
propagates as (I-R) times the error; at B180 the transverse contribution doubles.

`axis.z_physical` is a PHYSICAL height: the toolhead sits a whole probe or tool length above it
at contact. It is never a toolhead target or a `move_z` argument, and does not by itself
establish work Z0; a derived datum requires the measured registration in `work-datums.md`.

## Check it against opposite-face contacts before CAM rotates about it

First recover and reconcile saved opposite-face and side contacts under the
[measurement-evidence rules](../../cnc-motion-rules/references/measurement-evidence.md).
This check is an offline calculation when those records suffice, not an instruction to probe
again. State the measurement-time probe-length basis of every number, then:

- **Z from opposite tops.** A −Z contact on the B0 top and on the B180 top at the same stock
  point (mirror the X about the axis, same Y), both toolhead Z with the same probe: axis contact
  Z = (top0 + top180 − T) / 2, where T is the MEASURED thickness there — B90/B270 side-silhouette
  width minus one ball diameter, or the operator's calipers — never the CAD nominal. Physical
  axis Z = that − probe length. Keeping a stored value that would need a thickness the part does
  not have is the tell.
- **X from opposite sides.** Side contacts at B90 and B270 on the same feature: the silhouette
  centre at each angle is (west + east) / 2 (tip-centre; the ball radius cancels for the centre,
  not for the width), and axis X = (c90 + c270) / 2. Compare existing Y stations where available;
  require another station only if the operation needs an otherwise unbounded axis tilt.
- **Record each station where it was measured.** The check above yields the axis AT ONE Y: the
  side pair's Y, and the opposite tops' Y. Feed it to the store as that station, not as a new
  scalar: `set_probe_geometry {rotary_axis_point: {x, y, z_physical, source, measured_at},
  reason}` with the job ids, the measurement-time probe length and the clamping in `source`.
  The first station needs a second in the same call (`rotary_axis_points: [near, far]`) — one
  point does not fix a line — and the two must sit at different Y (further apart is better: the
  yaw's uncertainty is the two X uncertainties over the Y span, so 250 mm apart resolves 0.1 mm
  of X into 0.02°; 50 mm apart only 0.1°). Restating a station at a Y already stored replaces
  it. A ground bar chucked and probed with `probe_circle` at two Y stations is the clean
  measurement; the stock's own machine-cut edges report ~0 because the machine cut them in its
  own frame. More than two stations are fitted by least squares and the worst residual is
  reported — a residual bigger than the pair's uncertainty is a station to re-measure, not to
  average in. Record B with any reference hole probed as an axis point: the chuck hole centre
  probed without its B is useless as one.
- **What agrees with what.** (top180 − top0) / 2 against (c90 − c270) / 2 tests the indexing and
  the section's squareness; it says nothing about the absolute axis Z — only T carries that.
- **Assumptions to write down:** exact 180° between the paired angles, flat parallel faces at
  the contact points, nothing re-clamped between readings, the B direction identified from a
  known feature (the 9 mm groove did that on 2026-09-27), and the stated agreement tolerance
  (the cut's engagement/clearance tolerance, with propagated uncertainty). Outside it: resolve
  calibration, frame, B, mounting and inference conflicts using saved evidence first. Fit the
  axis and inferred faces jointly; check held-out contacts. Do not retain an estimated axis
  by discarding contradictory measured faces. New probing requires a specifically unresolved
  constraint under the evidence rules, not merely a bad model fit. If recording a reconciled
  calibration is authorized, use `set_probe_geometry` with job IDs, measurement-time probe
  length, clamping, date and residuals in the reason — never a hand edit of the store.

## `axis.*` in a program is evaluated at the op's own Y

`probe_program` seeds `axis` from the line at its reference Y (`axis.at_y`, `axis.reference_y`,
`axis.yaw_deg`, `axis.pitch_deg`, `axis.skew` ride along with `axis.x`, `axis.z_physical`,
`axis.z_contact`). When the skew is measured, the runner re-evaluates `axis.x` /
`axis.z_physical` / `axis.z_contact` AT EACH OP'S OWN Y STATION before resolving that op's
references — the Y read from the op's arguments: `start_y..end_y` mid for a path, `y_min..y_max`
mid for a grid, `center_y` for an outline, `start_y` for a wall follow or trace, the hops' Y for a
sequence, the mean of `wall_a.y` / `wall_b.y` for a corner. The reference grammar is unchanged
(dotted paths, no `axis.x_at(y)` call: the confirm page prints a formula the operator reads at a
glance); the job record phase `op-<id>-axis` and the resolved-reference line say which Y was
used and what the axis came to there. An op whose Y the runner cannot read (a sequence with no
hop, an unmeasured skew) resolves at the reference Y, and says so. A side-pair sequence 100 mm
from the reference Y on a 1.2° yaw therefore gets an `axis.x` 2 mm different from one at the
reference — which is the point.

`rotate_b`'s swept-cylinder check (`swept_radius_mm`) uses the line too: the tip's perpendicular
distance from the yawed, pitched axis at the toolhead's live Y, not its X distance from one
scalar. A tip clear of the cylinder at the reference Y can be inside it 125 mm along the stock.

## Readings at other angles live in the rotated pose

A contact taken at B θ is a point on the stock as it stands rotated; to use it beside B0
readings, rotate it by −θ about the measured axis line (X = axis X AT THAT Y, Z = physical axis
Z at that Y, along the line's own direction — yaw and pitch included), with the sign fixed by
the identified B direction — not about the CAD origin, and not by relabelling a B180 physical Z
as a B0 coordinate. Each indexed visit is its own setup
(`cnc-motion-rules/references/cutting-programs.md`). A B180 flip of a part referenced to the
stored line returns a Y-aligned edge 2θ off when the stored yaw θ is wrong — which is why the
skew is measured, not assumed, before any multi-B job or any part from raw stock; B0-only work
on a machine-cut part needs none of this (the machine cuts in its own frame).
