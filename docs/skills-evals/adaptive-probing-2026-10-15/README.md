# FR4 probing and datum investigation, 15 October 2026

Work resumed after the host crash on 17 October. This is an offline investigation and mocked
validation record. No live Luban MCP/backend/device calls, machine restart or deployment were
used for these fixes. The full Claude session transcript has not yet been supplied; tool logs
show behavior but do not prove which skills were loaded or the agent's internal reasoning.

## Recorded behavior and cost

A bounded saved-log snapshot covered 18:28:44.930–20:47:50.382 UTC on 15 October (8,428,196
bytes read from the existing server log). The private snapshot and per-station extraction remain
under ignored `local/probing-2026-10-15`; raw logs are not published. The final saved preview
`96d2964f936c_program_FR4_blank__B0___part_2__left_right_edges___height_map__2.nc`
was staged at 20:05 UTC, continuing earlier programs after a sticker obstruction.

The agent already reused measured top/bottom-edge evidence, switched independent edge probes
to an outline procedure, and retained the sticker/chuck exclusions. These were useful decisions.
The broad map still requested 10×10 stations across X141–199 / Y185–246, with 0.1mm fine steps,
three EXTRA retouches, 1mm confirmation backoff, 300ms sensing windows and guarded 5mm links.
The feed status recorded healthy GPIO transport with a 10ms poll interval. The preview's
“roughly 13min” for 100 stations came from a fixed eight-second estimate, not measured runtime.

For the 53 stations whose retract completed before the snapshot ended:

| Metric | Observed |
|---|---:|
| Median coarse/fine/backoff/confirm commands per station | 47 |
| Median execution + preceding idle for those phases | 35.824s |
| Extra backoffs per station, median | 3 |
| Confirmation approach commands per station, median | 30 |
| Share of recorded execution + idle spent in backoff/confirmation | 67.22% |

These timings exclude initial approach, links and retracts. Sensor waits are within preceding
idle, so they are not counted again. The unfinished station is excluded. This is not a complete
job runtime measurement or a promised speedup. Example first station: coarse2/fine10/backoff3/
confirm30 commands; corresponding execution1819/4073/3785/12438ms and idle616/3041/5/8181ms.

## Changes justified by the evidence

- Begin a broad nominally flat FR4 warp survey with the operator's 4×4 map. Refine anomalies
  or missing cutting constraints; do not repeat the already recorded points to apply a recipe.
- Surface-only opt-in adaptive confirmation accepts routine fine contacts with one touch.
  First station, after a miss, coarse contact, a bumped stepped link or unexpected height change
  receives one release-verified retouch. Threshold is explicit; disagreement stays uncertain
  and is excluded from geometry. Fixed mode remains compatible.
- Existing stepped links support a 0.5mm local lift. Separate 0.2mm confirmation backoff is
  allowed with a compatible fine step, and never bypasses release/held-contact behavior.
  Ordinary approach/exit, obstacle checks, spacing and global motion floor are retained.
- Preview/staging text describe the actual hop mode. Remove the unsupported fixed runtime
  estimate; use recorded phase timing instead of raising feed to conceal transaction cost.
- Issue #235: preserve raw setter triggers and per-fitting datum snapshots; report additive
  tip projections with provenance. A nominal reference convention is not independently
  measured physical machine Z. Approach estimates cannot recalibrate that datum or establish
  physical clearance, and 45mm collet protrusion cannot replace a70.9mm conventional offset.
  Old surveys remain evidence in their original convention; missing provenance stays unknown.

## Independent integration review

The reviewer found and the implementation fixed four additional gaps: failed retouches lost
the initial observation; staging text used guarded height for stepped links; camera bootstrap
recomputed target Z from an approach estimate; and pendant confirmation omitted the new
clearance basis while prefilling conventional offsets. Regression tests cover retained uncertain
observations, exact staged hop wording, qualified bootstrap targets/XY-only search, unknown
pendant prefill and explicit preservation of an unchanged measured fitting. Unqualified legacy
rotary coordinates remain stored but are excluded from metric bootstrap pending requalification.

## Validation scope

Targeted mocked tests cover adaptive escalation, single contacts, fixed compatibility, release
failure, disagreement, partial results, snapshotting calibration, migration and clearance basis.
A fresh skill respondent receives only the saved fixture and relevant skills; its response is
graded against the rubric written before the run. See the adjacent fixture/response/grading
artifacts: all seven prewritten criteria passed. This is one respondent/grader exercise, not a
statistical reliability claim. GitHub CI is the full lint/typecheck/test authority for the PR.

Hardware throughput, GPIO timing margin, physical datum establishment and cutter/body side
geometry have not been newly validated. Independent body-envelope work remains issue #187.
Do not merge or deploy solely on this offline evidence; the operator requested further UAT.
