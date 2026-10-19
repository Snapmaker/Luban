# Critique: skills, docs and brief for this task

## What helped

- **`cnc-motion-rules/references/work-datums.md`** was the single most load-bearing file. Its
  distinction between a derived/air-side zero and a touchable one, the "a contact that fed the
  origin cannot also verify it" rule, and "prefer one verified WCS across indexed B operations"
  directly shaped the WCS section without any hand-waving — I didn't have to invent a policy for
  "is X230/Y245 a legitimate zero," the skill already answers it.
- **`cnc-motion-rules/references/cutting-programs.md`**, specifically "A flat endmill's sweep has
  a half-cylinder of radius r at each end of travel in plan view and a flat bottom, so its
  SECTION corners are sharp; the radius appears in plan view and at the ends of travel, not in
  the section" — this sentence is what let me build a *correct* voxel model (rounding in the
  travel plane, flat in the plunge axis) instead of guessing at an isotropic rounding. It's the
  exact mechanism the brief's scoring rubric threatens to fail on ("claims two/four tabs from a
  mid-plane sketch without a 3D cutter-sweep connectivity check").
- **`cnc-probing/references/rotary-axis.md`** gave a ready-made, checkable formula for validating
  the stored rotary axis instead of either trusting it blindly or refusing to use it at all.
- **`probe-inspection.md`**'s stylus-reach paragraph ("exposed 21, ball 2.5, margin 2: no floor
  contact more than 16.5 mm below the highest rim under the body") is exactly the number I needed
  for bounding the datum re-measurement steps, and it was already worked as an example.

## What was missing, unclear or contradictory for this task

- **No skill file states how to combine a B90/B270 "side" cut with a B0/B180 "top/bottom" cut in
  the SAME local physical frame.** I had to work out myself which two of {X,Y,Z} round for which
  approach (side → round Y,Z; top/bottom → round X,Y) from the *general* cutting-programs.md
  sentence about plan-view rounding, plus my own reasoning about what the B-axis physically does.
  A worked example for a rotary "side vs face" pass — even a diagram — would remove real risk of
  getting the plane wrong (I nearly did, in my first draft: see below).
- **No file discusses how to build or register a bounding solid for the *transition* between a
  hollow shell and a solid tenon.** `cutting-programs.md` says "not an axis-aligned block ... not
  CAD placed by its own origin" for the enclosure shell, but this neck region is neither clearly
  the hollow shell nor clearly the tenon, and nothing in the skills or the evidence resolves that
  — I had to make an explicit, flagged assumption (solid rectangular envelope at the neck) rather
  than find guidance for it.
- **The mapping from "west"/"east" (task language) to physical compass or a checkable landmark is
  never fixed anywhere in the evidence.** The B90/B270 edge-shift data fixes the *rotation sign*
  (which groove appears on which side of the B90 vs B270 view) but not which physical face a
  human would call "west." I ended up asking the operator rather than guessing, which I believe
  is correct, but a skill file could usefully say "B-direction sign is not a compass label; ask."

## What I had to guess

- **The centre-separating cut for the two-C variant.** The brief describes the C's only as "west
  mirrored C opens toward B270 ... east C opens toward B90" — two side-approach operations. My
  own 3D check showed that without a *third* operation (a straight centre slot, most naturally
  cut from B0 or B180) the two C's are not actually separate pieces; they're one wide notched
  bridge (≈337 mm², one connected component, not two). I added that third operation myself and
  flagged it explicitly in the Machining plan rather than silently matching the brief's
  two-sentence description at the cost of the two-piece claim it's actually asking me to
  evaluate. This is exactly the kind of thing the brief tells the agent not to do silently
  ("do not merge... do not treat... without a 3D cutter-sweep connectivity check") — I'd rather
  flag an addition than quietly under-deliver on "two."
- **Round-1 side-cut depth (22.05 mm) and the tab/C round-2 dimensions** (tab_w/tab_h, spine_w,
  leg_h, gap_half) are my own reasoned numbers, chosen to (a) leave enough width for a legible
  round-2 result, (b) keep total reach from each face comfortably under the ~29 mm caution figure
  in the evidence, and (c) survive the cutter-radius dilation without vanishing (my first attempt
  at the C's spine, spine_w=2 mm against r=3 mm, got eaten entirely by the adjacent gap cut's own
  rounding — the numeric check caught this immediately; a hand-sketch would not have).
- **The existing grooves' full-width assumption.** Both grooves were only probed at one X (195,
  198). I modelled them as full-width boxes because the six-op prior review model and the
  README's "reopen the top/bottom channel" language both imply the whole width is already open,
  but this is an inference, not a measurement, and I said so in the ledger and in "Remaining
  measurements."

## Modelling pitfall worth recording for future runs

My first pass at the four-corner-tab variant narrowed the round-2 pass's own core rectangle in X
to spare a margin column (an intuitive way to "leave the corners"), and it produced **two
full-height pillars, not four tabs** — because narrowing the pass core in X, with the SAME
Z-range for both the top and bottom deepening passes, leaves the untouched margin column
untouched at *every* Z, not just at the top and bottom. The fix was to keep the pass's plan-view
core at FULL width and instead carve two small Z-bounded *exclusion notches* out of it — i.e. the
tab is what the pass explicitly avoids, not what a narrower pass happens to miss. I only caught
this by actually running the connected-component count and getting `4 pieces` when I expected it,
then noticing the FIRST run said `2 pieces` and re-reading my own code. This is precisely why the
brief refuses to accept a tab/bridge claim without a solid connectivity check — I would have
written a wrong "four tabs" section confidently if I had reasoned it out by hand instead.

## Ambiguity in the brief itself

- "Compare four small corner tabs with two C-shaped connections at the side ends" doesn't state
  whether the two C's are expected to be topologically separate from each other or may share a
  spine/bridge; I resolved this by assuming "two" means two distinct pieces (matching the
  parallel four-tab framing) and flagged the extra operation this requires.
- The brief's tool description ("25 mm cutting edge... about 20 mm in the collet... about 55 mm
  protrusion... A 29 mm tip reach can be valid ... if the first side cut has opened the entry
  corridor to 24 mm") reads as a hint at the prior agent's own numbers (24 mm corridor, up to
  29 mm reach) rather than a fixed constraint; I used it as a sanity bound (my 22.05/24.05 mm
  stay under it) without adopting it as a target, per the instruction not to start from the prior
  agent's dimensions as a presumed solution.
