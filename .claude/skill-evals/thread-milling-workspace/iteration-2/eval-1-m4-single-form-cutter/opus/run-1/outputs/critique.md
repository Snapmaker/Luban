# Critique: M4 single-form thread-mill dry run

## What helped
- `cnc-thread-milling/references/setup.md`, "Keep the dimensions separate":
  - Decodes `M4x0.7xD4x50L` directly (D4 = shank, 50L = overall length).
  - States "A 7.5 mm reach cannot provide an 8 mm thread", which settled the main blocker immediately.
  - Gives the single-form turn count (8/0.7 ≈ 11.43, with rounding) and separates flutes from rows.
- `setup.md`, "Generator input checklist": gave the field-by-field Machining Doctor list, including "Tooth Configuration", D=0, units, precision and the XYZ datum in the existing work frame.
- `setup.md`, "The supplied M2.5 fixture is regression evidence": gave the 2r + OD = major identity check and the first-XY-before-Z trap, both of which transfer to the M4 review.
- `cnc-thread-milling/SKILL.md`, "Import and review" step 1 ("do not assert a declaration merely to obtain a preview") and `import.md`'s declaration table made the Readiness answer unambiguous.
- `tool-change/SKILL.md`:
  - The flow A and flow B split.
  - The `accept_probe_contact` requirement.
  - "never calculate old_trigger_z as setter surface + stored probe length".
  - The reuse rule, which requires reading `measurements.last`.
- The multiple-holes section of `setup.md` gave the approval-counting convention.

## Missing / unclear / contradictory for this task
- **Tip-to-tooth vs programmed Z** (`setup.md`, "Keep the dimensions separate"; `thread-milling.md`, "Setup and path review"): both mention tooth-to-tip distance. Neither says whether Machining Doctor's Z (thread length and deepest point) refers to the tool tip or to the single tooth. That decides whether the hole depth needs the tip-to-tooth distance added, and whether "8 mm thread" is achievable with a given reach. I had to treat it as unknown and ask for the tip-to-tooth distance.
- **Machining Doctor RPM for the standard head** (`import.md`, spindle table; `thread-milling.md`): `power_percent` "does not infer a motor calibration or rescale feeds". Nothing says how the operator should pick the generator's max RPM or feeds for the standard head, whose percent-to-RPM relation is undocumented. I asked the operator for the RPM at their chosen %.
- **Field for maximum RPM**: `thread-milling.md` mentions "maximum RPM" only in a coverage table. The setup checklist says "actual head's RPM capability" without naming the field. Setting max RPM to 18000 on the 200 W head is my inference.
- **Flow B then file job** (`tool-change/SKILL.md`, flow B): after the wizard the tip is held at the setter trigger. Neither skill says a `move_z` to 328 (with its own operator word and approval) is needed before a thread file whose first move is an XY `G00` at the current Z. `cnc-thread-milling/SKILL.md` warns about the initial XY in general. I inferred the extra approval for branch B.
- **Does `submit_gcode_job` itself check a file job's first XY segment against landmarks or the motion floor?** It's not stated in `TOOLS.md` or the skills. I planned a manual check against `requiredToolheadZ` using `get_stored_state` before staging.
- **Re-establishing Z0 with the probe** (branch R): `work-datums.md` covers `set_workspace_origin` well. There is no worked example of "probe the top beside a small hole, then set G54 Z", and `probe_program` has no circle op kind, so a hole-centre measurement becomes a separate `probe_circle` approval. That is my reading of the op list in `TOOLS.md`.
- **Hole-probing threshold**: "check stored probe-tip diameter against the bore and required probing travel" (`setup.md`, final paragraph) gives no minimum radial clearance for a 3.3 mm bore. I left it as a check rather than a number.
- **Probe `bit_length_mm`**: the tool-change skill says to ask both tools' protrusion. `cnc-motion-rules` §8 shows 70 for the probe. I used 70 (below the stored 71.3, so it is declared low), with no explicit guidance that this is acceptable without asking.

## What I had to guess
- That the operator's export will follow the M2.5 fixture's structure (G00 X Y, then G43 H1 Z safety, Fanuc).
- That the Fanuc dialect is wanted (the converter default and the operator's previous job).
- Precision 4–5 as "sufficient". The skills say only "sufficient precision".
- That the block top at the hole is the natural generator Z datum.
