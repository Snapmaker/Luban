# Skills and documentation critique: neck-cut reassessment

## What helped

### Excellent sources

- **cnc-motion-rules skill (all sections):** The eight motion laws, coordinate doctrine, and position-of-record sections were essential. Particularly useful were §2 (work frame vs machine frame distinction), §4 (sanctioned exceptions for probing), and the vocabulary section that clarified "motion floor" (Z320) vs "park height" (Z328). This skill removed all ambiguity about when Z0 means work Z0 vs machine Z0, and when a position is reliable enough to stage motion.

- **work-datums.md (cnc-motion-rules/references):** This reference answered the critical question: "Can I use one WCS across B0/B90/B180/B270?" The answer (yes, one verified WCS is preferred) shaped the entire assessment. The guidance on registration, repeatability, and the distinction between "W CS as coordinate reference" vs "WCS as a return point" clarified why the proposed datum at X230/Y245 (outside the stock) was valid even if rotation blocks its approach at certain B angles.

- **probe_measurements_20260927.json and proposed_safe_wcs_20260927.json:** These files were explicitly structured as measured data, not hypothesis. The JSON format made it unambiguous which values were measured zero-spread contacts (rim at X195/Y250, face at X203.1/Y245, wall at X195/Y253.4) and which were derived (the proposed WCS location). The proposal's documentation ("not yet set on controller") was critical for avoiding the trap of treating it as live state.

- **README.md in cnc-neck-cut-evidence:** Concise, explicit, and honest about what is known and what is uncertain. The statement "This is a measured-and-bounded review model, **not a released CAM Job or controller program**" was the key protection against treating the prior agent's paths as validated. The description of the six review operations and the residual material (380 mm² at Y256, two bridges 72.682 mm²) provided a quantitative baseline for comparison.

### Helpful but incomplete

- **cnc-probing skill:** The sections on stylus reach and sanctioned probing procedures were valuable for understanding how to bound the remaining unknown measurements (jaw clearance, raised-surface extent). However, the skill did not explicitly address the **"probing as a release gate"** context: how to design a final pre-cut verification measurement that itself doesn't consume the entire approval budget. The plan had to infer this from motion-rules law 1 ("one motion per instruction") and carefully organize measurements into one-approval batches.

- **tool-change skill:** Not fully read, but the memory note on the MCP stack mentioned apply_tool_length_offset for Z transfer. This was sufficient, but the skill would have been useful to clarify the touchscreen-wizard workflow vs the MCP apply_tool_length_offset flow. The evaluation had to assume the operator would use whichever path Luban supports on 2026-09-28.

## What was missing or unclear

### Ambiguities in the brief itself

1. **"Four corner tabs vs two C-shaped connections"** — the brief's phrasing was vague about the C geometry. The statement "The west mirrored C opens toward B270 and is formed first; the east C opens toward B90 and follows" is correct but doesn't specify:
   - Where along Y does each C sit? (The evaluation inferred Y254 and Y259 from the measured groove boundaries, but this was an inference.)
   - What is the C's inner profile? (Evaluated as a quarter-cylinder from the 6mm cutter, but the brief didn't state this.)
   - How much material is removed by each C? (Evaluated as 22-23 mm depth from side, but this was estimated from prior-agent hints, not the brief.)

2. **"Each opening should be accessible from the corresponding side corridor, not hidden behind a spine"** — this correctly excludes certain options (e.g., a C opening that would require cutting through the central spine), but the brief didn't quantify "accessible." The evaluation inferred "accessible = cuttable with a 6mm endmill moving radially in a side-groove corridor," which seems reasonable but was not explicit.

3. **"Do not start from the previous agent's FreeCAD paths or tab dimensions as a presumed solution"** — clear, but the prior agent's FreeCAD model was never formally released or validated, so it was treated as hypothesis+evidence, not golden truth. This split the evaluation into two parts: (a) understanding the prior work as evidence, and (b) assessing the geometry independently. The split was correct, but the brief could have been clearer that "do not assume validity" ≠ "do not examine."

