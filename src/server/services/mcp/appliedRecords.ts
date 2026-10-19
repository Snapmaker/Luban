/* eslint-disable camelcase */
// Result fields are MCP tool results, snake_case by convention.
// Agent visibility (tyeth/Luban#265 WP8, plan 2.8): which machine the MCP is
// driving and WHICH stored records it is applying to it - stated travel or the
// model's, the Z policy, the landmarks and their review, the tool setter, the
// geometry, the fitted tool, the camera and the motion rules - in every
// motion / staging result and in the read-only status tools, so an agent never
// has to infer that an A350 record is (or is not) being applied to the Ray.
//
// Two halves: buildAppliedRecords() is pure (facts in, compact report out,
// unit-tested in tests/appliedRecords.test.ts); describeAppliedRecords()
// gathers the live facts, each one read defensively - a status read never
// throws, an unreadable record is reported as such.
import { getActiveTool } from './activeTool';
import { connectedMachineCapability } from './connectedMachine';
import { landmarkStore } from './landmarks';
import { landmarkReviewForConnected } from './landmarkReviewState';
import { machineStore } from './machineStore';
import { probeGeometry, rotaryGeometry, statedTravel } from './rotaryGeometry';
import { getToolSetterConfig } from './toolSetter';
import { computedHeightRuleFor, motionGcodeForm, travelFudge, traverseWithoutApprovalPolicy, zPolicyFor } from './tools/machine';

export interface AppliedRecordFacts {
    machine: {
        identifier: string | null;
        type: string | null;
        hasZ: boolean;
        dialect: string;
        verifiedOnHardware: boolean;
        gcodeForm: string | null;
        deviceId: string | null;
        machineKey: string | null;
        /** 'connected' | 'selected' (Luban's selected machine while nothing is connected) | null. */
        basis: string | null;
        deviceConflict: string | null;
    };
    /** Stated travel ends for this machine (field names), and the fudge applied to the model box. */
    travel: { stated: string[]; fudge: { x: number; y: number; source: string } | null } | null;
    zPolicy: {
        applies: boolean;
        safeTraverseZ: { value: number | null; source: string };
        motionFloorZ: { value: number | null; source: string };
        missing: string[];
    } | null;
    landmarks: string[] | null;
    landmarkReview: { status: string; confirmed: boolean } | null;
    toolSetter: { centerX: number; centerY: number; triggerZ: number } | null;
    probeGeometry: { effectiveLength: number; tipDiameter: number | null } | null;
    rotaryGeometry: {
        axisX: number;
        axisZ: number;
        skew: string;
        chuckFaceY: number | null;
        tailstockY: number | null;
        chuckTopZ: number | null;
        tailstockTopZ: number | null;
    } | null;
    activeTool: { protrusionMm: number; clearanceBasis: string; status: string; toolIdentity: string | null } | null;
    camera: { device: string | null; url: string | null } | null;
    motionRules: {
        topZWithoutApproval: { on: boolean; gatedBy: string | null };
        computedHeight: { on: boolean; unmet: string[] };
    } | null;
    /** Facts that could not be read, by name, with the reason. */
    unreadable: { [fact: string]: string };
}

const UNREADABLE = 'unreadable';

function travelText(facts: AppliedRecordFacts): string {
    if (!facts.travel) {
        return UNREADABLE;
    }
    const owner = facts.machine.machineKey || 'no machine';
    const fudge = facts.travel.fudge;
    const model = fudge ? `model size +/- fudge X${fudge.x}/Y${fudge.y} (${fudge.source})` : 'model size';
    return facts.travel.stated.length
        ? `stated in the ${owner} record (${facts.travel.stated.join(', ')}), else ${model}`
        : `${model} - no travel stated for ${owner}`;
}

function zPolicyText(facts: AppliedRecordFacts): string {
    const z = facts.zPolicy;
    if (!z) {
        return UNREADABLE;
    }
    if (!z.applies) {
        return 'n/a (no Z axis)';
    }
    if (z.missing.length) {
        return `missing (${z.missing.join(', ')}) - set_machine_policy`;
    }
    const values = `park Z${z.safeTraverseZ.value}, floor Z${z.motionFloorZ.value}`;
    return z.safeTraverseZ.source === 'default' && z.motionFloorZ.source === 'default'
        ? `A350 defaults (${values})`
        : `stated (${values}; ${z.safeTraverseZ.source})`;
}

