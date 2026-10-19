# Offline thread-milling import

Use `convert_thread_milling_gcode` for the complete Machining Doctor export,
including its setup and terminating M2/M30. No connection or live machine call is
needed to convert. The source remains unchanged; the result is a separate program.

## Required declarations and spindle choice

| Argument | Meaning |
| --- | --- |
| `gcode` | Complete source text, not a filesystem path. |
| `source_controller` | The generator's selected dialect; default `fanuc`. See below. |
| `tool_center_path: true` | Path already offset for the cutter radius and D compensation is zero. D1 selects register 1, not a 1 mm correction. Nonzero radius/wear compensation is unsupported. |
| `tool_length_applied: true` | The work origin already references the fitted tool tip. Removing G43/H does not calibrate the tool or set the origin. |
| `spindle_mode: "cnc_200w_rpm"` | Retain source S RPM for the 200 W head; accepts 8000–18000 RPM. Omit `spindle_power_percent`. |
| `spindle_mode: "power_percent"` | Replace source RPM with explicit P percentage; requires integer `spindle_power_percent` from 1 to 100. Use this for the standard CNC head. It is not an RPM calibration. |
| `chord_tolerance_mm` | Optional, default 0.002 mm, allowed 0.00001–0.01 mm. This remains mm even for an inch source. |

Example call shape for a verified 200 W setup (the placeholder must be replaced
by the entire source program; spindle speed and feeds come from that program):

```json
{
  "gcode": "<complete generator output>",
  "source_controller": "fanuc",
  "tool_center_path": true,
  "tool_length_applied": true,
  "spindle_mode": "cnc_200w_rpm",
  "chord_tolerance_mm": 0.002
}
```

The same call handles internal and external threads. For the standard head,
select `power_percent` and supply the operator's chosen power. **Feeds are retained
(inch feeds converted to mm/min), never rescaled for a different spindle setting.**
An RPM refusal calls for revisiting the cutting conditions, not silently clamping
RPM or switching to percentage mode to bypass the limit.

## Controller selection and transformations

Accepted `source_controller` values: `fanuc`, `okuma`, `mazak`, `haas`, `siemens_c`,
`siemens_d`, `mitsubishi`, `mori_seiki`. These are observed generator dialects,
not general-purpose controller emulators. Use the actual selection rather than
trying dialects until one parses. The captured page duplicates the Siemens C-Type
label; dropdown value `sd` produces D-Type. Mori Seiki may have a blank name comment.

- Okuma: standalone G15 H1 maps to G54; G56/H length lookup is removed under the
  fitted-tool declaration.
- Mazak: initial T0 preselection is removed.
- Siemens: H on G0 is removed but the positioning move remains.
- G40/G41/G42 and D selectors are removed under the zero-compensation declaration;
  G43/H removal preserves inherited motion, including initial Z positioning.
- One initial tool change is removed because the tool must already be fitted;
  M7/M8/M9 coolant commands are removed and reported.
- G2/G3 become explicit absolute G1 segments, including full helices and repeated
  turns; G20/G21 source units become mm. Output uses G21/G90/G54 and ends with
  explicit M5/G90 instead of relying on source M2/M30 semantics. Because the output
  selects only G54, its confirm page shows machine Z resolved for G54, and
  `start_gcode_job` verifies G54's offset before streaming (see the skill).

The generator's centre/peripheral toggle did not change the inspected D=0 export.
It is not evidence of applied compensation. Inspect the settings/source and the
declarations instead. Known nonzero-compensation headers are rejected.

## Refusals and review limits

Non-XY planes, R-format or absolute-centre arcs, G93/G95, M4, macros/subroutines,
canned cycles, rotary axes, other workspaces/origin writes and mid-program tool
changes are unsupported. Units/distance mode/G17/G94 must be explicit; arc I/J
centres are incremental. Unit changes after feed or motion are refused. Regenerate
a supported export instead of deleting rejected blocks and hoping it is equivalent.

For inconsistent arc endpoints, increase generator output precision and reconvert.
Small source radius mismatches are reported and blended to preserve endpoints;
large mismatches are refused. Input is capped at 2 MB and output at 200000 moves;
do not loosen chord tolerance just to fit without reviewing the accuracy tradeoff.

Review `warnings` as well as `validation.warnings` and `changes`. Bounds refer to
the emitted tool-centre polygon and exclude the unknown initial machine position.
No collision model, stock removal model, thread gauge result or cutting acceptance
is implied by validation. Test fixtures are software evidence, not cutting recipes.

In a Luban checkout, `src/server/services/mcp/docs/thread-milling.md` contains the
option coverage and pinned firmware evidence; `tools/threadMilling.ts` under the
same MCP directory defines the tool schema.
