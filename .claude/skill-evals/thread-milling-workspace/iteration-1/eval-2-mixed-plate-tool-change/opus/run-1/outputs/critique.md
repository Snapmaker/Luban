# Critique: skills and docs for the mixed-plate thread-milling task

## What helped

- **docs/thread-milling.md "Usage" and the declarations section.** Clear on `tool_center_path` and `tool_length_applied`, on the two spindle modes and the 8000-18000 RPM refusal, and on submitting with `head_type: "cnc"` and `frame: "work"`.
- **The generator-coverage table.** It told me the converter can't do multiple holes. It gave me three refusals: "One initial M6 Tn removed... Mid-program tool changes rejected", "workspace changes and origin writes" refused, and "M2/M30 must terminate". It also said nonzero XYZ datum is supported. Together those give one program per hole, made with the generator's datum.
- **The fixture header (`CUTTER DIAM=1.38, L=2.25 [MULTI TOOTH]`).** Read against the operator's "1.38mm neck ... triple row", it gave away the two geometry errors. The doc's line "A three-flute cutter can still have a single axial thread form" (don't infer rows from flutes) pointed the same way.
- **README "Machine facts".** "Returns to Z top at the job's finish position when a file job COMPLETES" is what makes per-hole jobs lawful under law 2. "SETTER fires first" when measuring the probe is what exposed the pretravel gap.
- **tool-change "The sequence" step 1 skip rule, and "Two flows".** These let me drop one approval in change 2 and fold the flow question into the single batch.
- **cnc-motion-rules §0 item 7 (ask once) and §7 (running a generated program).** These shaped the turn structure.

## Missing, unclear or contradictory for this task

1. **There is no multi-hole guidance anywhere.** thread-milling.md never says "one program per hole". I had to deduce it from three separate refusals. There is also no batch file-job submission, so 6 holes cost 6 clicks. The doc doesn't say whether joining several *converted* outputs into one job is acceptable. Such a job would travel between holes at the generator's retract (work Z20), below the Z320 floor. I treated it as forbidden by law 2, but that is a guess: §7 treats generated programs as normal, while law 2 says "ALL of them".
2. **Cutter geometry vocabulary is missing.** The doc doesn't say what the generator's "cutter diameter" and "L" mean physically (tooth OD across crests, and axial toothed length or rows x pitch). It doesn't warn that product names quote the neck diameter. It doesn't say that step per pass = L, which I worked out from the fixture: 0.056 + 0.45 + 0.056 + 1.688 = 2.25. So a wrong L silently leaves unthreaded bands. For triple-row at 0.45 pitch, whether to use L = 1.35 or 0.9 is my guess.
3. **The standard-head RPM is unknown.** For `power_percent`, the doc says only that RPM is replaced and feeds are not rescaled. It doesn't give the standard head's rated speed, so I can't give the operator a number for the generator's max RPM. I left it to them.
4. **It's unclear whether `get_machine_profile` reports the head type.** TOOLS.md says it returns "kinematics, work envelope, toolhead module offsets", with no mention of standard vs 200 W. I assumed it does. If not, the head type becomes a question for the operator.
5. **Nothing covers the probe as the "old tool" in flow A.** tool-change.md never mentions `accept_probe_contact` for measuring an outgoing touch probe. I took it from cnc-probing "Probe calibration" and README. No doc says the probe's own pretravel (work Z0 was set by the probe's trigger, not the setter's) is left out of the delta.
6. **Authority for multi-step procedures conflicts.** Law 1 says "a plan they approved — is context, not a command". The resolution text says a request naming a procedure authorises staging it. tool-change says flow A is "four approvals ... each announced". I read "go" plus each confirm page as enough to stage each step in turn. A stricter reading doubles the operator's messages.
7. **The background-wait mechanics conflict.** §0 item 6 and law 6 say: end the turn with the URL, then run `start_gcode_job` as a background poll. But once the turn has ended, the agent can't make the call until the operator speaks again. So in practice every approval costs a click plus a chat reply or a pasted code. That per-step cost isn't stated.
8. **File jobs vs landmarks and the unknown start position.** thread-milling.md says validation "exclude[s] the unknown initial position". No doc says whether `submit_gcode_job` checks a file's first XY rapid against landmarks. I added my own check (rotary `requiredToolheadZ` <= 328).
9. **Work-to-machine XY quoting.** Doctrine says quote machine coordinates. For a file job, only the machine-resolved Z extents are stated to appear on the confirm page. I couldn't tell whether the XY extents are resolved too, so the hole positions are quoted in work coordinates plus `originOffset`.
10. **`probe_program` has no circle op** (TOOLS.md and cnc-probing list the op kinds). So verifying six hole centres before the swap would be six `probe_circle` approvals. Also, no doc states the probe tip diameter, which would tell me whether it fits a 2.05 mm hole. I didn't plan hole probing; I asked instead whether the holes were drilled in this setup.

## What I had to guess

- The M2.5 tooth OD (about 1.9, illustrative only). The operator must measure it.
- L for triple-row (1.35 vs 0.9).
- That the generator's XYZ datum puts the program at the hole XY.
- That `get_machine_profile` exposes the head type.
- That per-step staging under a single "go" is lawful.
- That no clamp is in a hole column, and what is under the plate. Both are asked.
