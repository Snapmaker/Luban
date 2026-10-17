import { strict as assert } from 'assert';
import { isolatedModule } from './jobDashboard.test';
import * as datum from '../toolDatum';
import * as limits from '../procedureLimits';
import * as protrusion from '../toolProtrusion';

const legacy = { centerX: 0, centerY: 0, triggerZ: 175.5, referenceBitLengthMm: 75,
    longestBitLengthMm: 75, floorMarginMm: 3, changeX: null, changeY: null, changeZ: null, notes: null };

function fixture(onMove?: () => void) {
    const store = new Map<string, unknown>([['mcpToolSetter', { ...legacy }]]);
    const config = { get: (key: string) => store.get(key), set: (key: string, value: unknown) => store.set(key, value),
        unset: (key: string) => store.delete(key) };
    const active = isolatedModule('activeTool.ts', { '../configstore': config });
    let effectiveLength: number | null = null;
    const state = isolatedModule('toolDatumState.ts', { '../configstore': config, './activeTool': active,
        './toolDatum': datum, './rotaryGeometry': { geometrySettings: () => ({ fields: { probe_effective_length: {
            value: effectiveLength, source: 'config', note: 'legacy evidence', setAt: 100,
        } } }) } });
    let z = 176;
    const sensed = () => ({ contact: z <= 175.5 + 1e-8, channel: 'probe', reading: { value: 'contact' } });
    const setter = isolatedModule('toolSetter.ts', {
        '../../lib/logger': () => ({ info: () => undefined, error: () => undefined }),
        '../configstore': config, './index': { mcpBroadcast: () => undefined },
        './traversePlan': { TRAVERSE_Z_TOLERANCE_MM: 0.05 }, './procedureLimits': limits,
        './registry': { McpToolError: Error }, './activeTool': active, './toolDatum': datum, './toolDatumState': state,
        './tools/machine': { getPositionSnapshot: () => ({ machine: { x: 0, y: 0, z } }), safeTraverseZ: () => 328 },
        './probeFeed': { probeFeedService: { setExpectedContact: () => undefined, clearExpectedContact: () => undefined } },
        './probing': { assertChannelReady: () => undefined, assertMachineReadyForProcedure: () => undefined,
            moveMachineSettled: async (_tag: string, words: { z?: number }) => { if (words.z !== undefined) z = words.z; onMove?.(); },
            senseAfter: async () => sensed(), senseReleaseAfter: async () => sensed(),
            raiseToTop: async () => ({ action: 'raised', z: 328, note: 'mocked' }),
            abortRaiseToTop: async () => undefined, isProcedureAbort: () => false,
        },
    });
    const clearance = isolatedModule('clearanceContext.ts', { './activeTool': active,
        './toolSetter': setter, './toolProtrusion': protrusion, './landmarkClearance': { CLEARANCE_MARGIN_MM: 5 } });
    const registryTools = new Map<string, any>(); // eslint-disable-line @typescript-eslint/no-explicit-any
    const toolModule = isolatedModule('tools/toolsetter.ts', {
        '../../machine/ConnectionManager': {}, '../activeTool': active, '../jobs': { jobManager: { get: () => null } },
        '../toolDatum': datum, '../toolDatumState': state, '../probeFeed': {}, '../registry': { McpToolError: Error },
        '../toolSetter': setter, '../procedureLimits': limits, './staging': {}, './machine': {},
    });
    toolModule.registerToolSetterTools({ register: (tool: { name: string }) => registryTools.set(tool.name, tool) }, () => 'unused');
    return { store, active, state, setter, clearance, tools: registryTools,
        setLegacyLength: (value: number | null) => { effectiveLength = value; },
        resetZ: () => { z = 176; } };
}

function measurement(id: string, datumSnapshot = datum.legacySetterDatum(175.5, 75)): datum.ToolMeasurement {
    return { id, jobId: id, toolIdentity: 'probe-A', fittingId: `fitting-${id}`, source: 'spindle_probe',
        measuredTriggerZ: 172, bitLengthMm: 75, spreadMm: 0.1, fineStepMm: 0.1, at: 100,
        datum: datumSnapshot, confirmPassContacts: [172, 172.1], contactChannels: ['probe', 'probe'] };
}

