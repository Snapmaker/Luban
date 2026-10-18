// Capability gates on the CNC procedures (procedureGates.ts, #265 WP4b):
// refuse rather than translate. Pure: each gate is judged on a capability
// derived from the machine definition, so no heartbeat or connection is
// needed; the registry hook is checked with a fake tool.
import { strict as assert } from 'assert';
import fs from 'fs';
import path from 'path';

import { CapabilityKey, MachineCapability, deriveMachineCapability } from '../machineCapability';
import { PENDANT_GATE, PROCEDURE_GATES, gateNeeds, gateRefusal, gcodeTurnsB, procedureRefusal, programTurnsB } from '../procedureGates';
import { McpToolError, ToolRegistry } from '../registry';

// The eight Luban machine definitions (identifier, type, size, toolheads),
// copied from src/app/machines/*.ts as tests/gcodeDialect.test.ts does (the
// real modules import ESM that does not load under the test runner).
const SM2_HEADS = [
    'singleExtruderToolheadForSM2', 'dualExtruderToolheadForSM2', 'levelOneLaserToolheadForSM2', 'levelTwoLaserToolheadForSM2',
    '20W Laser Module', '40W Laser Module', '2W Laser Module', 'standardCNCToolheadForSM2', 'levelTwoCNCToolheadForSM2',
];
const ORIGINAL_HEADS = ['singleExtruderToolheadForOriginal', 'levelOneLaserToolheadForOriginal', 'levelTwoLaserToolheadForOriginal', 'standardCNCToolheadForOriginal'];
function machine(identifier: string, machineType: string, size: [number, number, number], heads: string[]): MachineCapability {
    const metadata = { size: { x: size[0], y: size[1], z: size[2] }, toolHeads: heads.map((id) => ({ identifier: id })) };
    return deriveMachineCapability({ identifier, machineType, metadata });
}
const MACHINES: { [key: string]: MachineCapability } = {
    original: machine('Original', 'Multi-function 3D Printer', [125, 125, 125], ORIGINAL_HEADS),
    originalLongZ: machine('Original Long Z-axis', 'Multi-function 3D Printer', [125, 125, 221], ORIGINAL_HEADS),
    a150: machine('Snapmaker 2.0 A150', 'Multi-function 3D Printer', [160, 160, 140], SM2_HEADS),
    a250: machine('Snapmaker 2.0 A250', 'Multi-function 3D Printer', [230, 250, 230], SM2_HEADS),
    a350: machine('Snapmaker 2.0 A350', 'Multi-function 3D Printer', [320, 350, 325], SM2_HEADS),
    artisan: machine('A400', 'Multi-function 3D Printer', [400, 400, 400], [
        'dualExtruderToolheadForSM2', 'dualExtruderToolheadForArtisan', 'levelTwoLaserToolheadForSM2',
        '20W Laser Module', '40W Laser Module', '2W Laser Module', 'levelTwoCNCToolheadForSM2',
    ]),
    j1: machine('Snapmaker J1', '3D Printer', [324, 200, 200], ['Snapmaker J1 IDEX Tool Head']),
    ray: machine('Ray', 'Laser', [600, 400, 0], ['20W Laser Module', '40W Laser Module', '2W Laser Module']),
};
const REFUSED = ['ray', 'original', 'originalLongZ', 'j1'];
const PASSING = ['a150', 'a250', 'a350'];
const NONE = deriveMachineCapability(null, null);
const UNLISTED = deriveMachineCapability(null, 'Some Other Printer');

const TOOLS = Object.keys(PROCEDURE_GATES);
// Arguments that add every arg-dependent need (rotate_b ops, B words).
const ROTARY_ARGS: { [tool: string]: { [key: string]: unknown } } = {
    probe_program: { ops: [{ id: 'r', kind: 'rotate_b', b: 90 }] },
    run_probing_gcode: { gcode: 'G90\nG0 B90\nG38.2 Z-5 F100\nM30' },
};

