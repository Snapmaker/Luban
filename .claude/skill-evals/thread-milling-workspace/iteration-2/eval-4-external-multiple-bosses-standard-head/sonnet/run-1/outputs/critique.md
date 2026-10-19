# Critique

## What helped
- `cnc-thread-milling/references/import.md` gave the exact declaration table (`tool_center_path`,
  `tool_length_applied`, `spindle_mode` with `power_percent` vs `cnc_200w_rpm`) and the Okuma
  mapping specifics (G15 H1 → G54, G56/H removal), which let me pick `source_controller: "okuma"`
  and the `power_percent`/`spindle_power_percent: 65` combination directly.
- `cnc-thread-milling/references/setup.md` "Multiple holes or bosses" section was decisive for the
  two-boss structure: one program per feature, each keeping its own per-boss datum, never a shared
  (0,0) export re-run after a traverse, and an approval-counting worked example (6 holes + 2 swaps
  = 14) that I could reason from by analogy for this no-swap, two-feature case.
- `cnc-thread-milling/SKILL.md`'s internal/external comparison table was what let me commit to the
  *external*-specific checklist (boss diameter/centre/height/shoulder, cutter+neck+shank+holder+
  clamp clearance around the whole boss) instead of accidentally reusing internal-bore language.
- `cnc-motion-rules/SKILL.md` §0 (the state checklist), §2 (frame handshake) and §8 (canonical
  calls, staging → confirm URL → end turn → background wait) gave the concrete call shapes and the
  approval/wait choreography; the M2.5 fixture note in `setup.md`/`thread-milling.md` about the
  source's `G00 X0 Y0` running before the first Z move was the direct source of the "check the
  whole approach segment, not the nominal source Z" finding.

## What was missing, unclear or contradictory for this task
- No reference shows a **complete worked call** for `spindle_mode: "power_percent"` — the canonical
  call block in `cnc-motion-rules` §8 only has the `cnc_200w_rpm` RPM example and explicitly says
  "standard-head percentage arguments are in cnc-thread-milling," but that skill's references only
  give the field table, not a full example object. I assembled the power_percent call myself by
  splicing the field table onto the canonical call's shape; a worked example would remove that
  guess.
- The approval-count worked examples (`setup.md`'s "6 holes and two flow-A tool changes … 6 + 4 + 4
  = 14") are all for *internal* holes with tool changes in the mix. Nothing walks through the
  simpler two-external-boss, single-cutter, no-swap case, so the "2 approvals total" count here is
  derived from the general rule ("one approval per feature … actual tool-change stages … do not
  count read-only calls") rather than read off a matching example.
- It is not stated how "fresh" a head-identity check (`get_machine_profile`) needs to be relative to
  the position/connection freshness that must be re-checked immediately before each `submit_gcode_job`.
  I chose to read the head once up front and only re-verify position/state before each submission,
  reasoning that a fitted head doesn't change mid-session absent an operator statement otherwise —
  but this is my inference, not a written rule.
- Nothing in the read material states whether a "common corner datum" shared by two per-boss-datum
  exports is itself required to have been established via a *measured* registration (per
  `work-datums.md`) versus just asserted in chat; I treated the operator's description as sufficient
  to plan on (consistent with "operator-stated numbers count"), but flagged in the plan that the
  live `originOffset`/tool-history should still be re-confirmed rather than taken purely on the
  chat description, since none of the read skills say the operator's one-line summary substitutes
  for that check.
- The actual machine state needed to resolve the landmark-crossing question (current `originOffset`,
  actual stored landmark boxes) is deliberately withheld by this dry run's fixture, so the plan can
  state the check that must be run but cannot itself conclude whether either boss's path is clear —
  that is the correct posture for a dry run, but it's worth flagging explicitly since a careless
  read could mistake "plan includes the check" for "the check has already passed."
