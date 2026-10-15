# Agent skills for the Luban MCP CNC surface

The skills live here in `.agents/skills/`, where Codex and other AGENTS.md-aware agents look;
`.claude/skills` is a symlink to this directory so Claude Code loads the same files. A clone
without symlink support (Windows without Developer Mode, or `core.symlinks=false`) checks the link
out as a small text file, so point Claude Code at this directory by hand there.

Load order matters. **`cnc-motion-rules` is canonical and comes first**; the other skills assume
it and point back to it rather than repeating it.

| Skill | Load when | Holds |
|---|---|---|
| [`cnc-motion-rules`](cnc-motion-rules/SKILL.md) | Before ANY motion, position or coordinate reasoning | The eight motion laws, coordinate doctrine (machine coords; the frame handshake; the work origin is the operator's), `get_position.reliability` semantics, sanctioned exceptions, measurable WCS selection, rechecking and indexed setups (`references/work-datums.md`), retained-connection proofs and cutting-file release incl. `B` words (`references/cutting-programs.md`), vocabulary, recording rules |
| [`cnc-probing`](cnc-probing/SKILL.md) | Touch-probe measurement, surface scans, probe calibration | Measurement routing and local continuation (`references/planning.md`), stylus reach, contact photographs, shoulder recovery and measured timing; the stored rotary axis and its opposite-face check (`references/rotary-axis.md`); CAM links in `references/cam-probing.md` |
| [`cnc-visual-alignment`](cnc-visual-alignment/SKILL.md) | Camera frames → millimetres, visual servo, landmarks in frame | Continuous live viewing, synchronized inspection frames, metric calibration and frame-reading heuristics |
| [`cnc-camera-operations`](cnc-camera-operations/SKILL.md) | Live camera inspection, device selection, saved-frame access, bootstrap and camera survey orchestration | Compact operation/approval tables, composite camera schema, remote-client workflow and survey-to-datum handoff |
| [`tool-change`](tool-change/SKILL.md) | Swapping bits without re-touching the stock | Tool-setter flows A (MCP offset via `apply_tool_length_offset`) and B (touchscreen wizard) |
| [`cnc-thread-milling`](cnc-thread-milling/SKILL.md) | Internal/external thread-milling preparation, import and execution | Cutter geometry, bore/boss review, per-feature datums, offline conversion and approved file-job handoff |

For a plain transit or a Snapmaker-ready file, `cnc-motion-rules` alone is enough (§7–§8 carry the canonical calls).
A thread-milling controller export also needs `cnc-thread-milling` before submission.
See the [engineering guide](../../src/server/services/mcp/docs/thread-milling.md).

Before cutting geometry or a repeat survey, read
[measurement evidence](cnc-motion-rules/references/measurement-evidence.md): saved contacts
constrain the model, contradictions block release, and shared model assumptions do not make
an independent check. Reuse completed measurements; acquire only a demonstrated remaining gap.

Rules of the house that every skill shares:

- Operator law is never overridden on model judgment. A refusal from a tool is the rule catching you.
- Motion is authorised only by an explicit imperative in the operator's latest message, then by
  their click on the staged job's confirm page. Chat is not a gate.
- Every number states its frame (machine), whether it is toolhead Z or a physical height, the
  tool, the B angle and the date. Undated, unframed numbers are not numbers.
- The MCP source that enforces these rules is `src/server/services/mcp/` — `README.md` there is
  the engineering reference; `docs/TOOLS.md` the per-tool one.