function computedHeightText(rule: { on: boolean; unmet: string[] }): string {
    if (!rule.on) {
        return 'off';
    }
    return rule.unmet.length ? `on, not usable: ${rule.unmet.join('; ')}` : 'on';
}

/** Pure: the compact report every motion / staging result and the status tools carry. */
export function buildAppliedRecords(facts: AppliedRecordFacts) {
    const m = facts.machine;
    const owner = m.machineKey ? `${m.machineKey} record` : 'no machine record';
    const rotary = facts.rotaryGeometry;
    const tool = facts.activeTool;
    const rules = facts.motionRules;
    const records = {
        travel: travelText(facts),
        travelFudge: facts.travel && facts.travel.fudge ? facts.travel.fudge : null,
        zPolicy: zPolicyText(facts),
        landmarks: facts.landmarks,
        landmarkReview: facts.landmarkReview ? facts.landmarkReview.status : UNREADABLE,
        toolSetter: facts.toolSetter
            ? `${owner}: centre X${facts.toolSetter.centerX} Y${facts.toolSetter.centerY}, trigger Z${facts.toolSetter.triggerZ}`
            : 'none',
        probeGeometry: facts.probeGeometry
            ? `${owner}: effective length ${facts.probeGeometry.effectiveLength}${facts.probeGeometry.tipDiameter !== null ? `, tip ${facts.probeGeometry.tipDiameter}` : ''}`
            : 'none',
        rotaryGeometry: rotary
            ? {
                record: owner,
                axis: `X${rotary.axisX} Z${rotary.axisZ} (${rotary.skew})`,
                chuckFaceY: rotary.chuckFaceY,
                tailstockY: rotary.tailstockY,
                chuckTopZ: rotary.chuckTopZ,
                tailstockTopZ: rotary.tailstockTopZ,
            }
            : 'none',
        activeTool: tool
            ? `protrusion ${tool.protrusionMm} mm (${tool.clearanceBasis}, ${tool.status})${tool.toolIdentity ? ` ${tool.toolIdentity}` : ''}`
            : 'none confirmed this session',
        camera: facts.camera ? (facts.camera.device || facts.camera.url || 'auto (none stated)') : UNREADABLE,
        motionRules: rules
            ? {
                topZWithoutApproval: rules.topZWithoutApproval.on ? 'on' : `off${rules.topZWithoutApproval.gatedBy ? ` - ${rules.topZWithoutApproval.gatedBy}` : ''}`,
                computedHeight: computedHeightText(rules.computedHeight),
            }
            : UNREADABLE,
        ...(Object.keys(facts.unreadable).length ? { unreadable: facts.unreadable } : {}),
    };
    return {
        connected_machine: {
            identifier: m.identifier,
            type: m.type,
            hasZ: m.hasZ,
            dialect: m.dialect,
            deviceId: m.deviceId,
            machineKey: m.machineKey,
            verifiedOnHardware: m.verifiedOnHardware,
            gcode_form: m.gcodeForm,
            ...(m.basis !== 'connected' ? { basis: m.basis || 'none - records shown are what WOULD apply' } : {}),
            ...(m.deviceConflict ? { device_conflict: m.deviceConflict } : {}),
        },
        records,
    };
}

export type AppliedRecords = ReturnType<typeof buildAppliedRecords>;

function read<T>(name: string, unreadable: { [fact: string]: string }, fn: () => T, fallback: T): T {
    try {
        return fn();
    } catch (err) {
        unreadable[name] = (err as Error).message;
        return fallback;
    }
}

