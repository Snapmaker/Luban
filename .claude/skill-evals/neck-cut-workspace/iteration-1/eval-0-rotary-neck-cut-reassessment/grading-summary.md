# Grading summary: eval-0 rotary neck-cut reassessment (iteration 1)

Grader: one pass over each run's `outputs/` (plan, critique, scripts, diagrams). I ran sonnet's
`neck_sweep_check.py` and did my own arithmetic from `probe_measurements_20260927.json`, the
README files and the MCP README. I did not run FreeCADCmd; opus's B-rep claims were checked against
`model_run_log.txt` and `neck_sweep_results.json`.

## Pass rates

| Config | Pass | Rate | Tokens | Duration | Tool uses | [APPROVAL] counted / stated literal / stated logical |
|---|---|---|---|---|---|---|
| opus | **22/23** | 96 % | 431,866 | 3163 s (52.7 min) | 61 | 17 / 16 / 16 |
| sonnet | **14/23** | 61 % | 248,906 | 1078 s (18.0 min) | 50 | 8 / 8 / 10 |
| haiku | **4/23** | 17 % | 103,727 | 377 s (6.3 min) | 26 | 21 / 28 / 22 |
| sonnet-noskill | **11/23** | 48 % | 194,542 | 979 s (16.3 min) | 38 | 33 / 20 / 20 |

(Opus timing was present in `run-1/timing.json`.)

## The two claims you asked me to verify

### 1. Opus: the stored axis (X170.1, physical Z112.4) contradicts the contacts; derived X169.33 / physical Z113.78

**Verdict: the conclusion holds and follows from measured data.** It does not rest on the nominal
64 x 36 CAD section, and it does not assume the enclosure is centred on the axis. The size of the Z
discrepancy depends on the probe-length basis, which opus did not reconcile in the plan.

- **Inputs are all measured:**
  - B0 top TZ201.3 and B180 top TZ204.5
  - B90/B270 side silhouettes at TZ213 from job `97ff89e230a5`: Y245 X151.5/190.4 and 148.3/187.1. These are quoted in `README_previous_proposal.md`, not in the committed JSON.
  - B0 X faces 137.85/201.95
- **Width and centring are not assumed.** Opus measures the thickness T = 36.35 (silhouette width minus 2.5), not 36. It derives the width-centre offset f = 0.575 rather than assuming the section is centred.
- **X:** Ax = (c90 + c270)/2 = 169.325 at Y245. The Y256 slice independently gives 169.30. Both are 0.8 mm from 170.1 (and 0.4 mm from the 169.7 in the MCP README).
  - This needs only an exact 180° between B90 and B270. A common index error hardly moves it (shift ≈ δ·f).
- **Z:** Az = (top0 + top180 − T)/2 → toolhead-contact 184.725, physical 113.775 with L = 70.95.
  - Keeping physical 112.4 would need the section to be 39.1 mm thick, against 36.3–36.4 measured.
  - The B270 silhouette measures the thickness at B0 x ≈ 141, which is where the B180 top contact (B0-equivalent x ≈ 140.7) sits. So the check is local and robust.
  - Assumptions: flat, parallel top and bottom faces; exact 180° indexing; nothing re-clamped between 26 and 27 Sep. The B0 and B180 rim readings repeat across both days.
- **Overstated support.** The "independent agreement 1.600 vs 1.625" works out to (top180 − top0)/2 against (c90 − c270)/2. Neither involves Az. It is a real check of indexing and rectangular-section consistency, but it does not validate the absolute axis Z. Only T carries that.
- **Probe-length basis.** The stored 112.4 comes from the 2026-09-05 four-face survey with a **71.3 mm** probe on the raw 71.9 x 47.2 stock (MCP README lines 750 and 1103).
  - In toolhead-contact terms that survey gives 183.75 against today's 184.725, a gap of 0.98 mm, not 1.38.
  - Opus cites "169.7 / 112.4 (probe 71.3)" in `critique.md` but does not carry this into the plan's ledger.
  - Either way the stored axis is inconsistent with the 26–27 Sep contacts and should not drive the CAM rotations.

### 2a. Sonnet: the band where both grooves are confirmed is "only Y253.75–258.75 (5.0 mm)"

**Verdict: does not hold as a physical statement.** It is a **tip-centre** band: B0 floor contacts
run Y254.0–259.0 and B180 floor contacts Y254.0–258.0, with transitions put at station midpoints. The
physical grooves are about one ball diameter wider:

