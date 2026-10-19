# Critique: skills, docs and brief for the rotary neck-cut reassessment

## What helped

- **`cnc-motion-rules` §0 and §2.** The checklist and the rules on frame qualifiers set the shape of the ledger (toolhead Z vs physical Z vs work). The line "prefer one verified WCS across indexed B" plus the §4 `set_workspace_origin` entry (Z = toolhead Z for the fitted tool, no visit to zero) decided the WCS design directly.
- **`references/work-datums.md`.** It says a derived origin is valid, and that a retained reference does not imply retained access. That justified the axis-centred G54 and the "never `goto_work_origin`" stance. It also required the independent check to use points not used to build the datum; P3 is built that way.
- **`cnc-probing`.** The find-then-scan and known-surface rules, the probe-spot `capture`, the stepped `max_drop` behaviour and the event-budget arithmetic shaped P1. The keep-out volume vs crossing landmark distinction and "measuring inside an unmeasured region is allowed" shaped P2.
- **`tool-change` flow A.** Never compute `old_trigger_z`; the probe goes on the setter with `accept_probe_contact`. The MCP README note that the setter switch fires before the probe's own switch exposed a pretravel bias, which led to the feeler check in the release gate.
- **TOOLS.md and workspaces.md.** Clear contracts for `set_workspace_origin` / `select_workspace`, the "if G54 is the active workspace" confirm-page condition, and `start_gcode_job`'s G54 verification.

## Missing, unclear or contradictory for this task

1. **B words in cutting file jobs are undocumented.**
   - TOOLS.md `submit_gcode_job` / `validate_gcode` say nothing about `B`.
   - README "3+2 stations" covers only `run_probing_gcode`, where a bare `G0 B` raises and runs `rotate_b`.
   - `rotate_b` exists only inside `probe_program`.
   - I had to assume an in-file `G0 B<θ>` at the clearance Z is passed through and reported. The plan names checking this as a gate item. Needed: one line in TOOLS.md, and a motion-rules entry for "indexing inside a cutting file".
2. **Law 2 inside a cutting file.** §1 law 2 says "ALL" XY moves over 1 mm happen at the floor, then carves out in-procedure envelopes. It does not say how CAM feed links inside a kerf are treated in a file job. I assumed rapids at machine Z ≥ 320 and feed moves in the slot, but the rule could be read as forbidding any file.
3. **Holder envelope has no MCP home.** Landmark `requiredToolheadZ` uses tool length only. Nothing on the tool surface stores the collet nut, spindle nose or body diameters. Yet this task's hardest clearance (spindle body over rotating jaws) depends on them. The no-UI-knobs doctrine suggests a tool-constant setter is missing. I used operator calipers plus P2 go/no-go marches.
4. **No independent G-code simulation tool.** `SIMULATOR_SPEC.md` is "not started". The release gate's "independent check from approach to retraction" had to be specified as a custom parse-and-sweep script. The skills do not say what counts as independent.
5. **Stale rotary numbers in three places.**
   - The cnc-probing jig table says axis ≈ 170 / 112.
   - The README says 169.7 / 112.4 (probe 71.3).
   - The brief says 170.1 / 112.4.
   - The 26-27 Sep contacts imply 169.33 / 113.78, and the stored axis misses the B180 top by 2.75 mm.
   Nothing in the skills says to test the stored axis against the opposite-face contacts before using it. That was the largest error source I found: it would have given tab sizes of 1.85 mm and a 0.85 mm C spine.
6. **Probe-program details I had to guess.**
   - Can a `sequence` step reference an earlier probe in the same op? I split ops to be safe.
   - Is a contact during a `descend` a held abort or a crash alarm?
   - Does `group` accept a per-program `swept_radius_mm`?
   - Does the "3 events/mm" blind-find cost apply to plain `probe dz` marches?
7. **Pretravel.** `tool-change` says "do not invent a correction". The README says the setter fires first. Neither gives a measurement method for the probe's pretravel on stock, which biases every probe-derived Z0 transferred by the setter.
8. **Mid-plane trap.** The skills do not warn that flat-end sweeps retreat r at kerf edges, so separating features needs depth beyond the mid-plane edge. The brief's fail condition hints at it. My B-rep check showed the naive 4-tab design is really 2 solids.

## What I had to guess (flagged in plan.md as inferred or unknown)

- Tenon width: 69.5 mm, taken from the 2 Sep raw-stock outline plus the X205 contact and X210 miss.
- Neck X faces: flush with the enclosure.
- B180 groove walls: from ball-model edge fits.
- Enclosure end orientation: H1, from uncalibrated camera frames and the old-G54 arithmetic.
- Grain: along Y.
- Holder dimensions, chuck radius and feeds.
- Also assumed: an in-file B word is accepted, and ±180 are equivalent poses (the evidence uses B-180).

## Ambiguities in the brief

- "Two C-shaped connections that retain more wood in their corners" is not defined. I read it as each end block kept as a C: corners joined by an inboard spine, the notch opening outward. That is the only C geometry a radial tool at index angles can reach.
- "B90 and B270 side openings ... a 21.3 mm physical opening" means the remaining neck thickness seen side-on, not an opening through the part.
- The rim table in `README_previous_proposal.md` ("Z201.3 at X145/170/195, Y240-252") does not say which Y went with each X. That matters for the H1/H2 question: a solid top at X170 below Y248.6 would contradict H1.
- The brief asks for "B0 or B90 work not merged". My order runs R1-B270 and R2-B270 back to back as separate files. Consecutive files at one angle are compliant as I read it, but the brief could state that explicitly.
