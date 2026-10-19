# Critique (eval-4: two external bosses, Okuma, standard head)

## What helped
- `cnc-thread-milling/SKILL.md`, "Choose the feature review": the internal/external table made it clear that the checks are boss diameter, shoulder, and holder clearance all round, and that an internal plan must not be reused.
- `references/import.md`, "Required declarations" and "Controller selection": these gave the standard head's `power_percent` + integer percent, no feed rescaling, and the Okuma mappings (G15 H1 to G54, G56/H removed, D1 is a register).
- `references/setup.md`, "Multiple holes or bosses": one program per feature with its own XY datum in the common frame, no concatenation, Z20 is not inter-feature transport, and the approval-count convention.
- `references/setup.md` and `docs/thread-milling.md`, head identity: a null `toolHead` plus `headType: cnc` does not settle the head, and I must ask only if the value is null/ambiguous *or* disagrees with the operator.
- `cnc-motion-rules` §7/§8: the file-job sequence, link-first handoff, background `start_gcode_job`, and "stop has no retract".

## Missing, unclear or contradictory
- **Machine-resolved Z extents vs an explicit G54.** These disagree:
  - `cnc-thread-milling/SKILL.md` ("Stage only…") and motion-rules §7 step 4 say to read the operator the confirm page's machine-resolved Z extents.
  - `docs/workspaces.md` ("File review") and `work-datums.md` (last paragraph) say that a file naming a workspace, even a single explicit G54, leaves machine extents unresolved.
  - The converter always emits G54.

  So for every converted thread program the instruction may be impossible to follow. Neither doc says what to read out instead. I planned to state "unresolved" and give the reviewed work-frame extents.
- **How to verify that G54 is the live workspace.** The heartbeat has no workspace identifier (`workspaces.md`). The docs say "verify the live origin is the intended G54" but name no read-only way to do it. Only the human-gated `select_workspace` (an extra approval) or `restore_work_frame` (a no-motion G54 select, documented as a frame-fault cure) would guarantee it. It is unclear whether `restore_work_frame` is acceptable as routine hygiene. I left `select_workspace` as an uncounted conditional branch.
- **Landmark check of the file's initial XY move.** The skill says the initial XY segment "must already satisfy the motion floor and landmark checks". It does not say whether `submit_gcode_job` checks landmarks on file jobs, or how the agent gets the machine XY of the boss without converting coordinates by hand (which is forbidden). I relied on the head being at Z328 and read `requiredToolheadZ`. If a requirement exceeded the current Z, the fix (a work-frame `traverse_xy` pre-position, or a raise) is undocumented for this case.
- **tool_length_applied from operator testimony.** The docs say `originOffset` cannot prove which tool set Z0 and point to the tool-change flow "or operator re-reference". It is not explicit whether the operator's chat statement that "work Z was set with it" is enough evidence to declare the flag. I treated it as sufficient once confirmed alongside "nothing changed since".
- **Datum recheck with the cutter fitted.** `work-datums.md` wants an independent reference check "while the probe is still fitted". Here the probe is already out. The docs do not say what counts as acceptable datum evidence after the fact (an operator record?) or whether readiness is blocked without it.
- **Okuma G41 D1.** The Okuma fixture carries `G41 D1`. The docs say known nonzero-compensation headers are refused and that the generator's export is D=0. I verify this from the export header rather than asking. A sentence saying "for Okuma, look for X in the header" would help.

## What I had to guess
- The export texts are not in chat. I assumed "we have two complete exports" means I must ask for them to be pasted.
- Which surface is work Z0, the boss dimensions, the shoulder and the clamp layout. I asked for all of these in one message.
- That firmware completion leaves the head at or above the floor. I planned it as a conditional raise, not an assumption.
- That boss 2 should be staged only after job 1 completes, rather than both staged up front.
