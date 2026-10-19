# Critique: skills and documentation assessment

## What helped

1. **cnc-motion-rules (canonical copy):** The eight laws, position-of-record doctrine (§3), and coordinate frame hygiene (§2) were essential. The reminder that `get_position.reliability` must be verified, that landmarks are obstacles, and that Z changes below the motion floor need separate operator authority prevented several planning errors.

2. **work-datums.md reference:** The section on "Reuse one WCS across indexed rotary operations" directly answered the core question: can one G54 serve all four B angles? Yes, if rotation is modeled correctly in the CAM post. The warning against creating multiple workspaces just for each B angle aligned with the brief's instruction to use one WCS.

3. **cnc-probing SKILL.md:** The table of measurement ops (point, profile, grid, wall, circle, trace) and the note about `sensor_delay_ms` for GPIO (50 ms) vs MQTT (200–300 ms) gave confidence that the existing B0/B180 profile measurements (job IDs 7685888d887d, f8f12d4a4b3e) were captured with the right procedure. The emphasis on "known surface" vs "unknown surface" guided the decision to re-measure the rim before the probe-to-cutter swap, rather than trusting the 27 Sept reading.

4. **Evidence table in the brief:** The probe job IDs, calibrated probe length (70.95 mm), probe tip radius (2.5 mm), and the stored rotary axis position (X170.1 physical Z112.4) were concrete anchors. The note that physical Z = contact Z − probe length immediately clarified that 201.3 toolhead minus 70.95 = 130.35 physical, not a machine Z to send.

5. **FreeCAD fixture model and macros:** The prior agent's `neck_cut_fixture_plan.FCStd` provided a 3D reference for the six indexed visits, stock geometry, and jaw proxy. The `fixture_tabs_section.jpg` and `fixture_round2_b180_path.jpg` images made the variant comparison concrete.

## What was missing or unclear

1. **Collet nose diameter and jaw X/Z extent not specified in the brief:** The brief says "The installed protrusion, collet nose diameter, runout and holder envelope have not been measured" but does not state typical values. A 75 mm endmill in a 20 mm collet typically has a nose diameter of 20–25 mm; a 28 mm nose at the Y256 cut depth (Y268 – 12 mm travel) would be only 1 mm short of the historical Y269 jaw front. This requires a fresh measurement (step 3 in Remaining Measurements), but the plan should have highlighted it earlier. **Missing:** A pre-cut jaw clearance check is essential and should be in the Release Gate before any cutting, not just in the remaining measurements list.

2. **Enclosure CAD Y registration not resolved in the evidence:** The brief supplies `reference_enclosure_20260922.FCStd` but notes that "its Y placement and full stock/fixture registration have not been proved." The plan chooses a B0 rim datum at machine Y250, but the CAD local Y frame (0–119 mm) is not mapped to machine Y. If the operator's intention is to finish the entire enclosure (both ends of the Y span), this registration gap matters. **Unclear:** Should the plan assume the supplied CAD Y0 is at one end of the stock, or is only the neck region (Y240–270 in machine frame) being cut?

3. **Raised transition at Y259–278 (step from Z206 to Z213) underspecified:** The brief mentions it but says "Its material and full X/Z extent were not identified" and "The probe survey ended … the jaw/holder envelope near Y269+ … remain to be validated." The plan treats it as a bracket/reinforcement and conservatively keeps it in the CAD, but the plan did not build a geometric check for B90/B270 side cuts. If the endmill approaches from Y251 at X139 (port bridge), and the raised feature extends to X200 at Y278, there is potential interference. **Missing:** An explicit probe sequence to map the raised feature's X extent at Y270 and Y278 before committing to the B90/B270 side-cut depths.

4. **Stock grain direction assumption:** The plan recommends Variant 2 (two C-shaped bridges) partly because "wood grain typically runs along the Y axis." This is an inference, not a measured or operator-stated fact. If the enclosure is laminate, plywood, or oriented the other way, four corner tabs might be stronger. **Unclear:** The brief does not state the material or grain orientation. The plan should ask the operator or inspect the stock visually before finalizing the bridge design.

5. **Probe body clearance at the groove walls not explicitly verified:** The brief notes the probe has "only about 21 mm of stylus exposed" and "a 2.5 mm ball." The plan measures at X195 (the centre of the stock width), but does not check whether the probe collet body clears the ~64 mm stock width at the groove opening (Y254). A contact at the rim (X195 Y250 Z201.3) is one point; the question "can the probe access all four indexed positions (B0, B180, B90, B270) at the rim or at alternate stable datums?" is not fully answered. **Missing:** A second datum option (e.g., an outside corner or the groove wall itself) in case the B90/B270 approach columns have probe-body interference.