- A 1.25 mm-radius ball that reaches the floor at tip-centre Y254 puts the enclosure-side wall at or before Y252.75.
- The B0 wall was measured at Y252.15. Sonnet lists this in its own ledger but does not use it.
- The B180 tenon-side wall is at about Y259.25–259.6. The B0 tenon side is at about 260.25–260.75, from the abort at (195, 259, TZ200.2) with the probe still triggered. Sonnet calls that edge "unmeasured, not closed"; the abort shows a wall is there.
- The physical overlap is therefore roughly Y252.3–252.8 to Y259.25–259.6, about 6.5–6.8 mm.

A 5 mm "neck" is narrower than the 6 mm cutter that must pass through it. Sonnet then models the
neck as a hard 5 mm box and extends every cut ±15 mm beyond it, into the enclosure.

### 2b. Opus: the prior Y251–261 sweep would cut into the enclosure end face

**Verdict: the arithmetic holds; "enclosure end face" is an inference.**

- The prior sweep of tracks 254/256/258 with a 6 mm cutter reaches Y251.
- The measured B0 enclosure-side wall is at Y252.15 (4a426e131af8, one X, one depth), so the sweep goes 1.15 mm past it.
- The B180 wall is bracketed at 252.25–252.75 by the ball model, so the overcut there is about 1.25–1.75 mm. Opus's "1.15–1.8" is right.
- On the tenon side, 261 exceeds the walls by about 0.25–0.75 (B0) and 1.4–1.75 (B180).
- Calling Y252.15 the enclosure's end face assumes the groove wall is the part boundary. The CAD Y placement is unregistered; opus carries this as its H1/H2 hypotheses.

## Misses per model

- **opus** (1 miss): A21. Steps 32–46 stage and start S1–S7 after the release gate.
- **sonnet** (9 misses):
  - A5: no per-B axis mapping; the rim recheck is circular, because origin Z = rim + 30.
  - A7: forbids `goto_work_origin` but never says it is XY at the current Z.
  - A8: no traverse height stated anywhere.
  - A10: no stylus-depth limit.
  - A13: the sweep is an extruded section.
  - A14: no corner radius.
  - A16: the shell is not used; the round-2 pocket runs into the enclosure.
  - A20: no post-processor.
  - A21: stages `submit_gcode_job`.
- **haiku** (19 misses): passes only A3, A6, A12 and A23.
  - Traverses before raising.
  - Tells the operator to re-mount the stock.
  - Invents the probe's setter trigger and never measures it.
  - Uses fabricated "finite-element" and area figures (2160 vs 220 mm²).
  - Puts B180 physical Z into B0 coordinates.
  - Adopts the prior agent's Y251–261 band and 23 mm depth.
  - Starts the cut.
- **sonnet-noskill** (12 misses): A5, A6, A9, A10, A11, A13, A14, A16, A18, A19, A20, A21.
  - Its largest geometry error is modelling tabs in the full 64.1 x 36.4 envelope. The corners are gone: the Y256 side silhouette is 21.3 mm, so the grooves run across the full width.

## Skills and docs text that caused or prevented misses

| Assertion | Effect | Text |
|---|---|---|
| A19 | **Prevented** (sonnet, opus); missed by noskill (`store_as_reference`, no `accept_probe_contact`) and haiku (despite the skill) | `tool-change/SKILL.md` step list: "If the outgoing tool is the touch probe, include `accept_probe_contact: true`" |
| A6 | **Prevented** (sonnet: two fresh readbacks) | TOOLS.md `set_workspace_origin`: "requires firmware selection acknowledgement and two fresh readbacks" |
| A9, A11, A18 | Skill runs name multi-X/B jaw checks and caliper measurement; noskill does not | `cnc-motion-rules/references/work-datums.md` "Retained reference does not mean retained access"; `cnc-probing/SKILL.md` "Choose measurements that answer the machining question" |
| A7, A8 | **Not prevented** for sonnet, although the rule is present. Noskill passed A8 and passed A7 only vacuously | `cnc-motion-rules/SKILL.md` §2: "`goto_work_origin` is XY at the current Z, not an automatic raise"; law 2 (motion floor) |
| A5 | Opus used it; sonnet read it and still declined to map the axis | `work-datums.md` "Reuse one WCS...": "The measured relationship between the common WCS, rotary axis/centre and B datum must be represented correctly in the CAM setup" |
| A3 / claim 1 | **Risk:** a stale jig value presented as a fact; only opus tested it | `cnc-probing/SKILL.md` jig table "Rotary axis ... axisX ≈ 170, axisZ physical ≈ 112"; MCP README line 750 "axis X ≈ 169.7, physical Z ≈ 112.4, probe 71.3" |
| A10 | **No rule**, so sonnet and haiku missed it; opus derived one | Only `work-datums.md` line 21 lists "exposed stylus reach, probe body/collet clearance" as a datum-choice concern |
| A13 | **No guidance**, so sonnet, noskill and haiku did 2D or extruded checks | Nothing in the skills on cutter-sweep connectivity; see sonnet critique.md and opus critique #8 |
| A20 | **No guidance** on cutting posts, so 3 of 4 missed it; sonnet misapplied the probing emitter | `cnc-probing/references/cam-probing.md` covers only `freecad_probe_emitter.py` for probing |

