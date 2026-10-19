# Critique: Thread-milling documentation and operator guidance

## What helped

- **`thread-milling.md` § Usage.** The tool signature, parameter explanations (source_controller, spindle_mode, tool_center_path, tool_length_applied), and the warning about RPM vs power-percent modes are clear and sufficient to write the conversion call correctly.
- **M2.5 fixture (`thread-milling-m2_5-fanuc.nc`).** A complete real example showing the structure, comment format, M03/M05 placement, G54 work-frame declaration, and the repeated arc+retract pattern for multi-tooth cutters. This was crucial for understanding what the operator would see from Machining Doctor.
- **`cnc-motion-rules` § 7 (running a program).** The preflight checklist (tool, clamps, deepest Z vs stock, door, extraction) and the frame handshake (G54 implied for a Luban/CAM export, `frame: "work"`) are complete and applicable here.
- **`TOOLS.md` & `submit_gcode_job`.** Clear staging workflow: validate → submit → deliver URL → wait.
- **`tool-change` skill § Failure modes.** Measurement spread checking and the 50 mm delta limit on `apply_tool_length_offset` are useful guardrails.

## What was missing, unclear or contradictory

- **No operator-level guidance on Machining Doctor input parameters for the A350.** The `thread-milling.md` doc is purely about the *importer* (what happens after Machining Doctor produces G-code), not about *generating* a program in Machining Doctor for this machine. An operator reading the doc sees "precision 1–5" and "approach factor" but no hint about typical values for a small aluminum job on the A350, no feed-rate heuristics, no comment on single-tooth vs multi-tooth tooling strategy. The M2.5 example gives numbers (17991 RPM, 2159 mm/min approach feed, 491 mm/min thread feed) but no explanation of how those relate to cutter geometry or aluminum.

- **Single-tooth vs multi-tooth dynamics not discussed.** The converter preserves the source feeds (documented in thread-milling.md line 76), which is correct, but nothing explains why a single-tooth cutter will cut differently from the M2.5 reference triple-tooth, what affects spindle speed (chip load, cutter stiffness, runout), or whether the operator should expect different surface finish or tool wear. This gap forced a question: "is the M4 cutter already fitted?"

- **Cutter diameter declaration ambiguity.** Machining Doctor's form has a "Cutter Diam" field; the naming convention (M4×0.7×**D4**×50L) uses D for body diameter, not cutting diameter. The M2.5 example (1.38 mm "Cutter Diam") was actually a multi-tooth cutter with a 1.38 mm cutting edge, not a body diameter; an operator unfamiliar with thread mills might confuse D (nominal body) with the actual cutting edge the generator needs. No clarification in the docs.

- **Work origin Z reference frame not addressed.** The `thread-milling.md` example (line 12) notes "thread length 5 mm" and "final Z +0.006 mm" but does not explain whether Machining Doctor takes absolute work-Z datums or incremental depth. The comment "8 mm thread depth wanted" is ambiguous: 8 mm down from what? The converter preserves the source approach order and Z datums, so the operator must know this before running Machining Doctor.

- **No mention of probing/verification after the cut.** The skills cover probing extensively, but thread-milling.md does not suggest or discourage a follow-up measurement. For a first run (especially single-tooth), a quick probe of the thread pitch and depth would verify success, but the doc is silent on this.

- **Spindle mode selection buried in the converter schema.** The converter `spindle_mode` parameter (RPM vs power_percent) is the *output* mode, not the *input* mode — the generated Machining Doctor G-code is always in RPM. An operator with a standard CNC head (power_percent) must remember to set the output mode correctly, and the doc (thread-milling.md line 22–23) mentions it but does not highlight it as a gotcha or offer a checklist.

## What I had to guess

1. **Cutter cutting diameter.** The M4×D4 marking implies a 4 mm body, but I do not know the actual cutting-edge diameter or length without asking the operator. The generator needs this; the docs do not explain how to measure or estimate it.

2. **M4 cutter cutting length.** By analogy to the M2.5 (1.38 mm diameter, 7.5 mm cutting length), the M4 might also have ~7–8 mm of cutting edge, but this is a guess. A single-tooth form might be shorter (less axial flute, more aggressive pitch) or longer (for lighter cutters).

3. **Work origin Z datum.** I assumed the operator would either:
   - Set the work origin by touching the stock top with the M4 cutter before milling (most common),
   - Or have a fixed machine-frame reference (less common for thread milling).
   Without a question, I cannot know which, so the plan asks.

4. **Spindle mode (RPM vs power_percent).** I guessed 200W CNC (RPM mode) because the memory says "A350=CNC" and the thread-milling.md example uses RPM, but the plan asks to confirm.

5. **Machining Doctor availability and UI.** The docs reference the online generator at machiningdoctor.com, and the code mentions a "visible Playwright session after HTTP/headless requests encountered Cloudflare" (test note, not production), but there is no URL, login requirement, or step-by-step walkthrough in the docs for an operator to follow. I assumed they know how to use it and would find it online.

## Summary

The converter and motion tools are well-documented and the M2.5 example is a solid template. The gaps are in the *generator* side (Machining Doctor setup) and in bridging cutter geometry → generator inputs → converter output. The plan compensates by asking six questions upfront, but a "Thread milling setup for the A350" guide (covering cutter measurement, Machining Doctor field mapping, and common feeds/speeds) would reduce operator friction and agent questions from six down to one or two.
