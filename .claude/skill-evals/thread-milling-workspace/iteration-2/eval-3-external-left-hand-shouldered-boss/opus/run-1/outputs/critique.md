# Critique — external M8x1 LH conventional, shouldered boss, D4x50L cutter

## Helped
- `cnc-thread-milling/SKILL.md` "Choose the feature review" had an external column (boss centre/diameter/height, shoulder/undercut, clamps, holder around the whole boss). It also says not to reuse an internal plan. Together these set the structure of the plan.
- `references/setup.md` "Keep the dimensions separate" decodes `D4x50L` directly: D4 = shank, 50L = overall. It also separates flutes from axial rows. That is exactly the trap in this prompt.
- The "Establish the job" list and "no importer flags for handedness/direction" made it clear that LH + conventional belong in the generator and are reviewed from signed Z, never mirrored.
- `import.md` and `docs/thread-milling.md` gave the meaning of the two declarations. Together with tool-change "The sequence (flow A)" they make it clear that neither declaration can be made while the probe is fitted and the Z0 history is unknown. The 71.3 calibration versus live setter pair distinction is stated in three places, consistently.
- The motion-rules checklist (§0 "Ask once", §1 law 6) and the approval-counting paragraph in setup.md "Multiple holes or bosses" gave the count method.

## Missing or unclear for this task
- **Shoulder-specific geometry is named but not worked.** The skill says "shoulder/undercut clearance" and "deepest actual tool position versus shoulder". It never mentions:
  - the tooth-to-tip distance below the lowest form
  - the plunge column: an external path descends outside the boss at the radial safety distance, and that column lands on a shoulder wider than it
  - that a thread cannot run to a shoulder without an undercut

  I derived these myself (SKILL.md "Choose the feature review", docs/thread-milling.md setup table). A short external worked example, parallel to the M2.5 internal one, would close this gap.
- **Which end of the path is at the shoulder** for LH + conventional external (bottom-up vs top-down) is not stated anywhere. The docs rightly say to read the signed Z. Still, a one-line table of the eight combinations (side × hand × climb/conv → Z direction) would let a planner predict whether lead-in or lead-out sits at the shoulder before the export exists. The option-coverage table says all eight are tested but does not give the directions.
- **Measuring a boss centre as the datum.** `probe_circle` is not a `probe_program` op kind (TOOLS.md op list; cnc-probing "Whole-stock programs"). A find-top then outside-circle needs either two approvals (find, then `probe_circle` with a measured top) or a hand-built `sequence` of side marches with `mid` references. Neither skill says which is preferred for an external boss with a shoulder limiting side-march depth. I chose the one-approval `sequence` form and guessed that `descend.z` accepts a reference. motion-rules §8 says references work "in any numeric argument", but there is no example for `descend`.
- **Clamp and holder envelope.** The docs say to check "cutter, neck, shank and holder" but give no collet-nut dimension and no way to check the swept envelope. The only mechanism is operator statement plus `set_landmark`. That is fine, but it could say explicitly that the operator must supply the collet-nut OD.
- **Conversion timing against tool change.** The docs forbid asserting `tool_length_applied` "merely to obtain a preview" (SKILL.md "Import and review" step 1). So conversion happens only after the swap, and a bad export is found after up to four approvals have been spent. The skill does not say whether an offline review of the raw source (my step 9) is the intended mitigation. I assumed it is.
- **"Do not move anything" plus a request to "plan".** The skill does not say whether a plan should enumerate future conditional approvals, or stop at the questions. I included the future branches after `-- end turn --` markers and counted them separately.

## Guesses
- That the operator's work origin, if valid, sits at or can be expressed as the boss centre/top. That is why the generator's XYZ datum is used rather than re-zeroing.
- The condition "Is D4 the shank" for a vendor name without a pitch prefix (setup.md says "confirm vendor notation for other tools"), so I asked.
- The number of incomplete threads at the shoulder ("~1–2"). This is illustrative and depends on the tooth-to-tip distance, which is unknown.
- Precision "≥ 3" as a generator suggestion. The docs only say "sufficient precision" and describe refusals for inconsistent arcs.