export const tests: Array<[string, () => void | Promise<void>]> = [
    ['setter arithmetic preserves named conventional basis and raw contacts', () => {
        const m = measurement('one');
        const calibration = datum.calibrationFromMeasurement(m);
        assert.equal(calibration.datum?.machineZ, 100.5);
        assert.equal(calibration.offsetMm, 71.5);
        assert.equal(calibration.uncertaintyMm, null);
        assert.equal(calibration.physicalReferenceVerified, false);
        assert.equal(datum.projectToolTipZ(200, calibration).tipMachineZ, 128.5);
        assert.equal(datum.projectToolTipZ(null, calibration).tipMachineZ, null);
        assert.equal(m.measuredTriggerZ, 172);
        assert.equal(datum.calibrationFromMeasurement({ ...m, bitLengthMm: 45 }).offsetMm, 71.5);
    }],
    ['physically measured datum includes uncertainty rather than equating spread with accuracy', () => {
        const calibration = datum.calibrationFromMeasurement(measurement('one', {
            id: 'measured-v1', name: 'Setter reference plane', machineZ: 100.5, basis: 'measured',
            source: 'independent reference measurement', uncertaintyMm: 0.2, at: 50,
        }));
        assert.equal(calibration.physicalReferenceVerified, true);
        assert.ok(Math.abs((calibration.uncertaintyMm as number) - 0.4) < 1e-9);
    }],
    ['history retains every fitting and snapshots after reference edits, with legacy unknowns intact', () => {
        const f = fixture();
        f.store.set('mcpToolSetter', { ...legacy, lastMeasurement: { measuredTriggerZ: 171, bitLengthMm: 70,
            derivedBitLengthMm: 70.5, spreadMm: 0, at: 1 } });
        const m = measurement('one');
        f.state.recordToolMeasurement(m);
        if (m.datum) m.datum.machineZ = 99;
        f.state.recordToolMeasurement(measurement('two'));
        f.state.recordToolMeasurement(measurement('three'));
        f.setter.setToolSetterConfig({ ...legacy, triggerZ: 175, referenceBitLengthMm: 45 });
        assert.equal(f.state.currentSetterDatum().machineZ, 100.5, 'reference edit freezes existing convention');
        const history = f.state.getToolMeasurements().history;
        assert.equal(history.length, 4);
        assert.equal(history[1].datum.machineZ, 100.5);
        assert.equal(history[0].referenceBasis, 'unknown');
        assert.equal(history[0].datum, null);
        assert.equal(history[0].setterDerivedOffsetMm, null);
        assert.equal(history[0].measuredTriggerZ, 171);
        assert.equal(history[0].derivedBitLengthMm, 70.5);
        assert.equal(f.state.getToolMeasurements().previous.id, 'two');
    }],
    ['legacy effective length has no invented trigger or current fitting claim', () => {
        const f = fixture();
        f.setLegacyLength(70.95);
        const c = f.state.getProbeTipCalibration();
        assert.equal(c.kind, 'legacy_effective_length');
        assert.equal(c.rawTriggerMachineZ, null);
        assert.equal(c.datum, null);
        assert.equal(c.applicability, 'unknown');
        assert.equal(c.uncertaintyMm, null);
        assert.equal(datum.projectToolTipZ(200, c).tipMachineZ, 129.05);
        assert.equal(datum.parseSetterDatum({ id: 'bad', name: 'bad', machineZ: null, source: 'x', basis: 'measured' }), null);
    }],
    ['only the current spindle-probe fitting supplies a measured probe projection', () => {
        const f = fixture();
        f.state.recordToolMeasurement(measurement('probe'));
        f.active.setActiveTool({ protrusionMm: 71.5, source: 'spindle_probe', measurementId: 'probe' });
        assert.equal(f.state.getProbeTipCalibration().measurementId, 'probe');
        f.state.recordToolMeasurement({ ...measurement('cutter'), source: 'tool_setter' });
        assert.equal(f.state.getProbeTipCalibration().measurementId, 'probe', 'latest arbitrary cutter must not win');
        f.active.invalidateActiveTool('swap');
        assert.equal(f.state.getProbeTipCalibration().kind, 'unavailable');
        f.active.setActiveTool({ protrusionMm: 45, source: 'tool_setter', measurementId: 'cutter' });
        assert.equal(f.state.getProbeTipCalibration().kind, 'unavailable');
    }],
    ['approximate approach reference run never changes datum or silently shortens clearance', async () => {
        const f = fixture();
        const plan = { config: f.setter.getToolSetterConfig(), bitLengthMm: 45, toolIdentity: 'probe-A', fittingId: 'seating-1',
            expectedTriggerZ: 175.5, startZ: 176, endZ: 328, floorZ: 174, coarseFloorZ: 176,
            coarseStepMm: 1, fineStepMm: 0.1, backoffMm: 0.3, sensorDelayMs: 10, confirmPasses: 2,
            storeAsReference: true, stayAtTrigger: false, startFromCurrent: true, acceptProbeContact: true };
        const result = await f.setter.runToolSetterProcedure(plan, 'job-one');
        assert.equal(result.measuredTriggerZ, 175.5);
        assert.equal(result.setterDerivedOffsetMm, 75);
        assert.equal(result.measurement.bitLengthMm, 45);
        assert.equal(result.measurement.contactChannels.join(','), 'probe,probe');
        assert.equal(f.setter.getToolSetterConfig().referenceBitLengthMm, 45);
        assert.equal(f.setter.getToolSetterConfig().datum.machineZ, 100.5);
        assert.equal(result.active_tool.clearanceBasis, 'unknown');
        assert.equal(f.clearance.currentToolProtrusion().mm, null);
        f.resetZ();
        const next = await f.setter.runToolSetterProcedure({ ...plan, config: f.setter.getToolSetterConfig(), storeAsReference: false }, 'job-two');
        assert.equal(next.setterDerivedOffsetMm, 75, 'subsequent measurement keeps same datum');
    }],
    ['physical clearance uses only current applicable bounds or configured allowable-tool maximum', async () => {
        const f = fixture();
        f.setLegacyLength(73);
        assert.equal(f.clearance.currentToolProtrusion().mm, null, 'legacy approach maximum and probe length do not prove toolhead bound');
        await f.tools.get('set_active_tool').handler({ source: 'operator', protrusion_mm: 45, protrusion_reference: 'collet' });
        assert.equal(f.clearance.currentToolProtrusion().mm, null);
        f.setter.setToolSetterConfig({ ...legacy, toolheadClearanceBound: { mm: 90, source: 'all allowable tools bounded from head reference' } });
        assert.equal(f.clearance.currentToolProtrusion().mm, 90);
        await f.tools.get('set_active_tool').handler({ source: 'operator', protrusion_mm: 85, protrusion_reference: 'toolhead' });
        assert.equal(f.clearance.currentToolProtrusion().mm, 85);
        f.active.invalidateActiveTool('new tool unknown');
        assert.equal(f.clearance.currentToolProtrusion().mm, 90, 'old short fitting cannot bound replacement');
        f.setter.setToolSetterConfig({ ...legacy, toolheadClearanceBound: null });
        assert.equal(f.clearance.currentToolProtrusion().mm, null);
    }],
    ['missing historic repeatability never becomes a verified zero-spread clearance calibration', () => {
        const f = fixture();
        const raw = { ...measurement('incomplete', { id: 'v1', name: 'Measured datum', machineZ: 100.5,
            basis: 'measured', source: 'independent measurement', uncertaintyMm: 0.2, at: 1 }), spreadMm: undefined };
        const parsed = f.state.parseToolMeasurement(raw);
        assert.equal(parsed.spreadMm, null);
        assert.equal(datum.calibrationFromMeasurement(parsed).physicalReferenceVerified, false);
        assert.equal(datum.calibrationFromMeasurement(parsed).uncertaintyMm, null);
    }],
    ['setter captures datum before motion even if configuration changes during the run', async () => {
        let changed = false;
        const f = fixture(() => {
            if (!changed) {
                changed = true;
                f.setter.setToolSetterConfig({ ...legacy, datum: { id: 'new', name: 'New datum', machineZ: 90,
                    basis: 'measured', source: 'new reference', uncertaintyMm: 0.1, at: 200 } });
            }
        });
        const result = await f.setter.runToolSetterProcedure({ config: f.setter.getToolSetterConfig(),
            bitLengthMm: 75, toolIdentity: 'probe-A', fittingId: 'one', expectedTriggerZ: 175.5, startZ: 176,
            endZ: 328, floorZ: 174, coarseFloorZ: 176, coarseStepMm: 1, fineStepMm: 0.1, backoffMm: 0.3,
            sensorDelayMs: 10, confirmPasses: 2, storeAsReference: true, stayAtTrigger: false,
            startFromCurrent: true, acceptProbeContact: true }, 'snapshot-job');
        assert.equal(f.state.currentSetterDatum().machineZ, 90);
        assert.equal(result.measurement.datum.machineZ, 100.5);
        assert.equal(result.setterDerivedOffsetMm, 75);
        assert.equal(result.active_tool.clearanceBasis, 'unknown');
    }],
    ['verified setter datum yields a current conservative bound and loses clearance authority on replacement', async () => {
        const f = fixture();
        f.setter.setToolSetterConfig({ ...legacy, datum: { id: 'measured', name: 'Setter plane', machineZ: 100.5,
            basis: 'measured', source: 'independent measurement', uncertaintyMm: 0.2, at: 1 } });
        const result = await f.setter.runToolSetterProcedure({ config: f.setter.getToolSetterConfig(),
            bitLengthMm: 75, toolIdentity: 'probe-A', fittingId: 'one', expectedTriggerZ: 175.5, startZ: 176,
            endZ: 328, floorZ: 174, coarseFloorZ: 176, coarseStepMm: 1, fineStepMm: 0.1, backoffMm: 0.3,
            sensorDelayMs: 10, confirmPasses: 2, storeAsReference: false, stayAtTrigger: false,
            startFromCurrent: true, acceptProbeContact: true }, 'verified-job');
        assert.equal(result.tipMachineZ, 100.5);
        assert.equal(result.active_tool.clearanceBasis, 'toolhead_reference');
        assert.equal(f.clearance.currentToolProtrusion().mm, 75.3);
        assert.equal(f.state.getProbeTipCalibration().measurementId, 'verified-job');
        f.active.invalidateActiveTool('replacement fitting unknown');
        assert.equal(f.clearance.currentToolProtrusion().mm, null);
        assert.equal(f.state.getProbeTipCalibration().kind, 'unavailable');
        assert.equal(f.state.getToolMeasurements().last.measuredTriggerZ, 175.5);
    }],
    ['configuration tool stores explicit datum provenance and rejects unbounded measured claims', async () => {
        const f = fixture();
        const args = { center_x: 0, center_y: 0, trigger_z: 175.5, reference_bit_length_mm: 75, longest_bit_length_mm: 75 };
        const explicit = { id: 'v1', name: 'Setter plane', machine_z: 100.5, basis: 'measured', source: 'independent metrology' };
        await assert.rejects(f.tools.get('set_tool_setter_config').handler({ ...args, setter_datum: explicit }), /uncertainty/);
        await f.tools.get('set_tool_setter_config').handler({ ...args, setter_datum: { ...explicit, uncertainty_mm: 0.2 } });
        assert.equal(f.state.currentSetterDatum().basis, 'measured');
        assert.equal(f.state.currentSetterDatum().source, 'independent metrology');
        const read = await f.tools.get('get_tool_setter_config').handler({});
        assert.equal(read.datum.id, 'v1');
        assert.ok(Array.isArray(read.measurements.history));
    }],
];