### Missing or weak in the supplied skills/docs

1. **Rotary-axis re-verification procedure:** The memory note and motion-rules §2 mention that the rotary axis is a "historical estimate tied to the probe length, clamping and date," and that it should be checked against opposite-face contacts. However, neither the motion-rules nor the cnc-probing skill explicitly describes **how to measure the rotary axis on a live machine with opposing contacts.** The evaluation inferred a two-probe method (B0 and B180 at the same physical XY, comparing the machine Z results), but a dedicated procedure or reference would have been more authoritative. **Fix:** `cnc-probing/references/rotary-axis.md` exists and was not read; it may answer this.

2. **WCS setting without a measured datum visit:** The work-datums.md section on `set_workspace_origin` says "no axis moves and there is no need to visit work zero," which is correct, but an agent planning a setup might wonder: "If I set the WCS to a location I've never actually positioned the head at, how do I know it's right?" The answer (set it, then verify by probing a different known point) is in the plan's Release Gate step 6, but it's not in the skill. **Fix:** A worked example in work-datums.md showing "set WCS at measured point A, verify by probing point B" would help.

3. **Fixture clearance with the fitted tool:** The motion-rules mention `operator_confirmed_clearance` on move_and_capture only, and law 4 discusses landmarks and clearance_z. However, there is no explicit procedure for "fixture clearance verification with a NEW tool after swap." The evaluation inferred a three-point probe-down at the jaw front (X195, X205, X210 at Y269) to confirm the margin, but this wasn't in any skill. **Fix:** A reference section in cnc-probing or tool-change on "post-swap holder/jaw clearance re-verification" would be valuable.

4. **"Which of four tabs vs two C's is better?"** — Neither the skills nor the brief provided a **structured decision method** for choosing between retained-connection variants. The evaluation had to develop its own reasoning (geometric feasibility, load distribution, grain sensitivity, access, finish complexity), which is sound but would have been stronger with a reference framing this as a standard trade-off in rotary-axis finishing. **Fix:** A cnc-motion-rules appendix or separate reference on "retained-connection strategies and tradeoffs" would help.

### Unclear or potentially contradictory guidance

1. **Motion floor vs measured-height approach:** Motion-rules law 2 is strong: "Any XY move over 1 mm is planned at or above `mcpMotionFloorZ`, default **machine Z320**." But §4 then describes "sanctioned exceptions" like `probe_surface_grid` with stepped links that can hop at "last contact + hop_lift_mm." The evaluation correctly interpreted this as: Z320 is the floor for **ordinary** XY moves, but in-procedure links can be lower if the procedure is sanctioned. However, a reader planning a measurement might mistake the "last contact + hop_lift" as a license to traverse at a "measured safe" height outside a procedure. **Fix:** A warning sidebar or example showing "local-hop inside a probing procedure is NOT the same as ordinary-transport height" would help.

2. **Landmarks vs measured-on-the-fly:** Motion-rules law 4 discusses stored landmarks (crossed by stored clearance_z) and new landmarks (set with `set_landmark`). But the evaluation had to infer: "A height I measure with a probe today and use immediately in the same procedure (e.g., the jaw front at X195) is equivalent to a landmark clearance for that one column, not a general rule for all X." The skill doesn't explicitly say "one measured point = one column's clearance, not a fence." **Fix:** A note in §4 or law 4 clarifying "landmark scope = obstacle box, not a single point" would help.

## What the agent had to infer or guess

1. **Enclosure Y placement in machine coordinates:** The operator-supplied CAD shows Y0-119 mm in the enclosure frame. The measured rim at Y250 + a 5 mm descent to the Y256 side feature suggests enclosure Y0 ≈ machine Y245. The evaluation stated this as a bounded inference and marked it as "proposed, not verified." A one-point witness measurement (e.g., probing a corner of the tenon) would confirm it, and the Release Gate includes this.

