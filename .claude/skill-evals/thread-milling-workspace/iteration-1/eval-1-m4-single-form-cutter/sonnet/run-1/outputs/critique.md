# Critique: thread-milling skills/docs for the M4 single-tooth job

## What helped

- `thread-milling.md`'s "Generator option coverage" table was the single most useful thing —
  it let me build the exact Machining Doctor field list (single tooth vs multi tooth, tool-centre
  compensation, RH/LH + climb/conventional, controller choice) without ever opening the page,
  and it told me directly which submission args to use (`head_type: "cnc"`, `frame: "work"`).
- The fixture file (`thread-milling-m2_5-fanuc.nc`) made the abstract "tool-centre / D=0" idea
  concrete: seeing `G41 D1` alongside a header that says `D=0` resolved what "D1 selects a
  register, not a compensation value" (from the doc) actually looks like on the wire.
- `cnc-motion-rules` §7 ("running a program someone else generated") mapped directly onto
  step 7–10 of the plan; having the canonical call shapes in §8 meant I didn't have to guess
  argument names for `submit_gcode_job`/`start_gcode_job`.
- `tool-change/SKILL.md`'s "ask which flow" line and four-approval accounting matched almost
  exactly what I needed for the mandatory probe→cutter swap, including the exact reason the
  operator must be asked for both tools' approximate protrusions before staging anything.

## What was missing, unclear, or contradictory

- **No cross-reference from `thread-milling.md` to `tool-change`.** The thread-milling doc reads
  as if the only remaining step after conversion is `submit_gcode_job`; it never mentions that
  `tool_length_applied: true` is a claim about the *fitted tool*, and that fitting the described
  tool is a whole separate procedure with its own approvals. I had to notice independently (from
  the stand-in state) that the probe, not a cutter, is currently in the spindle, and reason from
  `cnc-motion-rules` law 5 that this blocks the job. A one-line pointer in `thread-milling.md`
  ("confirm the declared tool is actually fitted — see `tool-change`") would have made this
  non-optional instead of something an agent could miss.
- **Machining Doctor's actual field names are never given**, only the *behaviors* the converter
  preserves (RH/LH, climb/conventional, single/multi tooth, tool-centre comp, controller). That's
  reasonable given the docs describe the *importer*, not the generator page — but it means the
  "what to put into Machining Doctor" half of the operator's ask has to be phrased in the
  converter's vocabulary and trusted to line up with whatever labels the operator actually sees
  on the page. A short appendix mapping doc-language to the page's own field labels (even just
  "the page calls this 'Tooth Form'") would remove that translation risk entirely.
- **"Cutter diameter" is ambiguous against the operator's own part-numbering.** The operator
  describes tools as `M4x0.7xD4x50L`, where `D4` is clearly a shank/body diameter (a 4 mm-diameter
  cutter cannot enter a 3.3 mm hole), while Machining Doctor's "cutter diameter" input must be the
  cutting/neck diameter. Nothing in `thread-milling.md` calls this out explicitly — I inferred it
  by analogy with the M2.5 cutter's stated 1.38 mm neck vs. its own `D4` shank designation in the
  same part-numbering scheme. An agent less familiar with thread-mill part numbers could easily
  feed the shank diameter into Machining Doctor and get a physically impossible program validated
  without any warning, since the converter only checks the *exported* geometry, not tool-vs-hole
  fit.
- **No stated way to check hole/cutter/thread-major-diameter clearance before conversion.** The
  converter validates the emitted toolpath's own bounds, but nothing here (docs or tools) confirms
  that a given neck diameter is a *sane* cutter for an M4x0.7 hole (e.g., that it can reach full
  thread depth without rubbing the flanks) — this remains entirely the operator's judgment, which
  is fine, but it's worth the plan saying so rather than implying the converter validates it.
- **Guessed / assumed, flagged as questions rather than guessed silently:** the M4 cutter's actual
  cutting diameter and length, RH/LH and climb/conventional direction, and feed/speed philosophy.
  I did NOT guess these even though a "reasonable default" (RH, climb, matching the M2.5 job) was
  tempting — the motion-rules "ask once" law and the fact that a wrong helix direction is a real
  physical mistake (not just a style choice) argued for asking rather than defaulting.
- **`get_machine_profile` genuinely wasn't answerable from the stand-in**, exactly as flagged in
  the run instructions — I planned it as the first call and branched the `spindle_mode` choice on
  it, but the README's one hardware-verification line ("200 W toolhead") sits close enough to the
  thread-milling section that a less careful read could mistake it for this session's config
  rather than the project's general test rig.

path: C:\dev\software\snapmaker\Luban\.claude\worktrees\thread-cutter-evaluation-8d4f82\.claude\skill-evals\thread-milling-workspace\iteration-1\eval-1-m4-single-form-cutter\sonnet\run-1\outputs\plan.md