/** The live facts for the current machine (the connected one, else Luban's selected machine). */
export function appliedRecordFacts(): AppliedRecordFacts {
    const unreadable: { [fact: string]: string } = {};
    const current = read('machine', unreadable, () => machineStore.currentMachine(), null);
    const capability = read('capability', unreadable, () => connectedMachineCapability(), null);
    const key = current ? current.machineKey : null;
    let identifier = current ? current.machineIdentifier : null;
    if (capability && capability.identifier) {
        identifier = capability.identifier;
    }
    const machine = {
        identifier,
        type: capability ? capability.type : null,
        hasZ: capability ? capability.hasZ : true,
        dialect: capability ? capability.dialect.id : 'unknown',
        verifiedOnHardware: capability ? capability.dialect.verifiedOnHardware : false,
        gcodeForm: read('gcodeForm', unreadable, () => String(motionGcodeForm()), null),
        deviceId: current ? current.deviceId : null,
        machineKey: key,
        basis: current ? current.basis : null,
        deviceConflict: current && current.deviceConflict ? current.deviceConflict.note : null,
    };
    const travel = read('travel', unreadable, () => {
        const stated = statedTravel(identifier);
        const fudge = travelFudge(identifier);
        const source = fudge.source.x === fudge.source.y ? fudge.source.x : `x ${fudge.source.x}, y ${fudge.source.y}`;
        return {
            stated: (Object.keys(stated) as Array<keyof typeof stated>).filter((end) => stated[end] !== null),
            fudge: { x: fudge.x, y: fudge.y, source },
        };
    }, null);
    const zPolicy = read('zPolicy', unreadable, () => zPolicyFor(key), null);
    const landmarks = read('landmarks', unreadable, () => landmarkStore.listFor(identifier).map((l) => l.name), null);
    const landmarkReview = read('landmarkReview', unreadable, () => {
        const review = landmarkReviewForConnected();
        return { status: review.status, confirmed: review.confirmed };
    }, null);
    const toolSetter = read('toolSetter', unreadable, () => {
        const cfg = getToolSetterConfig();
        return cfg ? { centerX: cfg.centerX, centerY: cfg.centerY, triggerZ: cfg.triggerZ } : null;
    }, null);
    const probe = read('probeGeometry', unreadable, () => probeGeometry(), null);
    const rotary = read('rotaryGeometry', unreadable, () => {
        const g = rotaryGeometry();
        if (!g) {
            return null;
        }
        const { axisX, axisZ, skew, chuckFaceY, tailstockY, chuckTopZ, tailstockTopZ } = g;
        return { axisX, axisZ, skew, chuckFaceY, tailstockY, chuckTopZ, tailstockTopZ };
    }, null);
    const activeTool = read('activeTool', unreadable, () => {
        const t = getActiveTool();
        return t ? { protrusionMm: t.protrusionMm, clearanceBasis: t.clearanceBasis, status: t.status, toolIdentity: t.toolIdentity } : null;
    }, null);
    const camera = read('camera', unreadable, () => {
        if (!key) {
            return { device: null, url: null };
        }
        const device = machineStore.getFor(key, 'mcpCameraDevice');
        const url = machineStore.getFor(key, 'mcpCameraUrl');
        return { device: typeof device === 'string' && device ? device : null, url: typeof url === 'string' && url ? url : null };
    }, null);
    const motionRules = read('motionRules', unreadable, () => {
        const topZ = traverseWithoutApprovalPolicy(key);
        const computed = key ? computedHeightRuleFor(key) : null;
        return {
            topZWithoutApproval: { on: topZ.enabled, gatedBy: topZ.enabled ? null : topZ.gatedBy },
            computedHeight: { on: !!(computed && computed.on), unmet: computed && Array.isArray(computed.unmet) ? computed.unmet : [] },
        };
    }, null);
    return {
        machine,
        travel,
        zPolicy,
        landmarks,
        landmarkReview,
        toolSetter,
        probeGeometry: probe,
        rotaryGeometry: rotary,
        activeTool,
        camera,
        motionRules,
        unreadable,
    };
}

/** The plan's describeAppliedRecords(): {connected_machine, records} for the current machine. Never throws. */
export function describeAppliedRecords(): AppliedRecords {
    return buildAppliedRecords(appliedRecordFacts());
}