## What the brief and the evals got wrong or left ambiguous

1. **A21 conflicts with the brief.** The brief asks for "a sequenced machine/CAM plan", and the RUN_INSTRUCTIONS template asks for Steps with real tool calls. A21 fails any run that sequences the cuts after the gate, which is every run. It no longer discriminates between models.
2. **A7 passes vacuously** if `goto_work_origin` is never mentioned (noskill). It fails a plan that mentions it only to forbid it (sonnet).
3. **A14 "inside corner radius (>= 3 mm)".** For a flat endmill the section corners are sharp; R3 appears in plan view and at the ends of travel (opus is correct). The assertion wording invites a wrong answer.
4. **Rotary axis source.** The brief says the stored axis is X170.1 / physical Z112.4 and that physical = contact − 70.95. The MCP README records 169.7 / 112.4 measured with a 71.3 mm probe on 2026-09-05. The brief should say the stored value predates this clamping and this probe length.
5. **Groove width across X.** The brief does not say the grooves span the full width. The side silhouettes imply it, but noskill (and haiku) modelled a full-height section.
6. **"C-shaped connection" is undefined.** The runs produced a C with a spine (opus), straight I-ribs (sonnet), diagonal L-brackets (noskill) and side strips (haiku).
7. **Context leakage.** Noskill cites "prior findings flag this length as possibly stale (~73.5 mm)". That is not in the snapshot; it is the operator's auto-memory. The baseline is not free of this context.

## Concrete edits

- **evals.json A21 →** "The Steps list stages nothing beyond the release gate: cutting files appear as gated, placeholder follow-ups (no `submit_gcode_job`/`start_gcode_job` call listed as a step), and the plan states that no cut is staged in this evaluation."
- **A7 →** "The plan states that `goto_work_origin` moves XY at the current Z, and every return to (or approach near) work zero is preceded by a retract to machine Z328/≥Z320." A plan with no mention should fail.
- **A14 →** "...and states where the cutter radius appears (R3 in plan view and at the ends of travel; sharp section corners for a flat endmill)."
- **New assertion:** "The plan tests the stored rotary axis against opposite-face contacts (B0/B180 tops with the measured thickness, B90/B270 silhouette centres) and states the probe-length basis of each value before rotating CAM about it."
- **Brief, evidence table row "Rotary and CAD references" →** add: "The stored value was measured 2026-09-05 with a 71.3 mm probe on the raw stock (MCP README); it predates this clamping and probe."
- **`cnc-probing/SKILL.md` jig table, Rotary axis row →** "`geometry.rotary` — a historical estimate tied to the probe length and clamping it was measured with; before CAM rotates about it, check it against opposite-face contacts (B0/B180 tops with measured thickness, B90/B270 side centres); never use it as a toolhead Z."
- **`cnc-probing/SKILL.md`, new line under "Choose measurements" →** "Limit any descent beside a wall or into a groove to the exposed stylus minus the ball diameter, measured from the highest surface under the probe body; state that limit in the plan."
- **`work-datums.md` →** add a short section "Retained-connection geometry": "Model cutter sweeps in 3D, including the radius at the ends of travel; count connected solids across the whole kerf, not one section. A notch sized from the mid-plane can leave features joined near the kerf edges."
- **New `cnc-motion-rules` reference (or TOOLS.md line) →** "Cutting files from FreeCAD CAM need a Job with a verified post (G21/G90/G54 only, no G53/G92/G28/M6), `validate_gcode`, and an independent parse from first move to final retraction. `freecad_probe_emitter.py` is for probing only." Also state whether an in-file `G0 B` is passed through.
- **Eval harness:** run noskill (and ideally all configs) with auto-memory disabled.
