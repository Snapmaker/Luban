# Critique (M2.5 supplied-program dry run)

## What helped

- **cnc-thread-milling/references/setup.md, "The supplied M2.5 fixture is regression evidence".** It named every trap with numbers:
  - the neck is not the cutting OD (0.575 x 2 + 1.38)
  - the 2.25 mm step against about 1.35 mm coverage
  - the Z-5.056 / Z+0.006 / Z20 extents
  - the XY move before the first Z move

  That section alone stopped the plan from converting the file.
- **setup.md, "Keep the dimensions separate", and the flutes-versus-rows wording.** It made clear that "triple flute" and "triple row" answer different questions.
- **SKILL.md "Import and review" step 1 and import.md's declarations table.** They made it clear that neither declaration may be asserted just to get a preview.
- **The tool-change flow A sequence.** It covers `accept_probe_contact` and the ban on computing surface + 71.3. The approval-counting paragraph in setup.md gave a clean way to count.
- **setup.md on the head identity rule.** Neither `connectedHead.toolHead`, nor `toolHeads`, nor the README hardware note chooses the head.

## Missing or unclear for this task

- **Establishing the XY datum on a small drilled hole isn't covered.** setup.md says not to insert an oversized stylus, and work-datums.md says a derived centre needs measured registration. But nothing covers the common case: a pre-drilled hole of unknown origin, a probe too big to enter it, and no retained reference. I had to guess the fallback: the operator's drilling datum, or camera alignment planned separately.
- **Contradiction on the confirm page's extents.** cnc-thread-milling SKILL.md "Stage only when…" and motion-rules §7 step 4 say to read the "machine-resolved Z extents". workspaces.md "File review" and work-datums.md say a single explicit G54 leaves extents unresolved, and the converter always emits G54. So it's unclear whether converted thread files ever show resolved extents. I planned for both outcomes.
- **Z datum method before a swap.** Nothing says whether setting the probe-tip Z0 with `set_workspace_origin` (Z = contact toolhead Z) and then transferring through flow A is the intended pattern. The alternative is that the old tool's Z reference has to have come from the touchscreen. I inferred the pattern from work-datums.md "Set a measured origin".
- **Whether the setter pair is valid after `set_workspace_origin`.** Does the probe setter measurement have to come after the origin write? Order doesn't matter physically, but the documents don't say.
- **What "prepare / ready to run" authorises.** SKILL.md says "stage only when the operator requests execution", but "ready to run" is ambiguous. It's unclear whether it covers staging datum probing and tool changes. I added an explicit authority question rather than guessing.
- **Drill-point depth.** The setup notes it but gives no rule for tip-to-lowest-crest distance, or for how Machining Doctor references Z (tip or lowest crest). I had to treat both as questions.
- **The route from the setter to the first `G00 X0 Y0`.** It's unclear whether `submit_gcode_job`'s confirm page checks landmarks for a file job's initial XY move. The documents say the move "must already satisfy" the checks but not who enforces it. I added a conditional `traverse_xy`.
- **Recheck tolerance.** work-datums.md asks for "a predicted coordinate/tolerance" with no default. The ±0.05 mm is my guess.

## What I guessed

- Taking D4 as the shank and 50L as overall length for this vendor: the documents confirm this only for the M4 example.
- The 118° drill point, used as an illustrative depth-margin check.
- The probe station `max_travel_mm: 150`, copied from the canonical example.
- The need for the Z0 recheck approval. It could arguably be folded away, which would change the count.
