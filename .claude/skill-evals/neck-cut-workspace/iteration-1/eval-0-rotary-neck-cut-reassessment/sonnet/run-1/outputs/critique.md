# Critique

## What helped

- `cnc-motion-rules` §2 (coordinate doctrine) and `references/work-datums.md` were exactly what
  the WCS section needed: the distinction between a datum's *measurement/registration* and its
  *independent recheck*, and the explicit statement that a derived (non-touchable) origin is
  legitimate given accessible measured references, let me accept the proposed air-side datum
  without either rubber-stamping it or rejecting it for not being a physical corner. The
  "keep the check separate from the measurements used to construct the datum" line directly
  shaped the plan's step 9 (recheck against the rim) and the note that a *fully* independent
  4th-point check would need the B-180 rim instead.
- The "reuse one WCS across B0/B90/B180/B270... rotation does not itself require re-zeroing"
  guidance (same file, and repeated in `cnc-probing` and `tool-change`) is what let me write a
  6-setup machining plan without inventing a re-zero at every angle, while still requiring a
  per-angle *jaw/bracket clearance* check (a different thing than a datum re-zero, and the brief's
  evidence only ever characterized the bracket at B0).
- `cnc-probing/references/planning.md`'s capability table made it straightforward to pick
  `probe_surface_path` with `stepped` linking for the B0-groove-far-edge extension (an unknown
  step/wall case) rather than reaching for `probe_trace_perimeter` or a naive re-scan.
- The `probe-inspection.md` "Stepped shoulder recovery" section, describing the *exact* Y259
  abort in the brief's own evidence, let me treat "the scan aborted, probe still triggered" as a
  known, already-fixed recovery case rather than something to route around by hand.

## What was missing, unclear, or contradictory for this task

- Nothing in the skills or MCP docs tells you how to reason about **milling a rectangular pocket
  with a round tool** (rounded internal corners, footprint erosion by tool radius). That is basic
  CAM knowledge outside the skill's scope, which is fine — but the brief's failure-mode list
  ("claims two/four tabs from a mid-plane sketch without a 3D cutter-sweep connectivity check")
  implicitly demands it, and I had to build and verify that geometry myself
  (`neck_sweep_check.py`) rather than being pointed at it. If this evaluation is meant to run
  again, a short reference on "how a flat-end mill actually clears a target footprint" would save
  every future agent from re-deriving the rounded-rect Minkowski-sum argument from scratch.
- `cnc-motion-rules` law 7 ("ask once... before staging anything, list every unknown the whole
  procedure needs") is unambiguous for a single continuous task, but this brief has two very
  different phases (WCS establishment, then geometry-dependent finishing) separated by results
  that are not known yet (the B0-groove-far-edge probe, the jaw checks). I batched everything I
  could identify up front, but the plan still has later `[APPROVAL]` points that depend on
  earlier results and were not, and could not have been, pre-cleared by the single batched
  question. I don't think this is a contradiction in the skill so much as an unstated boundary —
  "ask once" per *decidable-now* unknown, not literally once for the whole multi-day job — but
  the skill doesn't say that in so many words, and a stricter reading would have me try to ask
  about jaw clearance and grain direction before I even know whether the groove extends past
  Y259.
- The brief's required output template asks for "logical approvals" *and* "literal [APPROVAL]
  tags" as separate counts without defining the difference precisely; I read "logical approvals"
  as distinct operator-decision points (including the batched question and physical operator
  actions like the tool swap) and "[APPROVAL] tags" as confirm-page stagings specifically, but a
  different, equally defensible reading could merge them.
- The evidence table's rotation-sign claim ("B sign agrees with the side-probe shifts") is stated
  as settled in `README.md`, but I could not independently re-derive it from the numbers given
  (predicting a B90 contact from a B0 contact needs a B0 Z reference at the *same* X the B90 data
  was taken at, which isn't in the evidence — only the Y245 outside-width X values and one X195
  rim Z are given, at different X). I flagged this rather than asserting the sign as proven, but
  it's genuinely ambiguous whether the brief intends this to be treated as settled evidence or as
  something I should have been able to re-derive and wasn't given enough numbers for.

## What I had to guess

- The round-1 intermediate width (W1 = 26 mm) and the round-2 tab/rib dimensions (TX = 8 mm,
  TZ = 6 mm) are my own reasoned choices (stated and justified in the plan), not measurements —
  the brief asks for "one recommended tab geometry with a reasoned comparison," which necessarily
  requires picking numbers somewhere between "the whole 64.1 mm width" and "a single point," and I
  don't think the evidence pins them more tightly than I did.
- The 5.0 mm "jointly-confirmed" neck band (Y253.75-258.75) depends on where I placed the
  transition midpoints in the raw contact data; the true transitions could be up to one station
  spacing (0.5 mm) either way. I used the midpoint of each measured step as the natural choice and
  said so, but a different, equally defensible convention (e.g., the first/last confirmed contact
  rather than the transition midpoint) would shift the band by roughly ±0.5-1 mm.
- Whether the enclosure/tenon material actually continues past Y258.75/before Y253.75 as I assumed
  for the round-2 pocket's Y-footprint modelling (extending the cutter path beyond the neck band
  into "solid stock we don't model") is a physically reasonable assumption for ordinary milling
  practice, not something in evidence.

## Ambiguity in the brief itself

- "Compare four small corner tabs with two C-shaped connections that retain more wood in their
  corners" does not define what a "C-shaped connection" actually looks like in cross-section. I
  read it as two full-height edge ribs (each merging what would otherwise be a top-corner tab and
  a bottom-corner tab into one continuous feature, literally C-shaped if you trace top-face-remnant
  → side → bottom-face-remnant), which is internally consistent with "retain more wood in their
  corners" and with the prior agent's own round-2 setup count (B0Finish/B180Finish only, no
  B90/B270), but the brief never states this construction explicitly, and a reader could
  reasonably picture something else (e.g., a rounded/filleted corner boss rather than a full-height
  rib).
- The brief says the prior agent's tab dimensions must not be used "as a presumed solution" and
  should only be inspected "after developing your own geometry" — I did that — but it does not say
  whether the *prior agent's chosen band* (Y251-261, i.e. their assumed cutter extent) counts as
  part of "their solution" that I should avoid presuming, or as shared background evidence I'm
  free to reuse. I treated it as part of their solution and re-derived my own (shorter, asymmetric)
  band from the raw contacts instead, which is why my band and theirs disagree by a factor of two
  — worth the operator's attention regardless of which reading was intended.
