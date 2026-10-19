# Critique: eval-2 mixed plate, tool change (opus run 1)

## Helped
- **cnc-thread-milling/references/setup.md, "The supplied M2.5 fixture is regression evidence".** It named every fixture trap:
  - neck vs OD (2 x 0.575 + 1.38 = 2.53)
  - the 2.25 vs ~1.35 axial step
  - deepest Z-5.056 and through-hole clearance
  - XY before Z
- **setup.md, "Multiple holes or bosses".** It settled one export per hole with the hole centre as datum, no concatenation, and the 14 / 13 approval arithmetic including the reuse condition.
- **setup.md "Keep the dimensions separate", and docs/thread-milling.md "Setup and path review".** They decoded `M4x0.7xD4x50L` (D4 = shank, 50L = overall). That made it obvious a 4 mm shank cannot enter the bore, so reach is the deciding unknown.
- **tool-change/SKILL.md, flow A step 1.** Its explicit ban on setter surface + stored probe length, and `accept_probe_contact` for an outgoing probe.
- **cnc-motion-rules §0 item 7 (ask once) and §7 (preflight batch).** They shaped the single question message.

## Missing / unclear / contradictory
- **Contradiction: G54 and resolved extents.**
  - cnc-thread-milling SKILL.md "Stage only when…" says to read the confirm page's "machine-resolved Z extents", and says the converter emits G54.
  - docs/workspaces.md "File review" and work-datums.md say a single explicit G54 leaves extents **unresolved**.
  - One of them is wrong for converted files, or the converter's G54 is special-cased. It is not stated which, and I planned for both.
- **Same-tool reuse timing (tool-change "The sequence" step 1, setup.md).** "The operator confirms nothing has moved" doesn't say *when* the operator can give that for a tool that has since cut four holes. Asking up front is premature, and asking after hole 4 is an extra interruption. I folded it into a conditional standing answer plus the park page. That is a guess at what counts as confirmation.
- **Choosing a multi-row vs single-row cutter (setup.md, cutter paragraph).** It gives only qualitative guidance. There is nothing on the A350's rigidity or deflection, so "single-row makes more sense" rests on general reasoning.
- **No guidance on independent XY or rotation checks for a plate-corner origin with small tapped holes.** work-datums.md is written around rotary/B stock. `probe_program` has no circle op kind (TOOLS.md), so a bore-centre check costs one approval per hole. I made it optional.
- **How much the file-job completion raises (thread-milling.md "Multiple features and completion").** It says Z "raises at the finish XY" but not to where. That makes a conditional `move_z` between holes unavoidable to plan for.
- **Which approval counts as an "operator wait" in the Counts line.** It is unclear whether regenerating exports counts as a wait in its own right. I merged it into the answers wait.
- **`run_tool_setter bit_length_mm` for the probe.** I used 70, from the motion-rules §8 example, against the stored 71.3. The only guidance is the example and "declare low". There is no rule for how low.

## Guessed
- M2.5 and M4 tap-drill sizes (~2.05 / ~3.3 mm) and a ~2 mm probe tip. These were used only to flag the question, not in any call.
- About 4 axial positions for M2.5, from 5 / 1.35. This is only a consistency check, pending the manufacturer's effective length.
- Doing the M2.5 holes first, in the operator's listed order. Doing the M4 holes first would give the same count.