6. **Saw-cut final step operator instructions missing:** The plan says "two cuts along Y251–261 mm, one each at X139 mm and X203 mm" but does not specify whether the operator uses a band saw, circular saw, or hand saw; how they align the cut; or what happens if the blade binds (risk of the piece spinning in the chuck, injury). **Missing:** This is outside the MCP domain, but the plan should note that the operator needs a saw-cut jig or explicit fixture before attempting the final separation.

## What required guessing or inference

1. **Rotary axis geometric transform:** The plan assumes the stored rotary axis X170.1 is correct and uses it to predict that the B0 rim at X195 maps to a different X at B90. The full rotation matrix (a 2D rotation about the stored axis Z, with a possible tilt) is not computed, only the rough direction checked against the side-probe shifts (9 mm west at B90). A verified B90 approach entry point still needs a fresh probe descent or a CAM simulation check.

2. **Chuck-jaw motion profile:** The plan assumes the jaws stay within Y269 and do not move in Z or X as the stock rotates. In reality, a four-jaw or collet chuck may have radial or axial clearance. The brief's note that jaw motion "still need(s) verification before a machine-frame CAM Job can be generated" suggests this is a live variable, not a constant. The plan sets a `keep_out` box and a post-index jaw-clearance check, but does not budget time for jaw adjustment if a collision is found.

3. **Bridge width sensitivity:** The plan claims 5–6 mm bridges are strong enough to support the load during intermediate cuts and a saw cut, but provides no finite-element or wood-engineering reference. This is a reasonable estimate (a 64 mm wide enclosure with a 6 mm side bridge leaves ~52 mm of unsupported span), but the operator should be aware that if the bridges crack during the side cuts, the piece will fall or spin unpredictably.

4. **Stepdown sizes (2 mm per pass in round 1, 1–1.5 mm in round 2):** These are typical for a 6 mm endmill in wood with a 5000–8000 RPM spindle, but the brief does not specify the spindle power, feed drive (servo or stepper), or the wood species/moisture content. Dry pine allows aggressive feeds; wet oak or laminate requires gentler passes. The plan notes "Adjust for wood and tool flute count" but does not provide a look-up table.

## Ambiguities in the brief itself

1. **"Four small corner tabs vs two C-shaped connections that retain more wood in their corners" — geometry not dimensioned:** The brief asks for a comparison but does not define the target ligament width, cutter geometry, or the final saw-cut profile. The plan assumes 2 mm corners for tabs and 5–6 mm for bridges, but a different interpretation (tabs 5 mm per side, bridges 10 mm) would change the calculation. **Clarification needed:** What is the target "little sawing" and "stable machining"?

2. **"Do not merge all B0 or B180 work into one setup merely because their angles match" — intent unclear:** Does this mean avoid a single B0 setup containing all remaining B0 cuts (top channel + finishing passes)? Or avoid using the same G-code file for both round 1 and round 2? The plan interprets it as "each round gets its own indexed visit," which requires a fresh datum re-check and a new CAM file per setup. This triples the operator overhead compared to a single "B0 round 1 + round 2 merged" file. **Clarification needed:** Is the separation motivated by measurement drift, tool length change, or stock geometry change?

3. **"Existing grooves" as a machining feature — prior measurements not live:** The brief says "Do not use yesterday's camera pose or G54 as current" and "Do not assume the 27 September G54 was set to the proposed zero," yet the entire plan hangs on the 27 Sept probed groove profile and the proposed B0 rim datum. Are these "validated for reuse" or "assumptions to be verified in real time"? The plan treats them as assumptions (re-measures the rim) but retains the 27 Sept groove floor Z192.2 as the target cut depth. **Ambiguity:** How fresh does every re-measured reference need to be?

## Summary

The skills and motion-rules documentation provided a strong foundation for coordinate frame safety, sensor usage, and WCS doctrine. The prior agent's FreeCAD model and probe data gave concrete geometry to work from. However, the plan had to make assumptions on:

- Jaw/collet clearance (requires measurement before cutting).
- Wood grain and failure mode (requires operator inspection).
- Rotary axis transform correctness (requires a B90/B270 datum check).
- Bridge width strength (reasonable estimate, but no test data).
- Stepdown rates (typical for wood, but tool/material-dependent).

The evaluation succeeds in laying out a methodical two-round, four-index plan with explicit release gates and live-state checks. It emphasizes the two-C variant for practical sawing and stiffness, with a clear rationale. The main risk is **clock creep** if the operator must measure the jaw/collet multiple times or if the stock moves or rotates in the chuck during the index transitions. A tighter brief on collet geometry, wood species, and expected cut time would sharpen the plan.