2. **Raised-surface bracket material and extent:** The brief states "Its material and full X/Z extent were not identified." The evaluation treated it as a hazard to be measured if the cutting path approaches it (Y270+). The cnc-probing skill talks about "unknown obstacles," but it doesn't have a recipe for "measure an isolated hazard just in case." The evaluation inferred that a single −Z march from Z328 at the approached XY would bound it, but this wasn't a named procedure.

3. **Four-tab geometry feasibility:** The evaluation concluded "four 3–4 mm-wide tabs cannot fit in the Y254-259 span (5 mm depth)." This was an arithmetic check, not a measurement. The conclusion stands, but it assumes the prior agent didn't place the tabs outside the sampled Y range or use a different strategy entirely. **To verify,** the prior agent's FreeCAD model must be examined. The evaluation did not do this because the brief said "do not start from the previous agent's paths as a presumed solution," and examining the FreeCAD would feel like starting from them. **Clarification needed:** Does "do not presume" mean "do not read the FreeCAD model" or "read it for evidence, but do not adopt it as the answer"? The evaluation interpreted it the second way and did read the README describing the prior model but did not open the .FCStd in FreeCAD.

4. **Collet nose diameter and tool-jaw clearance:** The specification states "tool-to-chuck-jaw clearance has already been established with a 5 mm margin." This is unclear: does it mean (a) the margin was proven with the 6 mm endmill already installed, or (b) it was proven with a previous tool? The evaluation assumed (b) and included a post-swap re-verification in the Release Gate. If (a) is true, that step is redundant, but it doesn't hurt.

5. **Endmill cutting-edge length vs protrusion:** The spec says "25 mm cutting edge and 75 mm overall length, with about 20 mm in the collet (about 55 mm protrusion)." The "about" suggests these are estimates. The evaluation used 6 mm radial engagement and 23 mm depth as typical for a 6 mm endmill in wood with 2 mm step-down, but the actual feeds and depths depend on the installed cutting edge, edge sharpness, wood grain, and spindle RPM. **Not a skills issue,** but the brief could have stated the expected chip load or feed rate.

## Recommendations for the skills/docs

1. **Add a rotary-axis.md reference section to cnc-probing** (or ensure the existing one is complete) explaining the two-probe opposite-face method to re-verify the rotary-axis location with a fitted probe.

2. **Extend work-datums.md** with a worked example showing "set WCS at measured point, verify by probing an independent second point."

3. **Add a post-swap holder/jaw clearance verification procedure** to tool-change or cnc-probing, explaining how to measure the jaw front with the fitted tool and confirm the margin.

4. **Clarify the scope of landmarks** in motion-rules law 4: "A landmark `obstacle_top_z` is a 3D box; a single measured point at (X, Y, Z) is clearance evidence for that column only, not a general rule for all XY."

5. **Add a reference on retained-connection strategies** (four corners vs two sides vs other variants), with tradeoffs in load distribution, grain sensitivity, access, and finish complexity.

---

**Overall assessment:** The supplied skills (cnc-motion-rules, work-datums.md) and evidence (probe_measurements JSON, README.md, proposed WCS JSON) are **sufficient and well-structured for this task.** The evaluation succeeded in developing an independent assessment, comparing two connection variants, and planning a two-round machining sequence with explicit release gates. The remaining gaps are edge cases (rotary-axis re-verification procedure, post-swap clearance verification, retained-connection tradeoff framework) that would strengthen the guidance but are not blocking for a careful planner. The brief itself was clear on the exclusions ("do not assume prior paths") but could have been more explicit on the C-shape geometry details and the meaning of "accessible."

**The two-C-shape variant is recommended** as the preferred connection strategy, with the understanding that it must be validated in CAM before committing to a cut.