export const tests: Array<[string, () => void | Promise<void>]> = [
    ['every gate passes on the A350 (and the A150/A250 on the same 2.0 row), with and without rotary arguments', () => {
        for (const key of PASSING) {
            for (const tool of TOOLS) {
                assert.equal(procedureRefusal(MACHINES[key], tool), null, `${key} ${tool}`);
                assert.equal(procedureRefusal(MACHINES[key], tool, ROTARY_ARGS[tool] || {}), null, `${key} ${tool} rotary`);
            }
            assert.equal(gateRefusal(MACHINES[key], PENDANT_GATE), null, `${key} pendant`);
        }
    }],
    ['the Ray, the Original (both Z lengths) and the J1 are refused by every gate, naming the machine and its dialect', () => {
        for (const key of REFUSED) {
            const capability = MACHINES[key];
            for (const tool of TOOLS) {
                const refusal = procedureRefusal(capability, tool);
                assert.ok(refusal, `${key} ${tool} passed`);
                assert.ok(refusal.startsWith(tool), `${key} ${tool}: the refusal opens with the tool: ${refusal}`);
                assert.ok(refusal.includes(`connected machine: ${capability.identifier}`), `${key} ${tool} names the machine`);
                assert.ok(refusal.includes(capability.dialect.label), `${key} ${tool} names the dialect`);
                assert.match(refusal, /This refusal is deliberate: .* refuses rather than translates/);
                assert.match(refusal, /Nothing was sent to the machine\.$/);
                // Never a workaround that would move the machine.
                assert.doesNotMatch(refusal, /move_z|traverse_xy|jog|instead|try /i, `${key} ${tool}`);
            }
            const pendant = gateRefusal(capability, PENDANT_GATE);
            assert.ok(pendant && pendant.startsWith('The USB pendant') && pendant.includes(`connected machine: ${capability.identifier}`), key);
        }
    }],
    ['every machine follows its WP1 supports row: refused exactly when one of the gate\'s needs is false (Artisan passes)', () => {
        for (const [key, capability] of Object.entries(MACHINES)) {
            for (const tool of TOOLS) {
                for (const args of [{}, ROTARY_ARGS[tool] || {}]) {
                    const needs = gateNeeds(PROCEDURE_GATES[tool], args);
                    const expected = needs.every((need) => capability.supports[need]);
                    assert.equal(procedureRefusal(capability, tool, args) === null, expected, `${key} ${tool} ${JSON.stringify(args)}`);
                }
            }
            assert.equal(gateRefusal(capability, PENDANT_GATE) === null, capability.supports.workspaces, `${key} pendant`);
        }
        for (const tool of TOOLS) {
            assert.equal(procedureRefusal(MACHINES.artisan, tool, ROTARY_ARGS[tool] || {}), null, `artisan ${tool}`);
        }
    }],
    ['the Ray is refused for its missing Z first; the Original for its missing G53/G54 workspaces', () => {
        for (const tool of ['run_tool_setter', 'probe_point', 'survey_bed', 'camera_bootstrap']) {
            assert.match(procedureRefusal(MACHINES.ray, tool) || '', /the machine has no Z axis/, tool);
            assert.match(procedureRefusal(MACHINES.original, tool) || '', /reference documents no G53\/G54 workspaces/, tool);
        }
        assert.match(procedureRefusal(MACHINES.ray, 'set_workspace_origin') || '', /takes G53 only as a same-line prefix/);
        assert.match(procedureRefusal(MACHINES.original, 'set_workspace_origin') || '', /Snapmaker Original \(Marlin 1\.x, unverified\)/);
        assert.match(procedureRefusal(MACHINES.j1, 'probe_point') || '', /Snapmaker J1 .* no spindle words/);
        assert.match(procedureRefusal(MACHINES.ray, 'probe_point') || '',
            /runs it only on the Snapmaker 2\.0 \(Marlin 2\.0\.x\) and Snapmaker Artisan \(Marlin 2\.0\.x\) rows/);
    }],
    ['nothing connected or an unlisted machine is refused; the offline conversion and setter record need no connection', () => {
        for (const tool of TOOLS.filter((name) => !PROCEDURE_GATES[name].offline)) {
            assert.match(procedureRefusal(NONE, tool) || '', /no machine is connected .* Nothing was sent\.$/, tool);
        }
        assert.match(gateRefusal(NONE, PENDANT_GATE) || '', /no machine is connected/);
        assert.equal(procedureRefusal(NONE, 'convert_thread_milling_gcode'), null);
        assert.equal(procedureRefusal(NONE, 'set_tool_setter_config'), null);
        for (const tool of TOOLS) {
            assert.match(procedureRefusal(UNLISTED, tool) || '', /Some Other Printer is not in this MCP's G-code dialect table/, tool);
        }
        assert.match(procedureRefusal(MACHINES.ray, 'convert_thread_milling_gcode') || '', /needs spindle control, .* on Ray/);
        assert.match(procedureRefusal(MACHINES.ray, 'set_tool_setter_config') || '', /needs the tool setter, .* on Ray/);
    }],
    ['a rotate_b op, a group, or a B word adds the rotary need', () => {
        assert.equal(programTurnsB([{ kind: 'sequence' }]), false);
        assert.equal(programTurnsB([{ kind: 'capture' }, { kind: 'rotate_b', b: 90 }]), true);
        assert.equal(programTurnsB([{ kind: 'group', for_b: [0, 90], ops: [] }]), true);
        assert.equal(programTurnsB('not an array'), false);
        assert.equal(gcodeTurnsB('G0 B90'), true);
        assert.equal(gcodeTurnsB('G0B-45.5'), true);
        assert.equal(gcodeTurnsB('G1 X1 Y2 F100 (B90 later)'), false);
        assert.equal(gcodeTurnsB('G1 X1 ; B90'), false);
        assert.equal(gcodeTurnsB(undefined), false);
        assert.deepEqual(gateNeeds(PROCEDURE_GATES.probe_program, ROTARY_ARGS.probe_program), ['probing', 'rotary'] as CapabilityKey[]);
        assert.deepEqual(gateNeeds(PROCEDURE_GATES.run_probing_gcode, { gcode: 'G38.2 Z-5 F100' }), ['probing'] as CapabilityKey[]);
    }],
    ['read-only, store-only and generic-motion tools are not gated here', () => {
        for (const tool of ['get_position', 'get_tool_setter_config', 'set_active_tool', 'move_z', 'traverse_xy', 'home',
            'restore_work_frame', 'goto_work_origin', 'move_and_capture', 'visual_servo', 'track_feature', 'measure_rotary_angle',
            'calibrate_rotary_accelerometer', 'submit_gcode_job', 'validate_gcode', 'set_landmark', 'set_probe_geometry']) {
            assert.equal(procedureRefusal(MACHINES.ray, tool), null, tool);
        }
    }],
    ['every gated name is a tool the MCP registers (a typo would leave a tool silently ungated)', () => {
        const toolsDir = path.join(__dirname, '../tools');
        const sources = fs.readdirSync(toolsDir).filter((file) => file.endsWith('.ts'))
            .map((file) => fs.readFileSync(path.join(toolsDir, file), 'utf8'))
            .concat(fs.readFileSync(path.join(__dirname, '../cameraProgram.ts'), 'utf8'))
            .join('\n');
        for (const tool of TOOLS) {
            assert.ok(sources.includes(`name: '${tool}'`) || sources.includes(`'${tool}' : `) || sources.includes(`: '${tool}';`), tool);
        }
    }],
    ['the registry gate refuses before the handler runs or the ownership gate is taken; other tools run as before', async () => {
        const registry = new ToolRegistry();
        const ran: string[] = [];
        for (const name of ['probe_point', 'get_position']) {
            registry.register({ name, description: name, inputSchema: { type: 'object' }, handler: async () => { ran.push(name); return { ok: true }; } });
        }
        const seen: Array<[string, object]> = [];
        registry.setProcedureGate((name, args) => {
            seen.push([name, args]);
            const refusal = procedureRefusal(MACHINES.ray, name, args as { [key: string]: unknown });
            if (refusal) {
                throw new McpToolError(refusal);
            }
        });
        await assert.rejects(registry.call('probe_point', { x: 1 }), (err: Error) => err instanceof McpToolError && /on Ray/.test(err.message));
        assert.deepEqual(ran, []);
        assert.deepEqual(await registry.call('get_position', {}), { ok: true });
        assert.deepEqual(ran, ['get_position']);
        assert.deepEqual(seen, [['probe_point', { x: 1 }], ['get_position', {}]]);
        registry.setProcedureGate(null);
        assert.deepEqual(await registry.call('probe_point', {}), { ok: true }, 'no gate injected = every tool runs as before');
    }],
];
