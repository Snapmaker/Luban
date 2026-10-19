# Critique

This run was explicitly `config: noskill` — I did not read anything under `.claude/skills/`, including
`cnc-motion-rules`, `cnc-probing`, `cnc-visual-alignment` or `tool-change`, even though the brief names
them as the intended starting point ("Use the installed `cnc-motion-rules` skill first..."). Everything
below is scoped to that constraint: what the MCP docs alone (`TOOLS.md`, `workspaces.md`,
`probe-inspection.md`, `COMPOSITE_PROBE_PROGRAM.md`) gave me, and where their absence forced a guess.

## What the MCP docs covered well

- `TOOLS.md`'s "Standing rules the tools assume" section is dense but sufficient on its own to reconstruct
  the core motion doctrine without the skill: always-fitted tool, motion floor Z320/traverse Z328, one
  approval per bounded procedure, machine-coordinate planning, human-gated origin writes, `get_position`
  reliability gating. I did not have to guess any of these.
- `workspaces.md` and `probe-inspection.md`'s "Latest datum handoff" section directly describe this exact
  scenario's prior history (the proposed-but-unset air-side origin, `set_workspace_origin` as the closing
  tool) — clearly written for someone picking this up cold.
- `probe-inspection.md`'s "Efficient inspection planning" and "Existing local continuation" sections gave
  me a defensible basis for *not* proposing a dense re-survey, and for citing which primitive
  (`probe_surface_path`, `probe_wall_follow`, etc.) fits each bounded gap I flagged.

## What was missing, unclear, or required a guess (without the skill)

- **No document tells you how B-axis motion happens inside a cutting file job.** `probe_program`'s
  `rotate_b` op is clearly scoped to probing procedures. For the actual milling G-code, I inferred (not
  found stated anywhere in `TOOLS.md`/`workspaces.md`) that a B move belongs inside each setup's submitted
  file as a leading `G53 B<angle>` line, reviewed by `validate_gcode` like any other move. If this is wrong
  — if indexed cutting actually requires a separate MCP-mediated rotation step analogous to
  `goto_tool_change_position` — my Round 1/2 step list understates the approval count by 8 (one rotate
  step per B-indexed setup). This is exactly the kind of thing `cnc-motion-rules` or `tool-change` would
  likely settle immediately; without them I had to reason it out from tool-surface shape alone and flag the
  uncertainty here instead of asserting it.
- **No stated doctrine on what counts as "the endmill's fitted length" workflow order** beyond the terse
  `run_tool_setter`/`apply_tool_length_offset` one-liners in `TOOLS.md`. I inferred the swap sequence
  (setter-with-probe → park → operator swap → setter-with-endmill → offset-apply → reselect/verify) from the
  tool descriptions and the evidence file's own narrative ("Measure probe before physical swap, measure
  installed endmill after swap..."), not from a documented procedure. `tool-change` almost certainly states
  this explicitly; I could not check.
- **Corner-radius / cutter-sweep geometry has no reference at all in the MCP docs** — reasonably so, since
  that is CAM/CAD reasoning, not a tool contract. I built `neck_cross_section.py` from first principles
  (concave-corner fillet = square-minus-quarter-disk at the cutter radius). I am confident in the geometry
  but not in whether the brief expected a full 3D FreeCAD boolean (stock minus four swept solids) rather
  than my simplified prismatic-cross-section-plus-voxel-BFS approach. I judged the latter sufficient for a
  dry-run "3D cutter-sweep connectivity check" given the time budget, but flag it as a real simplification:
  a true CAM Job would show whether the cut is actually achievable in one tool orientation per face (mine
  assumes it trivially is) and whether ramp/entry moves intrude into a neighbouring bracket's territory.

## What I had to guess from the brief itself

- **Whether the neck is solid stock or continues the enclosure's hollow shell.** The brief's own phrasing
  ("material between a wooden enclosure and its chuck-held tenon") reads as solid, and I used that as my
  working assumption, but the CAD inventory shows the enclosure has both solid (2304 mm²) and thin-shell
  (404 mm²) sections along its own unregistered local Y, so this is not something the evidence rules out.
  I think this ambiguity is intentional (it is exactly the sort of thing "distinguish its hollow shell,
  existing groove, clamping tenon and chuck jaws" in the brief's required assessment #3 is pointing at), but
  it is worth naming explicitly: a reviewer could reasonably read the brief either way, and my whole
  cross-section model depends on picking "solid."
- **What exactly "two C-shaped connections that retain more wood in their corners" means geometrically.**
  I read it as two diagonal L/C brackets, larger than a simple corner post, each wrapping one corner with
  two legs — as opposed to, say, two full-height wall segments (which would not really be "in their
  corners") or two half-perimeter arcs. This is a defensible reading but not the only one; I did not find
  language in the brief that forces a single interpretation, and the prior agent's own evidence
  (`fixture_section_checks.txt`, showing exactly 2 residual pieces of ~36 mm² each) does not disambiguate
  the shape, only the count.
- **The exact Y sub-ranges for each face's engagement in the planned cuts.** I deliberately chose my own
  (Y254.0-258.0, the contact-verified floor overlap) rather than the prior agent's Y251-261 axial-extent
  band, per the brief's explicit instruction not to start from the prior tab dimensions. I believe mine is
  more conservative and better justified from the raw per-station contacts, but it is still a planning
  choice, not a measurement, and I labelled it as such throughout.

## One likely error worth flagging to a reviewer

My Round-2 finishing plan uses all four B indices (B0/B180/B90/B270 finish), unlike the prior agent's
evidence which only finishes B0/B180. I justified this by arguing the C-bracket design needs precise
boundaries on both legs of each bracket, but I did not verify this against any documented CAM constraint —
it is my own engineering judgement, and it materially changes the approval count (8 setups instead of 6)
from the prior agent's model. A reviewer with the actual `cnc-motion-rules`/`tool-change` skills loaded
might see a documented reason to prefer 6.
