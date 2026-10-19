# Critique: What the skills taught and what had to be inferred

## What helped significantly

**cnc-motion-rules SKILL.md:**
- Law 7 (Ask once) was the backbone of batching all ten questions into one message before any staging
- §2 Coordinate doctrine clarified the work-frame job handshake and the requirement to pass the export through unchanged
- §4 Sanctioned exceptions explained that tool-centre bounds are NOT collision clearance — we must reason about neck/shank/holder separately
- §3 Position of record and reliability guidance established the preflight checklist before any motion
- Law 1 (one motion per instruction) and Law 6 (chat is not a motion gate) anchored the understanding that planning ≠ staging ≠ execution

**cnc-thread-milling SKILL.md:**
- The explicit "Choose the feature review" table showing Internal vs External side-by-side was immediate and clear
- The statement "Do not reuse an internal clearance plan for an external job" was a direct signal to reject any bore-based reasoning
- "Converter bounds are tool-centre bounds, not swept cutter/holder bounds" was critical for understanding that validation alone does not prove collision safety
- The emphasis on "preserve the complete source export separately" and "keep the returned gcode, changes, warnings, validation together" structured the offline workflow

**setup.md reference:**
- The "Keep the dimensions separate" table (Cutting/thread-form OD, Neck, Shank, Usable reach, Effective cutting length, Flutes) was exact and immediately resolved the "D4x50L triple flute" ambiguity
- "Three rows × pitch is an initial consistency check, not a substitute for the tool specification" — this directly contradicted any assumption that flute count = axial form count
- The warning about the supplied M2.5 fixture's neck/cutting-OD mismatch (1.38 mm neck but unknown cutting OD) was an immediate template for this task

**import.md reference:**
- The spindle_mode decision tree (cnc_200w_rpm with RPM limits, or power_percent with explicit percentage) and the statement that conversion "does not infer a motor calibration or rescale feeds" was crucial
- The controller selection clarity (Fanuc, Okuma, etc., are observed dialects, not emulators) and the transformations table gave confidence in the source_controller argument

**tool-change SKILL.md:**
- The two-flow diagram (A: MCP-managed offset, B: Touchscreen manual wizard) and Law 7-style instruction to "ask which one the operator is using" provided a template for the tool-swap step if needed

## What was unclear or missing

**From cnc-thread-milling SKILL.md:**
- The "external boss" review in the feature-review table is minimal — it says "Check space around the whole boss for the cutter, neck, shank and holder, including nearby clamps and the shoulder at the deepest pass," but does not explain what "space around the whole boss" means geometrically for a helix that orbits at different radii and Z positions
- No worked example of an external thread's entry/exit/deepest point the way the M2.5 fixture walkthrough shows internal bore entry/wall engagement/withdrawal
- The statement "Review approach outside the boss, lead-in to its surface, every helical pass, lead-out into free exterior space and the axial withdrawal" is procedurally sound but does not detail how to CHECK these visually or with position data after conversion

**From setup.md:**
- The description of "Usable reach" for external threads is not explicit — only "A 7.5 mm reach cannot provide an 8 mm thread" and later "thread length 8 mm needs a reach of more than 8 mm," but the geometry rule (reach > thread length + radial/shoulder offset) was inferred, not stated
- No diagram or ASCII art showing an external boss, shoulder, and helical tool orbit — the bore example implies a 2D cross-section understanding, but external is a 3D orbit that can collide with the shoulder or clamp from any angle

**From thread-milling.md:**
- The "Setup and path review" table compares internal and external but does not define what "surrounding space for full exterior orbit" quantitatively means (e.g., is it the boss radius + tool radius + neck radius + some margin?)
- No mention of how shoulder undercuts (if present) affect the clearance calculation — the operator might interpret "shoulder immediately below" as either a sharp corner or an undercut, and each changes the clearance envelope

**From TOOLS.md (not read in detail due to constraints, but referenced):**
- The exact schema of the `convert_thread_milling_gcode` return object is not fully detailed in the skills — `gcode`, `changes`, `warnings`, `sourceSpindleRpm`, `validation`, and arc/segment counts are mentioned, but whether these are nested objects, arrays, or flat fields is inferred from usage examples in thread-milling.md

## What had to be guessed or reasoned without direct evidence

1. **Exterior orbit collision check:** I interpreted "space around the whole boss for cutter, neck, shank and holder" to mean the tool must not collide with the shoulder, the clamp, or any fixture during any angular position of the helix. This is the logical external analog of "insertion and withdrawal" for a bore, but the skills do not explicitly define an "external orbit clearance volume" the way law 4 (cnc-motion-rules) defines the landmark box.

2. **Reach sufficiency:** The rule "reach > thread length" is stated for internal (bore examples) but not rigorously stated for external. I inferred that for an external boss at diameter D with a tool cutting at radius R, the reach must accommodate the deepest axial position (thread length + any approach/exit overrun) and the radial geometry (boss radius + tool radius + gap). This is geometrically sound but not explicitly sourced in the skills.

3. **Shoulder undercut definition:** The prompt says "shoulder immediately below it" — I interpreted this as the operator's description, not a precise term, so I asked for clarification (sharp corner vs undercut + dimensions). The skills do not define a standard shoulder geometry.

4. **Clamp interference during helical orbit:** The prompt mentions "a clamp nearby" — I reasoned that the clamp could interfere during any angular position of the helical cut, not just the final position, because the tool orbits 360° at multiple Z and radial positions. This required thinking through 3D collision geometry, which the skills do not detail for external threads.

5. **Conversion result inspection for external threads:** The skills explain validation for internal bore entry/exit but do not provide a parallel checklist for external entry (approaching the boss surface), every pass radius, lead-out (leaving the boss into free space), and withdrawal. I adapted the internal checklist to external by logical analogy (probe entry → tool approach; bore-wall engagement → boss-surface engagement; withdrawal from bore → withdrawal from exterior orbit).

6. **Spindle mode selection without live head identity:** The skills note that `get_machine_profile.connectedHead.toolHead` can be null or ambiguous, but do not provide a fallback procedure if it is. I stated "determine fitted head type" as a preflight step, but acknowledged that the operator must be asked if the returned value is inconclusive.

## Summary

The skills provided robust procedural guidance (when to ask, what not to infer, how to preserve source data, the conversion workflow) and correct external-vs-internal conceptual framing. The planning completed successfully by applying those principles. What was missing was a worked external-thread example (setup → conversion review → validation → execution) parallel to the internal M2.5 fixture, and more explicit geometry rules for "space around the boss" and "reach sufficiency." These gaps required applying the internal reasoning to external geometry by analogy, which is sound but would benefit from explicit external documentation in the skills or a second fixture example.
