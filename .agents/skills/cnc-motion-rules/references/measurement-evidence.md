# Reconcile measured evidence before modelling or cutting

Read before constructing cutting geometry, fitting an indexed transform, releasing a CAM file,
or requesting more probing to resolve a geometry discrepancy. This is an offline evidence
review; it grants no motion or calibration-write authority.

## Retrieve first; do not send the operator back to the probe

Search the current and linked chats, saved job results (including partial results), survey
files, registration/handoff records and applicable stored geometry before declaring a quantity
unknown. Read the original contacts where available, not just a summary or model dimensions.
An agent forgetting a measurement, a new chat, an expired live position, a tool change with a
measured transfer, or a new B index does not by itself invalidate the physical survey.
Historical geometry and current controller position are separate evidence.

Homing turns B to 0. A saved B180 contact does not directly supply a B0 approach height.
For direct reuse, establish unchanged clamping and return to its B through an authorized
`probe_program` `rotate_b` op; alternatively use a physically validated rotary transform with
its uncertainty. A known transform preserves evidence without re-probing every angle. If the
mounting or transformation is unresolved, use old views to locate the region only, and identify
the specific missing measurement rather than repeating the whole survey. Age alone (e.g. a
seven-day cutoff) is not an invalidation rule.

Preserve each contact's source/job, date, XYZ, B, direction, probe calibration and tip convention,
mounting/datum context, uncertainty and sampled extent. Convert with the calibration that
applied when measured; never reinterpret old contacts using today's probe length. Keep raw
contacts immutable alongside their derived physical surfaces and transformation provenance.

Classify each required constraint as covered, derivable from saved evidence, contradicted,
or genuinely missing/invalidated. Compute what is derivable and reconcile contradictions
before proposing acquisition. A model disagreeing with a probe is a model/registration problem
to investigate, not proof that the probe must be repeated.

**Do not request or stage repeat probing of an already covered quantity.** Additional probing
requires an identified missing constraint or a specific reason its prior evidence is invalid
(e.g. re-clamping, movement or removal of that surface, unresolved calibration, insufficient
coverage/precision for the proposed operation). State the existing evidence, exact remaining
gap, why saved data cannot resolve it, and the smallest targeted measurement that will.
Never request a blanket resurvey to compensate for an incomplete evidence review. Reuse all
unaffected results. A stopped cut changes its swept stock region, not every datum and survey;
distinguish confirmed removal from uncertain execution instead of assuming the whole file ran.
If records are inaccessible, state which are unavailable and seek their recovery before
proposing to recreate the survey physically.

## Measurements constrain the model; the model cannot certify itself

Maintain a reviewable evidence table for quantities controlling the cut: source measurements,
derivation, frame/tool/B, fitted value, uncertainty, check residuals and applicability. Mark
estimates, inferred surfaces and visual proxies explicitly; their presence in a store, CAD
property, generator constant or earlier successful audit does not promote them to measurements.

Fit stock placement, rotary axis and inferred faces jointly against applicable saved contacts.
Direct measurements constrain inferred dimensions. Do not cherry-pick a face/depth while
ignoring its absolute height, opposing faces, side contacts or earlier contradiction notes.
An unresolved disagreement affecting entry, engagement, remaining support or clearance blocks
release. Record its resolution or specific evidence-based exclusion; do not merely carry a
warning forward while using the contradicted value. Never average incompatible setups together.

Use one reconciled, versioned registration/evidence record for CAD, CAM and the post; do not
independently copy estimated constants into each. Validation must also read the original
measurement evidence. Comparing NC with a preview generated from the same assumptions proves
internal consistency only. Check transformed predictions against saved contacts, preferably
contacts held out of the fit; label fit residuals honestly when no independent check exists.
Existing held-out measurements count: an independent check does not imply a fresh probe move.
Controller/WCS readback and tool-setter transfer do not establish stock or rotary registration.

Propagate uncertainty through the actual transform. With p' = a + R(p-a), an axis-location
error contributes (I-R) delta-a: zero at B0, twice the transverse axis error at B180. A successful
B0 check therefore cannot verify an axis used for B180. A residual of 0.15 mm alone cannot
certify a maximum 0.1 mm engagement; use the operation's tolerance and full uncertainty bound,
not a generic registration threshold. Correct/restrict the plan using existing evidence first.

## Release uses actual material engagement, including the first pass

Independently parse the exact posted file and resolve the selected WCS and fitted tool. For
each indexed entry and cutting level, compare the physical cutter envelope with the applicable
measured starting stock and stock remaining after earlier confirmed cuts. For a flat-endmill
-Z floor cut: physical tip Z = work Z + verified machine toolhead Z at work zero - effective
cutter length; local axial engagement = measured floor Z - tip Z (positive into material).
Use the appropriate cutter geometry and direction for other cuts. Compare across the swept
band, with bounded interpolation/coverage and uncertainty, not just one convenient station.

The difference between nominal depth parameters or successive NC levels does not establish
first-pass engagement. A comment saying "0.1 mm cleanup", a stepdown limit, travel bounds,
G54 verification, a preview match or `validate_gcode` success is not a material-depth check.
Record measured starting surface, posted tip/envelope, engagement bound and evidence for each
visit. Reject release if a claimed cleanup or maximum step is contradicted or unbounded.
Repair the registration and regenerate affected models/files; smaller steps or feeds do not
repair a wrongly located surface. Invalidate dependent artifacts when their evidence changes.

## Incident regression: B180, 28 September 2026

These are historical diagnostic values, never current machine setup constants. An estimated
axis physical Z112.4 and inferred B0 bottom Z93.95 produced a B180 face at 2*112.4-93.95 =
130.85. Saved B180 contact Z204.4 with probe length 70.95 put the real face at 133.45.
The generator used a measured groove depth 6.1 and target 6.2 to label a single pass "0.1 mm".
Posted work Z-35.7, verified toolhead origin Z235 and cutter length 74.6 gave physical tip
Z124.70; saved floor contact Z198.3 gave floor Z127.35: **2.65 mm local engagement**.
FreeCAD and its NC audit shared the bad geometry; a pre-existing contradiction note did not
block release. The cause was promoting unresolved estimates into authoritative geometry and
validating against their own outputs. The missing posted-depth comparison was the last defence.

Already saved B90/B270 outer side contacts subsequently fitted axis X169.325, physical Z113.800
and bottom Z94.000; held-out B180/groove contacts agreed within 0.15 mm. Re-probing was not
needed to resolve that registration error. This fit does not certify an entire cutter sweep or
a 0.1 mm maximum engagement. The operator's roughly 4 mm observation was not measured across
the whole path; 2.65 mm is the established discrepancy at the saved station.
