# Critique

## What helped

- `cnc-motion-rules` §2's probe-length rule ("it is normally set — plan on the stored value and
  do not budget an approval for measuring it") plus the tool-setter surface constant in
  `cnc-probing`'s jig-facts table (machine Z100.5) let me derive `old_trigger_z` for the
  probe-to-cutter tool change algebraically instead of spending an approval on `run_tool_setter`
  for the outgoing probe. That's a real interruption saved and I would not have found it without
  both documents together.
- `tool-change` SKILL.md's explicit skip condition ("last stored measurement is from this same
  tool, this session") is what let the second tool change (M2.5 → M4) drop its "measure old tool"
  step too, since the M2.5 measurement from the first change is still fresh.
- `thread-milling.md`'s coverage tables (especially "Cutter flutes / axial forms: do not infer
  one from the other" and the generator-option list distinguishing "single tooth" from "multi
  tooth longer/shorter than thread") were what let me reason about the single-row vs triple-row
  M4 choice at all, and also what told me the choice needs a cutting-length figure I don't have.
- `README.md`'s one-line hardware record ("hardware-verified against a Snapmaker 2.0 A350 (CNC,
  200 W toolhead...)") answered the `get_machine_profile` branch the run instructions flagged as
  missing from the stand-in, without inventing a value — I still call the tool live per the
  instructions rather than trusting a possibly-stale doc line alone.

## What was missing, unclear, or contradictory

- **No file documents how a Machining Doctor export's XYZ datum interacts with the plate's work
  origin.** `thread-milling.md`'s form-control table says "XYZ datum... preserve source
  coordinates... nonzero datum... tested," which confirms the generator HAS a datum input and the
  importer passes it through, but nothing says the datum is meant to be entered in the SAME frame
  as the machine's work origin (as opposed to, say, a fixture-relative frame the operator has to
  translate by hand). I inferred "generate one export per hole, datum = hole's work XY" because
  it's the only reading consistent with "the converter does not invent clearance / does not
  reposition," but this is a guess about a workflow that happens entirely inside Machining
  Doctor, outside anything in the snapshot.
- **No document says what "D4" means in a cutter name**, or that it's shank rather than cutting
  diameter. I only caught this by comparing the fixture's own header
  (`CUTTER DIAM=1.38`) against the "M2.5x0.45xD4x50L" name in the prompt — the same D4 appears on
  both M4 candidates, so by the same logic neither name gives a usable cutting diameter. A
  glossary line in `thread-milling.md` (or the tool naming convention itself, if this shop has
  one) would have let me resolve the single-row/triple-row question instead of pushing it back to
  the operator.
- **Nothing states the safe/expected Z at the start of a converted thread-milling job.**
  `thread-milling.md` says the validator "exclude[s] the unknown initial position" from its
  bounds check, which is exactly the right warning, but neither that file nor
  `cnc-motion-rules` §7 (which is written for ordinary Luban/CAM programs, not this specific
  converter) tells the agent what to DO about it. I added a `get_position` + conditional
  `move_z` before every submit as the most literal reading of law 2, but I'm not fully certain
  that's what an operator running this converter day-to-day would want, versus e.g. always
  parking to 328 right after the previous job's `M30`/`G90 G00 Z20.0` retract as a fixed habit.
- **`tool_length_applied: true`'s precondition is stated only in prose** ("the work origin
  already accounts for the fitted tool tip"), with no cross-reference to the `tool-change` skill
  that is the thing which actually makes it true. A one-line pointer ("see `tool-change` — apply
  the offset first") would have made the ordering (tool change before conversion/submit)
  unmissable instead of something I had to reconstruct from first principles.
- **The `convert_thread_milling_gcode` schema in the run instructions and `thread-milling.md`
  do not mention `head_type`**, but `TOOLS.md`'s `submit_gcode_job` entry and the usage note at
  the end of `thread-milling.md` ("submit the returned program through `submit_gcode_job` with
  `head_type: "cnc"`") do. Reading only the schema block would have left that argument out;
  I only caught it by reading the whole `thread-milling.md` file rather than skimming for the
  schema.
- I had to guess that the fixture's `S17991` being just under the 200 W ceiling (18000) is a
  deliberate, honored value rather than something to renegotiate — no document says the generator
  target-fits firmware limits on purpose, I just did the arithmetic.

plan.md
