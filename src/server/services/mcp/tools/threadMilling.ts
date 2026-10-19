/* eslint-disable camelcase */
import { McpToolError, ToolRegistry } from '../registry';
import { convertThreadMillingGcode, THREAD_MILLING_CONTROLLERS, ThreadMillingController } from '../threadMilling';

interface ConvertArgs {
    gcode: string;
    source_controller?: ThreadMillingController;
    tool_center_path: boolean;
    tool_length_applied: boolean;
    spindle_mode: 'power_percent' | 'cnc_200w_rpm';
    spindle_power_percent?: number;
    chord_tolerance_mm?: number;
}

export function registerThreadMillingTools(registry: ToolRegistry): void {
    registry.register({
        name: 'convert_thread_milling_gcode',
        description: 'Offline conversion of Machining Doctor thread-milling G-code to explicit Snapmaker G0/G1 moves. '
            + 'Supports G2/G3 helices, full circles, G90/G91, metric/inch input, repeated turns and passes. '
            + 'Requires a zero-compensation tool-centre path and work Z already referenced to the fitted tool tip. '
            + 'Select power_percent for the standard CNC head, or cnc_200w_rpm to retain RPM for the 200 W head. '
            + 'Returns a reviewable program, changes, warnings and validation; does not stage or run it. '
            + 'Review the result before submit_gcode_job with head_type cnc and frame work.',
        inputSchema: {
            type: 'object',
            properties: {
                gcode: { type: 'string', description: 'Complete generator output, including M30/M2.' },
                source_controller: { type: 'string', enum: THREAD_MILLING_CONTROLLERS, description: 'Generator controller selection. Default fanuc. Explicit selection is required for Okuma, Mazak and Siemens setup syntax.' },
                tool_center_path: { type: 'boolean', const: true, description: 'Explicit declaration: tool-centre path with zero D compensation. D1 is a register number.' },
                tool_length_applied: { type: 'boolean', const: true, description: 'Explicit declaration: fitted tool tip is already accounted for in work Z. G43/H is removed, its motion retained.' },
                spindle_mode: { type: 'string', enum: ['power_percent', 'cnc_200w_rpm'] },
                spindle_power_percent: { type: 'integer', minimum: 1, maximum: 100, description: 'Required only for power_percent. No RPM mapping or feed rescaling is inferred.' },
                chord_tolerance_mm: { type: 'number', minimum: 0.00001, maximum: 0.01, description: 'Arc chord tolerance in mm; default 0.002. Source radius rounding is reported separately.' },
            },
            required: ['gcode', 'tool_center_path', 'tool_length_applied', 'spindle_mode'],
            additionalProperties: false,
        },
        handler: async (input: object) => {
            const args = input as ConvertArgs;
            try {
                return convertThreadMillingGcode(args.gcode, {
                    sourceController: args.source_controller,
                    toolCenterPath: args.tool_center_path,
                    toolLengthApplied: args.tool_length_applied,
                    spindleMode: args.spindle_mode,
                    spindlePowerPercent: args.spindle_power_percent,
                    chordToleranceMm: args.chord_tolerance_mm,
                });
            } catch (err) {
                throw new McpToolError((err as Error).message);
            }
        },
    });
}
