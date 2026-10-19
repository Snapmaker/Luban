# Critique: Thread-milling plan evaluation

## What helped

- **cnc-motion-rules/SKILL.md (read first)**: Excellent foundational document. The eight motion laws are precise and well-motivated. The coordinate doctrine (machine vs. work frame, G53/G54 handshake) is clear. Position-of-record reliability states are well-defined. The canonical calls with exact argument names are copy-paste ready. This skill alone discharged the bulk of the pre-flight checklist and staging pattern.

- **thread-milling.md**: Exactly the reference needed. The tool signature, usage section with the JSON template, the mapping of Machining Doctor options to conversion behavior, and the firmware evidence (ARC_SUPPORT, M3-M5.cpp spindle path for 200W CNC, RPM limits 8000–18000, G43/H handling) all directly informed the plan. The unsupported input list (G93, macro, rotary, workspace changes, nonzero compensation) is helpful for validation.

- **TOOLS.md (reference section)**: Quick lookup for tool surface semantics (`submit_gcode_job` frame argument, `validate_gcode` role, staging/start pattern). Confirmed that `convert_thread_milling_gcode` is not listed in the 54 tools listed (it appears to be newer or in a separate schema).

- **tool-change/SKILL.md**: Provided context for understanding that tool-setter measurement and length offset are the mechanisms underlying any future tool swap. Not needed for this task (no tool change), but the skill helped confirm that the touch probe stays in spindle for thread milling and that the work origin is the operator's to set/maintain.

## What was missing, unclear or contradictory

- **Machine profile in the stand-in**: RUN_INSTRUCTIONS states `get_machine_profile` is "NOT in this stand-in." For thread-milling, the spindle mode (standard CNC: power_percent 1–100, vs. 200W CNC: cnc_200w_rpm 8000–18000) is critical. The stand-in supplies connection status and position but not the head type. I inferred the machine is 200W from the memory context ("Snapmaker A350=CNC, F350=printer" + "200W CNC" noted elsewhere) and from the spindle_mode choice in thread-milling.md examples showing "cnc_200w_rpm" as the default. A stand-in `get_machine_profile` field or an explicit "head type: 200W CNC" in the stand-in would avoid inference.

- **Spindle speed rejection vs. clamping**: The thread-milling.md §Usage says spindle_mode "cnc_200w_rpm" "rejects values outside the firmware's 8000–18000 range instead of silently clamping." However, it does not explicitly state that `convert_thread_milling_gcode` itself will REJECT the call with a 17991 RPM input, or whether it will clamp the value before conversion. The firmware clamps; the converter might do either (reject on input validation, or clamp on output). This ambiguity forced the plan to offer two options and defer the outcome to the tool call. A clarification like "The converter validates spindle speed at call time and refuses conversion for out-of-range input" would tighten the plan.

- **Work-origin assumption**: The FANUC program has `G54` (work frame selected) and `G90 G00 X0 Y0` at the hole. The plan assumes the operator has (or will) set work origin at the hole; no explicit preflight check in the stand-in confirms this. cnc-motion-rules §2 says "The work origin belongs to the operator, Luban and the firmware — not to you" and to "read it fresh from `get_position.originOffset`." However, `originOffset` in the stand-in is listed as "present (the operator set a work origin earlier today)" but its value is not given. I added a conditional Step 3 to set the origin if needed, but could have been more assertive: "ask the operator to confirm the work origin is at the hole" as a preflight question.

- **Cutter neck vs. hole clearance**: The cutter has a 1.38 mm neck, 7.5 mm total length. The hole is 2.05 mm, 6 mm deep. For a 1.38 mm neck to fit a 2.05 mm hole, the geometry works (1.38 < 2.05), but the plan notes the "thin clearance" (2.5 mm between thread depth and total length) without calculating the actual gap. This could be clearer: neck clearance = 2.05 − 1.38 = 0.67 mm radial (tight, but common for thread mills). The plan flags it; a tighter spec (e.g., "no more than 0.5 mm radial clearance per thread-mill practice") would strengthen the check.

- **Three-pass helical motion**: The FANUC file shows three repeated passes with approach/turn/retract. The plan mentions this but does not walk through the XY/Z envelope or feed rates to spot issues. The arcs are small (0.288 mm XY, 0.056 mm Z per segment) and well-suited to segmentation, but a preview of the converted move count and duration would inform the operator.

## What I had to guess

- **Spindle speed handling**: I presented both Option A (regenerate) and Option B (accept clamp) without knowing the tool's exact behavior. A test call would clarify, but I cannot make MCP calls in this dry run.

- **Work-origin Z value**: The FANUC program declares work frame (G54) and moves to Z+0 (work). In machine coordinates, work Z+0 = machine Z_surface (the aluminum plate). The stand-in does not supply the actual measured or operator-set work origin Z offset, only that it "is present." The plan assumes the operator maintains this correctly but does not verify it numerically. A preflight step reading `get_position → originOffset.z` and asking "Is this the plate surface?" would tighten it.

- **Hole location**: The FANUC program moves `X0 Y0` in work frame. I assumed this is the work origin set AT the hole, not some other reference point. The operator's statement "The hole is already drilled 2.05 mm, about 6 mm deep" doesn't tell me the work-frame coordinates. The plan asks "Is the work origin set at the hole?" which is the right check.

- **Landmark/rotary safety**: The plan does not check whether the hole location is near the rotary axis landmark. For a small-envelope program (±0.3 mm XY around the hole), this is usually safe, but the operator should confirm the hole is not inside the rotary keep-out zone. This is implicit in the clamp-clearance check (Step 1, question 4) but could be explicit: "Is the hole located >20 mm away from the rotary axis?"

---

## Summary

The skills and documentation provided a complete foundation for planning thread-milling import and execution. The motion laws, frame doctrine, and tool surface reference (TOOLS.md) are precise and sufficient. The thread-milling.md guide is targeted and accurate. The main gaps are in the stand-in state (explicit head type, work-origin Z value) and in clarifying tool-validation behavior (does the converter reject or clamp out-of-range spindle speeds?). The plan adapted by asking the operator these missing pieces and offering both outcomes. No contradictions were found; the rules are consistent.
