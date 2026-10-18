import * as fs from 'fs-extra';
import path from 'path';
import {
    SnapmakerA150Machine,
    SnapmakerA250Machine,
    SnapmakerA350Machine,
} from '../../../../app/machines';

import DataStorage from '../../../DataStorage';
import config from '../../configstore';
import { connectionManager } from '../../machine/ConnectionManager';
import { gcodeLease } from '../../machine/gcodeLease';
import { invalidateActiveTool } from '../activeTool';
import {
    DeclaredMachineFrameRun,
    FrameJudgement,
    Reliability,
    createMachinePositionState,
    judgeBeatStateful,
    noteDisconnected,
    reliableForMotion,
} from '../machinePosition';
import {
    DEFAULT_TRAVEL_FUDGE_MM,
    ResolvedTravel,
    TravelFudge,
    describeTravel,
    modelTravel,
    outsideTravel,
    resolveTravel,
} from '../machineTravel';
import { LEGACY_MACHINE_IDENTIFIER, MachineSummary } from '../machineCapability';
import { ConnectionStatusLike, baseIdentifier, machineStore, setMachineStoreSources } from '../machineStore';
import { LANDMARK_CONFIRM_TTL_HOURS } from '../procedureLimits';
import {
    MACHINES,
    connectedMachineCapability,
    connectedMachineIdentifier,
    connectedMachineTag,
    describeConnectedMachine,
    findMachine,
    machineCapabilityFor,
} from '../connectedMachine';
import { TraverseMachine } from '../traversePlan';
import { statedTravel } from '../rotaryGeometry';
import {
    FrameLatch,
    ZERO_OFFSET_ACCEPT_BEATS,
    clearPositionOfRecord,
    clearTrustedOffset,
    currentGcodeSequence,
    clearFrameLatch,
    directGcodeQuiet,
    frameLatchVerified,
    getFrameLatch,
    getPositionOfRecord,
    latchFrameUncertain,
    onFrameLatchChange,
} from '../positionOfRecord';
import { describeFrameLatch, resyncHint } from '../frameRecovery';
import { McpToolError, ToolRegistry } from '../registry';
import logger from '../../../lib/logger';

const log = logger('service:mcp:machine');

// Kinematics an agent must not guess. On the Snapmaker 2.0 gantry the
// platform itself travels in Y while the toolhead moves in X and Z, so a
// camera fixed to the machine frame or toolhead sees the platform move
// under it: any pixel-to-machine mapping is only valid at the Y value it
// was captured at.
const SM2_KINEMATICS = {
    movingElement: { x: 'toolhead', y: 'platform', z: 'toolhead' },
    note: 'The platform travels in Y; the toolhead moves in X and Z. '
        + 'A pixel-to-machine mapping is only valid at the Y it was captured at.',
};

const KINEMATICS_BY_IDENTIFIER: { [identifier: string]: object } = {
    [SnapmakerA150Machine.identifier]: SM2_KINEMATICS,
    [SnapmakerA250Machine.identifier]: SM2_KINEMATICS,
    [SnapmakerA350Machine.identifier]: SM2_KINEMATICS,
};

export interface AppMachineSettings {
    /** Machine identifier as selected in Luban, e.g. "Snapmaker 2.0 A350". */
    series: string | null;
    /** Selected toolhead per function: printingToolhead / laserToolhead / cncToolhead. */
    toolHead: { [kind: string]: string };
    /** Installed add-on module identifiers, e.g. "snapmaker-2.0-bracing-kit-module". */
    modules: string[];
}

/**
 * The machine the OPERATOR selected in Luban's Machine Settings - series,
 * toolheads and add-on modules (quick-swap kit, bracing kit). Read fresh from
 * the app's own persisted store (userData/machine.json, state.machine) on
 * every call, so a settings change - the app returns to its home page when
 * the machine config changes - is honoured immediately. This is the single
 * source of truth for what is installed; nothing is duplicated in the
 * server configstore.
 */
export function readAppMachineSettings(): AppMachineSettings | null {
    try {
        const file = path.join(DataStorage.userDataDir, 'machine.json');
        if (!fs.existsSync(file)) {
            return null;
        }
        const store = fs.readJsonSync(file);
        const machine = store && store.state && store.state.machine;
        if (!machine || typeof machine !== 'object') {
            return null;
        }
        return {
            series: typeof machine.series === 'string' ? machine.series : null,
            toolHead: machine.toolHead && typeof machine.toolHead === 'object' ? machine.toolHead : {},
            modules: Array.isArray(machine.modules) ? machine.modules.map(String) : [],
        };
    } catch (err) {
        return null;
    }
}

/**
 * Build volume of a machine by identifier, or null when unknown.
 */
export function getMachineSizeByIdentifier(identifier: string | null): { x: number; y: number; z: number } | null {
    const machine = findMachine(identifier);
    return machine ? machine.metadata.size : null;
}

/**
 * The transport traits of the CONNECTED machine for the XY planners
 * (traversePlan.ts TraverseMachine): whether it has a Z axis, and which
 * gcode form its firmware is known to execute. A GRBL-flavoured machine (the
 * Ray, gcodeFlavor 'grbl' in its definition) gets Luban's own relative jog
 * form; everything else keeps the Snapmaker 2.0 own-line G53 / G54 steps.
 */
export function traverseMachine(): TraverseMachine {
    const capability = connectedMachineCapability();
    const definition = findMachine(capability.identifier) as { metadata?: { gcodeFlavor?: string } } | null;
    const grbl = !!definition && definition.metadata !== undefined && definition.metadata.gcodeFlavor === 'grbl';
    return { hasZ: capability.hasZ, gcode: grbl ? 'grbl-relative' : 'snapmaker-2' };
}

/**
 * Refuse a Z tool on a machine that has no Z axis, naming the machine. The
 * refusal never mentions move_z: there is nothing to raise.
 */
export function requireZAxis(what: string): void {
    const capability = connectedMachineCapability();
    if (!capability.hasZ) {
        throw new McpToolError(`Refusing ${what}: this machine has no Z axis (${capability.identifier}, ${capability.type}, `
            + 'definition size.z 0). XY moves run at its only height; there is no Z to move, no motion floor and no traverse height.');
    }
}

function axisValue(value: unknown): number | null {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
}

/**
 * The PARK height: where a procedure hops between stations, retreats to on an
 * abort, and ends. Default 328 = home Z on the A350. Per machine via
 * set_machine_policy safe_traverse_z (machineStore.ts; zPolicyFor below).
 *
 * This was also the minimum Z for any XY move until 2026-09-19, which is why
 * it sits at the ceiling: the rotary landmark declares clearance 328 because
 * that number had to cover a fitted touch probe, so the floor had to rise to
 * meet it (README, job 34d787bdb2d7). With clearances stated as obstacle
 * heights and the tool added at check time, the two can be separated again -
 * see motionFloorZ below.
 */
export const DEFAULT_SAFE_TRAVERSE_Z = 328;

/**
 * The MOTION FLOOR: the lowest machine Z at which an XY move over 1 mm may
 * happen at all - law 2, which after the 2026-09-01 probe crash read "always
 * retreat to top gantry height before x/y moves".
 *
 * Operator decision 2026-09-19: transport is allowed at 320 and above rather
 * than only at the park height, with the heartbeat's float noise tolerated
 * (so 319.95 up). What made that safe is that obstacle clearances are no
 * longer a blanket ceiling: a landmark states its own height, the fitted
 * tool's protrusion and a margin are added when a path is checked, and the
 * traverse-height exemption from crossing checks stays REMOVED - a hop at 320
 * is checked against every stored box exactly like any low segment.
 *
 * The residual risk is what the registry does not know about: 8 mm less blind
 * protection for anything on the bed that has no landmark. Override via
 * set_machine_policy motion_floor_z (per machine), which is the one setting that reverts this.
 */
export const DEFAULT_MOTION_FLOOR_Z = 320;

/**
 * Per-machine Z policy (tyeth/Luban#265 R9, machineStore.ts zPolicy). The
 * defaults above are the A350's - home Z and the 2026-09-19 floor - and
 * exist ONLY for the A350 (and for nothing connected or selected, where no
 * motion is possible and the pre-#265 numbers are what every status read
 * showed). Any other machine with a Z axis (A150, A250, Artisan, Original)
 * has no default: a model's size.z is a travel limit, not a park height, so
 * the Z tools refuse until the operator states both with set_machine_policy.
 * On a machine with no Z axis the policy does not apply; the A350 numbers are
 * returned unchanged (as before) for the callers that ignore them there.
 */
export type ZPolicySource = 'default' | 'not-applicable' | 'unset' | string;

export interface ZPolicyValue {
    value: number | null;
    /** 'default' (A350), 'not-applicable' (no Z axis), 'unset' (must be stated), else who stated it (set_machine_policy / migration). */
    source: ZPolicySource;
    setAt: number | null;
}

export interface ZPolicy {
    machineKey: string | null;
    machineIdentifier: string | null;
    /** false on a machine with no Z axis: there is no traverse height or floor. */
    applies: boolean;
    safeTraverseZ: ZPolicyValue;
    motionFloorZ: ZPolicyValue;
    /** Fields that must be stated with set_machine_policy before any Z planning on this machine. */
    missing: string[];
}

type Provenance = { [field: string]: { source?: string; setAt?: number } } | undefined;

function storedProvenance(machineKey: string | null, key: string): Provenance {
    return machineKey === null ? undefined : machineStore.getFor(machineKey, key) as Provenance;
}

/** Whether a machine falls back to the A350 defaults: the A350 itself, or nothing connected or selected. */
function hasA350Defaults(identifier: string | null): boolean {
    return identifier === null || identifier === LEGACY_MACHINE_IDENTIFIER;
}

/** The Z policy of `machineKey` (default: the current machine's entry). Never throws: status reads use this. */
export function zPolicyFor(machineKey: string | null = machineStore.currentMachine().machineKey): ZPolicy {
    const identifier = machineKey === null ? null : baseIdentifier(machineKey);
    const applies = machineCapabilityFor(identifier).hasZ;
    const provenance = storedProvenance(machineKey, 'mcpZPolicyProvenance');
    const read = (key: string, field: string, fallback: number): ZPolicyValue => {
        if (!applies) {
            return { value: fallback, source: 'not-applicable', setAt: null };
        }
        const raw = Number(machineKey === null ? undefined : machineStore.getFor(machineKey, key));
        if (Number.isFinite(raw) && raw > 0) {
            const stated = provenance && provenance[field];
            return { value: raw, source: (stated && stated.source) || 'config', setAt: (stated && stated.setAt) || null };
        }
        return hasA350Defaults(identifier) ? { value: fallback, source: 'default', setAt: null } : { value: null, source: 'unset', setAt: null };
    };
    const safe = read('mcpSafeTraverseZ', 'safeTraverseZ', DEFAULT_SAFE_TRAVERSE_Z);
    const floor = read('mcpMotionFloorZ', 'motionFloorZ', DEFAULT_MOTION_FLOOR_Z);
    // Never above the park height: a floor the machine cannot legally sit at
    // would refuse every traverse, which is the failure this replaced.
    if (floor.value !== null && safe.value !== null && floor.value > safe.value) {
        floor.value = safe.value;
    }
    const missing = [safe.value === null ? 'safe_traverse_z' : null, floor.value === null ? 'motion_floor_z' : null].filter((f): f is string => !!f);
    return { machineKey, machineIdentifier: identifier, applies, safeTraverseZ: safe, motionFloorZ: floor, missing };
}

function zPolicyRefusal(policy: ZPolicy): string {
    return `No ${policy.missing.join(' / ')} is stated for ${policy.machineKey} ${connectedMachineTag()}, so there is no height to `
        + 'traverse at or floor to check against. Only the Snapmaker 2.0 A350 has defaults (park Z328, floor Z320); the model '
        + 'size.z is a travel limit, not a park height. State safe_traverse_z and motion_floor_z (machine Z, measured on this '
        + 'machine) with set_machine_policy first.';
}

/**
 * The top of the Z TRAVEL for range checks (staging frame context, pendant
 * envelope): the model's size.z, or the park height when that is higher (an
 * A350 homes at Z328 against its profile). Never throws - a machine with no
 * stated park height is range-checked against its size.z alone; it is the
 * hop/park users of safeTraverseZ() that refuse.
 */
export function zTravelTop(sizeZ: number): number {
    const park = zPolicyFor().safeTraverseZ.value;
    return park === null ? sizeZ : Math.max(sizeZ, park);
}

/** Park height of the CURRENT machine (zPolicyFor), or a refusal naming set_machine_policy when it has none. */
export function safeTraverseZ(): number {
    const policy = zPolicyFor();
    if (policy.safeTraverseZ.value === null) {
        throw new McpToolError(zPolicyRefusal(policy));
    }
    return policy.safeTraverseZ.value;
}

/** Motion floor of the CURRENT machine (zPolicyFor), or a refusal naming set_machine_policy when it has none. */
export function motionFloorZ(): number {
    const policy = zPolicyFor();
    if (policy.motionFloorZ.value === null) {
        throw new McpToolError(zPolicyRefusal(policy));
    }
    return policy.motionFloorZ.value;
}

/**
 * Approval-free transport at the traverse height (operator ruling
 * 2026-10-17, issue #241: "if we've got to top z there's no approval for
 * move at top z"). On, an XY-only traverse_xy / the XY step of
 * goto_tool_change_position / an UP-only move_z runs on the call when the
 * head is already at or above safeTraverseZ() on a verified, homed position
 * and the route passed the usual landmark and travel checks (safeZPolicy.ts).
 * Everything else still stages a confirm page. Default ON for this rig
 * (the operator's stated preference); configstore
 * mcpTraverseWithoutApprovalAtSafeZ (Settings -> MCP Server -> Job approval)
 * or LUBAN_MCP_TRAVERSE_WITHOUT_APPROVAL_AT_SAFE_Z=0/1 turns it off/on.
 */
export const DEFAULT_TRAVERSE_WITHOUT_APPROVAL_AT_SAFE_Z = true;

function parseSwitch(raw: unknown): boolean | null {
    const text = String(raw === undefined || raw === null ? '' : raw).trim().toLowerCase();
    if (text === '0' || text === 'false' || text === 'off') {
        return false;
    }
    if (text === '1' || text === 'true' || text === 'on') {
        return true;
    }
    return null;
}

/**
 * The HOST-wide switch the Settings pane shows and writes (env > configstore
 * mcpTraverseWithoutApprovalAtSafeZ > default on). Kept global: it is the
 * operator's kill switch. What a motion tool honours is
 * traverseWithoutApprovalAtSafeZ() below, which also needs the machine.
 */
export function traverseWithoutApprovalHostSetting(): boolean {
    const env = parseSwitch(process.env.LUBAN_MCP_TRAVERSE_WITHOUT_APPROVAL_AT_SAFE_Z);
    if (env !== null) {
        return env;
    }
    const stored = config.get('mcpTraverseWithoutApprovalAtSafeZ');
    if (stored === undefined || stored === null || stored === '') {
        return DEFAULT_TRAVERSE_WITHOUT_APPROVAL_AT_SAFE_Z;
    }
    return stored === true || stored === 'true' || stored === 1 || stored === '1';
}

export function traverseWithoutApprovalSource(): 'env' | 'config' | 'default' {
    const env = String(process.env.LUBAN_MCP_TRAVERSE_WITHOUT_APPROVAL_AT_SAFE_Z || '').trim();
    if (env) {
        return 'env';
    }
    const stored = config.get('mcpTraverseWithoutApprovalAtSafeZ');
    return stored === undefined || stored === null || stored === '' ? 'default' : 'config';
}

export interface TraverseApproval {
    /** What the motion tools honour: the setting AND the machine gate. */
    enabled: boolean;
    /** The setting before the gate. */
    setting: boolean;
    /** env > host switch OFF > this machine's set_machine_policy value > host switch ON > default. */
    source: 'env' | 'host-setting' | 'machine' | 'default';
    /** Why the gate holds approval-free transport off on this machine, or null when it does not. */
    gatedBy: string | null;
}

/**
 * Approval-free transport for `machineKey` (default: the current machine).
 * R9: never on a machine whose motion has not been verified on hardware -
 * today only the A350 - and never while a device conflict (machineStore.ts)
 * leaves the records unconfirmed. The host switch OFF wins over any machine.
 */
export function traverseWithoutApprovalPolicy(machineKey?: string | null): TraverseApproval {
    const current = machineStore.currentMachine();
    const key = machineKey === undefined ? current.machineKey : machineKey;
    const identifier = key === null ? null : baseIdentifier(key);
    let setting: boolean;
    let source: TraverseApproval['source'];
    const env = parseSwitch(process.env.LUBAN_MCP_TRAVERSE_WITHOUT_APPROVAL_AT_SAFE_Z);
    const host = parseSwitch(config.get('mcpTraverseWithoutApprovalAtSafeZ'));
    const perMachine = parseSwitch(key === null ? undefined : machineStore.getFor(key, 'mcpMachineTraverseWithoutApprovalAtSafeZ'));
    if (env !== null) {
        [setting, source] = [env, 'env'];
    } else if (host === false) {
        [setting, source] = [false, 'host-setting'];
    } else if (perMachine !== null) {
        [setting, source] = [perMachine, 'machine'];
    } else if (host !== null) {
        [setting, source] = [host, 'host-setting'];
    } else {
        [setting, source] = [DEFAULT_TRAVERSE_WITHOUT_APPROVAL_AT_SAFE_Z, 'default'];
    }
    let gatedBy: string | null = null;
    // TODO(WP1, tyeth/Luban#265): gate on the dialect's verifiedOnHardware once
    // machineCapability carries it; until then the A350 is the one verified machine.
    if (identifier !== LEGACY_MACHINE_IDENTIFIER) {
        gatedBy = `approval-free transport is allowed only on a machine verified on hardware (the ${LEGACY_MACHINE_IDENTIFIER}); `
            + `${identifier || 'no machine'} stages every move`;
    } else if (key === current.machineKey && current.deviceConflict) {
        gatedBy = `device conflict: ${current.deviceConflict.note}`;
    }
    return { enabled: setting && gatedBy === null, setting, source, gatedBy };
}

/** What traverse_xy / goto_tool_change_position / move_z honour (safeZPolicy.ts). */
export function traverseWithoutApprovalAtSafeZ(): boolean {
    return traverseWithoutApprovalPolicy().enabled;
}

/** The landmark review validity of the current machine (R4; WP5 reads it). */
export function landmarkConfirmTtlHours(machineKey: string | null = machineStore.currentMachine().machineKey): { hours: number; source: string } {
    const raw = Number(machineKey === null ? undefined : machineStore.getFor(machineKey, 'mcpLandmarkConfirmTtlHours'));
    if (Number.isFinite(raw) && raw >= LANDMARK_CONFIRM_TTL_HOURS.min && raw <= LANDMARK_CONFIRM_TTL_HOURS.max) {
        return { hours: raw, source: 'set_machine_policy' };
    }
    return { hours: LANDMARK_CONFIRM_TTL_HOURS.default, source: 'default' };
}

export interface PositionSnapshot {
    /** Which machine this position belongs to, and whether it has a Z axis - so an agent cannot miss that it is driving a Ray. */
    connectedMachine: MachineSummary;
    work: { x: number | null; y: number | null; z: number | null };
    machine: { x: number | null; y: number | null; z: number | null };
    originOffset: { x: number; y: number; z: number };
    originOffsetSource: 'heartbeat' | 'cached' | 'assumed-zero';
    /**
     * Trust level of `machine` - the JUDGED position of record (machinePosition.ts).
     * verified: controller echo of the last commanded move; heartbeat: a coherent
     * beat with its own offset; cached-offset: coherent beat, offset reused from
     * the last complete one; awaiting-resync: the beat was REJECTED (out of
     * bounds, frame flip, no offset yet) and `machine` is the last accepted
     * position - motion and staging refuse until a coherent beat arrives;
     * stale: no report for > HEARTBEAT_STALE_MS.
     */
    reliability: Reliability;
    /** Which reading the judged position rests on. */
    frame: FrameJudgement;
    /** Beat timestamp `machine` comes from (the held position's own time when the latest beat was rejected). */
    machineReportedAt: number | null;
    /** Why the judgement is what it is; also mirrored into warnings. */
    reasons: string[];
    judged: {
        accepted: boolean;
        rejectedReason: string | null;
        /** raw - offset for THIS beat, for diagnostics only - never for motion. */
        derived: { x: number | null; y: number | null; z: number | null };
        /** Judged under a declared machine-frame run (USB pendant queued jog): raw is machine coordinates. */
        declaredRun: boolean;
    };
    b: number | null;
    isFourAxis: boolean;
    isHomed: boolean | null;
    machineStatus: string | null;
    reportAgeMs: number;
    /** The beat's own timestamp (ms epoch) - compare beats with this, never with Date.now() - reportAgeMs (1 ms jitter made one beat look like two). */
    reportedAt: number;
    convention: string;
    warnings: string[];
}

// The WiFi status poll runs every 2 s (3 s timeout); a report older than this
// means the machine connection has likely dropped without the server noticing
// (observed live 2026-09-02: 5.7 minutes of stale state served as truth while
// the machine was disconnected).
export const HEARTBEAT_STALE_MS = 10000;

// Machine position of record (machinePosition.ts): one judged position per
// distinct beat, forgotten on every (re)connection. get_position, the capture
// tools, the planners and diagnostics all read it; nothing else in the server
// derives `work - originOffset` on its own.
const machinePosition = createMachinePositionState();
// Only QUIET beats count towards believing a zero offset: while direct gcode is
// in flight (or replied within the last ZERO_OFFSET_QUIET_MS) a zero is the
// G53-window artefact by construction - a scan stepping every second produced
// runs of them and the 3-beat streak accepted the zero 28 times in one run
// (2026-09-05). A real re-zero from the touchscreen happens with the machine
// idle and is believed after 3 quiet beats (~6 s).
const ZERO_OFFSET_QUIET_MS = 3000;

// A declared machine-frame run (machinePosition.ts DeclaredMachineFrameRun):
// beats RECEIVED at or after `fromMs` are judged as machine coordinates until
// endMachineFrameRun(). Declared only by the USB pendant's queued run, between
// its G53 reply and its closing G54 send.
let declaredRun: (DeclaredMachineFrameRun & { fromMs: number }) | null = null;

export function declareMachineFrameRun(envelope: { xMin: number; xMax: number; yMin: number; yMax: number; zMin: number; zMax: number },
    fromMs: number, marginMm = 1): void {
    declaredRun = { envelope: { min: { x: envelope.xMin, y: envelope.yMin, z: envelope.zMin },
        max: { x: envelope.xMax, y: envelope.yMax, z: envelope.zMax } },
    marginMm,
    fromMs };
}

export function endMachineFrameRun(): void {
    declaredRun = null;
}

// The frame-uncertainty latch survives a Luban restart: if Luban stopped while
// the controller may have had G53 selected (a queued pendant run, a failed
// call's cleanup, a restore never verified), it may still be there. On startup
// the latch is re-raised, and the gcode lease reads the latch as its recovery
// hold, so only Restore work frame, Luban's UI Home sequence, position queries
// and job stop pass until a restore and a verified position clear it (the MCP
// home tool is refused by requireReliableMachine like every other motion). The file is FAIL-SAFE
// (2026-10-05 review): it is written whole (temp file + rename, never a torn
// write), and a file that exists but cannot be read or parsed raises the latch
// rather than being ignored - an unreadable record of uncertainty is still
// uncertainty.
const FRAME_LATCH_FILE = 'mcp-frame-latch.json';

function frameLatchPath(): string | null {
    try { return DataStorage.userDataDir ? path.join(DataStorage.userDataDir, FRAME_LATCH_FILE) : null; } catch (err) { return null; }
}

export function persistFrameLatch(latch: FrameLatch | null): void {
    const file = frameLatchPath();
    if (!file) { return; }
    try {
        if (latch) {
            const temp = `${file}.tmp`;
            fs.writeFileSync(temp, `${JSON.stringify(latch)}\n`);
            fs.renameSync(temp, file);
        } else if (fs.existsSync(file)) {
            fs.removeSync(file);
        }
    } catch (err) {
        // The in-memory latch still refuses motion; only the carry-over across a restart is at risk.
        log.warn(`Could not ${latch ? 'write' : 'remove'} the frame latch file ${file}: ${(err as Error).message}`);
    }
}

/** The on-disk latch: null when no file, a latch when readable, 'unreadable' when it exists but cannot be read or parsed. */
export function readPersistedFrameLatch(): Partial<FrameLatch> | 'unreadable' | null {
    const file = frameLatchPath();
    if (!file) { return null; }
    let exists: boolean;
    try {
        exists = fs.existsSync(file);
    } catch (err) {
        return 'unreadable';
    }
    if (!exists) { return null; }
    try {
        const saved = fs.readJsonSync(file) as unknown;
        if (!saved || typeof saved !== 'object' || Array.isArray(saved)) { return 'unreadable'; }
        return saved as Partial<FrameLatch>;
    } catch (err) {
        return 'unreadable';
    }
}

export function restorePersistedFrameLatch(): void {
    const saved = readPersistedFrameLatch();
    if (saved === null) { return; }
    if (saved === 'unreadable') {
        log.warn(`The frame latch file ${frameLatchPath()} exists but could not be read: raising the latch.`);
        latchFrameUncertain(`Carried over from before Luban restarted: an unreadable latch file (${FRAME_LATCH_FILE}) says the `
            + 'machine workspace may have been left selected. Restore the work frame before any motion.');
        return;
    }
    latchFrameUncertain(`Carried over from before Luban restarted: ${String(saved.reason || 'a queued pendant run')} `
        + 'Restore the work frame before any motion.');
}

// Persist every change; the lease's recovery hold needs no update because it
// reads the latch itself (machine/gcodeLease.ts).
onFrameLatchChange((latch) => persistFrameLatch(latch));
restorePersistedFrameLatch();

/**
 * Which connection we are on. The position-of-record state is forgotten on
 * every (re)connection, so its reset stamp IS the epoch: anything bound to a
 * connection - a work origin, a camera model - stops being believable when
 * this changes.
 */
export function connectionEpoch(): number {
    return machinePosition.resetAt === null ? 0 : machinePosition.resetAt;
}

/** Diagnostics: how the machine position is currently being judged. */
export function machinePositionDiagnostics() {
    const last = machinePosition.lastJudgement;
    return {
        cachedOffset: machinePosition.cachedOffset,
        zeroOffsetStreak: machinePosition.zeroStreak,
        zeroOffsetAcceptBeats: ZERO_OFFSET_ACCEPT_BEATS,
        /** Snapshots that set a zero-offset report aside as a G53-window transient. */
        zeroOffsetTransientsSeen: machinePosition.zeroTransients,
        /** Beats rejected by reason - each one would have been a wrong machine position handed to a guard. */
        rejectedBeats: { ...machinePosition.rejected },
        /** Rejected -> accepted transitions: "rectified on the next sync". */
        resyncs: machinePosition.resyncs,
        disconnects: machinePosition.disconnects,
        /** When the state was last forgotten (a disconnect); null on the first connection. */
        resetAt: machinePosition.resetAt,
        lastAccepted: machinePosition.lastAccepted,
        /** Set while the controller may still be in the machine workspace after a queued pendant run. */
        frameUncertain: getFrameLatch(),
        declaredMachineFrameRun: declaredRun,
        gcodeLease: gcodeLease.status(),
        lastJudgement: last
            ? { reliability: last.reliability, frame: last.frame, accepted: last.accepted, rejectedReason: last.rejectedReason, reasons: last.reasons }
            : null,
    };
}

/**
 * The channel reports no state (closed, or not yet connected): forget the
 * previous connection's offsets and record. Work origins die on a machine
 * reboot, so nothing learnt before may leak into the next connection.
 */
export function noteMachineDisconnected(): void {
    invalidateActiveTool('Machine disconnected/rebooted; confirm the fitted tool or measure it again.');
    noteDisconnected(machinePosition, Date.now());
    clearPositionOfRecord();
    clearTrustedOffset();
}

/**
 * The travel FUDGE: how far outside the machine model's nominal box, at each
 * end of each axis, the toolhead is allowed to be (machineTravel.ts header).
 * Default 25 mm - covers the A350's X-19..339 against 320 and the Ray's
 * home at about X-1 / Y399 against 600 x 400, and still refuses X650 on the
 * Ray. One setting PER MACHINE (set_machine_policy travel_fudge_mm, in the
 * machine's machineStore entry) / LUBAN_MCP_TRAVEL_FUDGE_MM (env, wins), with
 * optional per-axis overrides travel_fudge_x_mm / travel_fudge_y_mm
 * (LUBAN_MCP_TRAVEL_FUDGE_X_MM / _Y_MM). Negative or
 * absurd values fall back to the default rather than refusing every move.
 */
export const TRAVEL_FUDGE_MAX_MM = 500;

export type TravelFudgeSource = 'env' | 'config' | 'default';

function fudgeSetting(envName: string, key: string, machineKey: string | null): { value: number; source: TravelFudgeSource } | null {
    const env = String(process.env[envName] || '').trim();
    if (env) {
        const n = Number(env);
        if (Number.isFinite(n) && n >= 0 && n <= TRAVEL_FUDGE_MAX_MM) {
            return { value: n, source: 'env' };
        }
    }
    // 'config' = this machine's own entry in the per-machine store (machineStore.ts).
    const stored = machineKey === null ? undefined : machineStore.getFor(machineKey, key);
    if (stored !== undefined && stored !== null && stored !== '') {
        const n = Number(stored);
        if (Number.isFinite(n) && n >= 0 && n <= TRAVEL_FUDGE_MAX_MM) {
            return { value: n, source: 'config' };
        }
    }
    return null;
}

/** The fudge of machine `identifier` (default: the current machine): env > that machine's entry > 25 mm. */
export function travelFudge(identifier?: string | null): TravelFudge & { source: { x: TravelFudgeSource; y: TravelFudgeSource }; defaultMm: number } {
    const machineKey = identifier === undefined ? machineStore.currentMachine().machineKey : machineStore.keyForIdentifier(identifier);
    const common = fudgeSetting('LUBAN_MCP_TRAVEL_FUDGE_MM', 'mcpTravelFudgeMm', machineKey);
    const x = fudgeSetting('LUBAN_MCP_TRAVEL_FUDGE_X_MM', 'mcpTravelFudgeXMm', machineKey) || common;
    const y = fudgeSetting('LUBAN_MCP_TRAVEL_FUDGE_Y_MM', 'mcpTravelFudgeYMm', machineKey) || common;
    return {
        x: x ? x.value : DEFAULT_TRAVEL_FUDGE_MM,
        y: y ? y.value : DEFAULT_TRAVEL_FUDGE_MM,
        source: { x: x ? x.source : 'default', y: y ? y.source : 'default' },
        defaultMm: DEFAULT_TRAVEL_FUDGE_MM,
    };
}

/**
 * The machine model's travel as the bounds a derived position must stay
 * within: size +/- the travel fudge on X and Y (the judge adds its own
 * BOUNDS_MARGIN_MM garbage margin on top), 0..size.z on Z - and NO Z range
 * at all on a machine without a Z axis (the Ray reports Z 0 for ever).
 */
export function machineBounds(identifier: string | null) {
    const capability = machineCapabilityFor(identifier);
    if (!capability.size) {
        return null;
    }
    const xy = modelTravel(capability.size, travelFudge(identifier));
    return {
        min: { x: xy.xMin, y: xy.yMin, z: capability.hasZ ? 0 : -Infinity },
        max: { x: xy.xMax, y: xy.yMax, z: capability.hasZ ? capability.size.z : Infinity },
    };
}

/**
 * Position from the latest heartbeat, judged into the position of record.
 * Shared by get_position, the capture tools and every planner. Throws
 * McpToolError when unavailable.
 */
export function getPositionSnapshot(): PositionSnapshot {
    const status = connectionManager.getConnectionStatus();
    if (!status.connected) {
        noteMachineDisconnected();
        throw new McpToolError('No machine connected.');
    }

    const state = connectionManager.getLatestMachineState();
    if (!state) {
        noteMachineDisconnected();
        throw new McpToolError('No heartbeat received yet on this channel; position unknown.');
    }

    const pos = (state.pos || {}) as { x?: unknown; y?: unknown; z?: unknown; b?: unknown; isFourAxis?: boolean };
    const originOffset = (state.originOffset || {}) as { x?: unknown; y?: unknown; z?: unknown };

    // The raw fields: the position in the workspace the controller currently
    // has selected (normally the work frame), and the offset the SSTP status
    // poll rebuilt from offsetX/Y/Z on this beat. Both are handed to the
    // judge as they are; nothing here subtracts.
    const work = {
        x: axisValue(pos.x),
        y: axisValue(pos.y),
        z: axisValue(pos.z),
    };
    const reported = {
        x: axisValue(originOffset.x),
        y: axisValue(originOffset.y),
        z: axisValue(originOffset.z),
    };
    const now = Date.now();
    const record = getPositionOfRecord(currentGcodeSequence());
    const judgement = judgeBeatStateful(
        machinePosition,
        { raw: work, offsetReported: reported, reportedAt: state.timestamp },
        {
            now,
            staleMs: HEARTBEAT_STALE_MS,
            bounds: machineBounds(status.machineIdentifier),
            verified: record ? { ...record.machine } : null,
            directGcodeQuiet: directGcodeQuiet(ZERO_OFFSET_QUIET_MS),
            declaredRun: declaredRun && state.timestamp >= declaredRun.fromMs ? declaredRun : null,
        }
    );
    const latch = getFrameLatch();
    if (latch && frameLatchVerified(latch, record, { accepted: judgement.accepted,
        frame: judgement.frame,
        offsetSource: judgement.offset.source,
        reportedAt: state.timestamp,
        declaredRun: judgement.declaredRun })) {
        clearFrameLatch();
    }
    // Inside the declared run the latch is the expected state; it still refuses motion.
    const openLatch = getFrameLatch();
    const frameWarnings = openLatch && !judgement.declaredRun ? [describeFrameLatch(openLatch)] : [];

    return {
        connectedMachine: describeConnectedMachine(),
        work,
        machine: judgement.machine,
        originOffset: judgement.offset.offset,
        originOffsetSource: judgement.offset.source,
        reliability: judgement.reliability,
        frame: judgement.frame,
        machineReportedAt: judgement.machineReportedAt,
        reasons: judgement.reasons,
        judged: {
            accepted: judgement.accepted,
            rejectedReason: judgement.rejectedReason,
            derived: judgement.derived,
            declaredRun: judgement.declaredRun,
        },
        b: axisValue(pos.b),
        isFourAxis: !!pos.isFourAxis,
        isHomed: (state as { isHomed?: boolean }).isHomed ?? null,
        machineStatus: (state as { status?: string }).status || null,
        reportAgeMs: now - state.timestamp,
        reportedAt: state.timestamp,
        convention: 'machine = the JUDGED position of record (machinePosition.ts) with `reliability`; work/originOffset are the '
            + 'raw report - never derive machine = work - originOffset by hand. Agents plan in machine coordinates; the work '
            + 'origin is the operator\'s.',
        warnings: [...judgement.reasons, ...frameWarnings],
    };
}

/**
 * The XY travel a planner may sweep, for THIS machine: the machine model's
 * size plus the travel fudge at each end (machineTravel.ts), tightened by any
 * travel the operator stated FOR THIS MACHINE (set_probe_geometry travel_*,
 * machine-scoped; a statement looser than the model is reported and
 * ignored). Null when the machine is unknown and not every end has been
 * stated - there is no honest box to clamp to, and a caller must refuse
 * rather than invent one.
 *
 * machineBounds() above is the same model box; the position judge adds its
 * own BOUNDS_MARGIN_MM garbage margin to it, which is why planners read this
 * and not that.
 */
export function planningTravel(observed?: { x: number | null; y: number | null } | null): ResolvedTravel | null {
    const identifier = connectedMachineIdentifier();
    let seen = observed;
    if (seen === undefined) {
        // The live position is evidence of reach, when there is one to read.
        try {
            const snapshot = getPositionSnapshot();
            seen = { x: snapshot.machine.x, y: snapshot.machine.y };
        } catch (err) {
            seen = null;
        }
    }
    return resolveTravel({
        size: getMachineSizeByIdentifier(identifier),
        fudge: travelFudge(identifier),
        stated: statedTravel(identifier),
        observed: seen || null,
    });
}

/** planningTravel() described in one line for results and refusals. */
export function describePlanningTravel(travel: ResolvedTravel): string {
    return describeTravel(travel, connectedMachineIdentifier());
}

/**
 * planningTravel(), or a refusal that says how to state the travel. Every
 * planner that puts a waypoint, a station or a march limit somewhere in XY
 * asks this: there is no honest box to check against when the machine is
 * unknown and nothing has been stated, and until 2026-09-21 each planner
 * answered that by inventing one (machine -25..size+40, from the garbage-beat
 * filter), which on an A350 admits X-25 against a travel that stops at X-19.
 */
export function requirePlanningTravel(what: string, observed?: { x: number | null; y: number | null } | null): ResolvedTravel {
    const travel = planningTravel(observed);
    if (!travel) {
        const identifier = connectedMachineIdentifier();
        throw new McpToolError(`The toolhead travel is unknown for this machine (${identifier === null ? 'no machine connected'
            : `identifier "${identifier}" matches no machine definition`}), so ${what} cannot be planned without `
            + 'inventing an envelope. Connect a known machine, or state every end with set_probe_geometry (travel_x_min, '
            + 'travel_x_max, travel_y_min, travel_y_max) - the measured limits for this rig.');
    }
    return travel;
}

/**
 * Refuse a plan whose named XY points lie outside the travel (heartbeat float
 * noise tolerated). The message names the point, the axis and the distance,
 * and which layer the limit came from, so an operator whose rig really does
 * reach further knows to state it rather than argue with the definition.
 */
export function assertWithinTravel(points: Array<{ label: string; x: number; y: number }>, travel: ResolvedTravel): void {
    for (const p of points) {
        const outside = outsideTravel(p, travel.limits);
        if (outside) {
            throw new McpToolError(`${p.label} (machine ${Number(p.x.toFixed(3))}, ${Number(p.y.toFixed(3))}) is outside the `
                + `toolhead travel: ${outside} (${describePlanningTravel(travel)}). Move the plan inside it; widen the travel fudge `
                + '(set_machine_policy travel_fudge_mm) only if this rig genuinely reaches there.');
        }
    }
}

/**
 * Refuse to act on a machine position the position of record does not vouch
 * for. `awaiting-resync` clears itself on the next coherent beat (2 s); `stale`
 * needs a reconnect.
 */
export function requireReliableMachine(position: PositionSnapshot, what: string): void {
    const latch = getFrameLatch();
    if (latch) {
        throw new McpToolError(`Refusing ${what}: ${describeFrameLatch(latch)}`);
    }
    if (reliableForMotion(position.reliability)) {
        return;
    }
    const why = position.reasons.length ? ` ${position.reasons.join(' ')}` : '';
    throw new McpToolError(`Refusing ${what}: the machine position is ${position.reliability}.${why}${resyncHint(position.reliability)}`);
}

/**
 * Refuse to act on a stale OR incoherent heartbeat. Every motion-adjacent
 * path (staging, procedure preconditions, direct execution, job start) calls
 * this: a position the machine reported minutes ago is not a position, and
 * neither is a beat the position of record rejected (out of bounds, frame
 * flip, no offset yet - operator law 2026-09-14). None of the callers sits in
 * a runner's per-move loop, so a rejected G53-window beat can only delay a
 * start by one poll period, never abort a running procedure.
 */
export function assertFreshHeartbeat(what: string): void {
    const state = connectionManager.getLatestMachineState();
    if (!state) {
        throw new McpToolError('No heartbeat received yet on this channel; position unknown.');
    }
    const age = Date.now() - state.timestamp;
    if (age > HEARTBEAT_STALE_MS) {
        throw new McpToolError(`Refusing ${what}: the last heartbeat is ${(age / 1000).toFixed(0)}s old `
            + '(poll period 2 s) - the machine connection has likely dropped without the server noticing. '
            + 'Reconnect the machine, verify get_position reports a fresh, correct position, then retry.');
    }
    requireReliableMachine(getPositionSnapshot(), what);
}

/** get_machine_profile.policy / get_stored_state: the machine's policy with the source of every value. */
export function describeMachinePolicy(machineKey: string | null) {
    const identifier = machineKey === null ? null : baseIdentifier(machineKey);
    const fudge = travelFudge(identifier);
    return {
        machineKey,
        zPolicy: zPolicyFor(machineKey),
        travelFudge: {
            xMm: fudge.x,
            yMm: fudge.y,
            source: fudge.source,
            defaultMm: fudge.defaultMm,
            statedBy: storedProvenance(machineKey, 'mcpTravelFudgeProvenance') || {},
            setting: 'set_machine_policy travel_fudge_mm / travel_fudge_x_mm / travel_fudge_y_mm (env LUBAN_MCP_TRAVEL_FUDGE_MM, _X_MM, _Y_MM wins)',
        },
        traverseWithoutApprovalAtSafeZ: traverseWithoutApprovalPolicy(machineKey),
        landmarkConfirmTtl: landmarkConfirmTtlHours(machineKey),
    };
}

const FUDGE_ARGS: Array<[string, string, string, string]> = [
    ['travel_fudge_mm', 'mcpTravelFudgeMm', 'LUBAN_MCP_TRAVEL_FUDGE_MM', 'mm'],
    ['travel_fudge_x_mm', 'mcpTravelFudgeXMm', 'LUBAN_MCP_TRAVEL_FUDGE_X_MM', 'x'],
    ['travel_fudge_y_mm', 'mcpTravelFudgeYMm', 'LUBAN_MCP_TRAVEL_FUDGE_Y_MM', 'y'],
];

function policyNumber(name: string, raw: unknown, range: [number, number], why: string, exclusiveMin = false): number {
    const n = Number(raw);
    const [min, max] = range;
    if (typeof raw === 'boolean' || raw === '' || !Number.isFinite(n) || (exclusiveMin ? n <= min : n < min) || n > max) {
        throw new McpToolError(`${name} must be a number in ${exclusiveMin ? '(' : ''}${min}..${max} (${why}); got ${JSON.stringify(raw)}.`);
    }
    return n;
}

/** set_machine_policy: validate everything first, then write into the connected machine's entry only. */
export function setMachinePolicy(args: { [key: string]: unknown }) {
    const current = machineStore.currentMachine();
    if (current.basis !== 'connected' || !current.machineKey || !current.machineIdentifier) {
        throw new McpToolError('set_machine_policy states the policy of the CONNECTED machine, and none is connected. Connect it first.');
    }
    if (current.deviceConflict) {
        throw new McpToolError(`Refusing to write policy while the device conflict is open: ${current.deviceConflict.note}`);
    }
    const key = current.machineKey;
    const identifier = current.machineIdentifier;
    const capability = machineCapabilityFor(identifier);
    const given = (name: string) => args[name] !== undefined;
    const names = ['safe_traverse_z', 'motion_floor_z', 'traverse_without_approval_at_safe_z', 'travel_fudge_mm', 'travel_fudge_x_mm',
        'travel_fudge_y_mm', 'landmark_confirm_ttl_hours'];
    if (!names.some(given)) {
        throw new McpToolError(`Nothing to set: pass one or more of ${names.join(', ')}.`);
    }
    const reason = String(args.reason || '').trim();
    const source = reason ? `set_machine_policy: ${reason}` : 'set_machine_policy';
    const at = Date.now();
    const writes: Array<[string, unknown]> = [];
    const updated: string[] = [];
    const cleared: string[] = [];

    const zArgs: Array<[string, string, 'safeTraverseZ' | 'motionFloorZ']> = [
        ['safe_traverse_z', 'mcpSafeTraverseZ', 'safeTraverseZ'],
        ['motion_floor_z', 'mcpMotionFloorZ', 'motionFloorZ'],
    ];
    if (zArgs.some(([name]) => given(name))) {
        if (!capability.hasZ) {
            throw new McpToolError(`The Z policy does not apply: ${identifier} has no Z axis ${connectedMachineTag()}.`);
        }
        if (!capability.size) {
            throw new McpToolError(`${identifier}: the model size is unknown, so a stated Z cannot be checked against its travel; refusing.`);
        }
        // The model's Z travel. The A350's park Z328 sits above its profile
        // (stagingFrameContext), so its own default stays statable.
        const zMax = identifier === LEGACY_MACHINE_IDENTIFIER ? Math.max(capability.size.z, DEFAULT_SAFE_TRAVERSE_Z) : capability.size.z;
        const zProvenance = { ...(storedProvenance(key, 'mcpZPolicyProvenance') || {}) };
        const before = zPolicyFor(key);
        const after: { [field: string]: number | null } = {};
        for (const [name, configKey, field] of zArgs) {
            if (!given(name)) {
                after[field] = before[field].value;
                continue;
            }
            if (args[name] === null) {
                writes.push([configKey, undefined]);
                delete zProvenance[field];
                cleared.push(name);
                const fallback = field === 'safeTraverseZ' ? DEFAULT_SAFE_TRAVERSE_Z : DEFAULT_MOTION_FLOOR_Z;
                after[field] = hasA350Defaults(identifier) ? fallback : null;
                continue;
            }
            const value = policyNumber(name, args[name], [0, zMax], `machine Z within ${identifier}'s Z travel`, true);
            writes.push([configKey, value]);
            zProvenance[field] = { source, setAt: at };
            updated.push(name);
            after[field] = value;
        }
        if (after.safeTraverseZ !== null && after.motionFloorZ !== null && after.motionFloorZ > after.safeTraverseZ) {
            throw new McpToolError(`motion_floor_z ${after.motionFloorZ} is above safe_traverse_z ${after.safeTraverseZ}: the floor can never `
                + 'be above the park height.');
        }
        writes.push(['mcpZPolicyProvenance', zProvenance]);
    }

    if (given('traverse_without_approval_at_safe_z')) {
        const raw = args.traverse_without_approval_at_safe_z;
        if (raw === null) {
            writes.push(['mcpMachineTraverseWithoutApprovalAtSafeZ', undefined]);
            cleared.push('traverse_without_approval_at_safe_z');
        } else if (typeof raw !== 'boolean') {
            throw new McpToolError('traverse_without_approval_at_safe_z must be true, false or null.');
        } else {
            // TODO(WP1, tyeth/Luban#265): verifiedOnHardware from the dialect table instead of the identifier.
            if (raw && identifier !== LEGACY_MACHINE_IDENTIFIER) {
                throw new McpToolError(`Refusing to turn approval-free transport ON for ${identifier}: only a machine whose motion is verified `
                    + `on hardware (the ${LEGACY_MACHINE_IDENTIFIER}) may skip the confirm page.`);
            }
            writes.push(['mcpMachineTraverseWithoutApprovalAtSafeZ', raw]);
            updated.push('traverse_without_approval_at_safe_z');
        }
    }

    if (FUDGE_ARGS.some(([name]) => given(name))) {
        const fudgeProvenance = { ...(storedProvenance(key, 'mcpTravelFudgeProvenance') || {}) };
        for (const [name, configKey, env, field] of FUDGE_ARGS) {
            if (!given(name)) {
                continue;
            }
            if (String(process.env[env] || '').trim()) {
                throw new McpToolError(`${name} is pinned by the environment variable ${env} on this box; change it there.`);
            }
            if (args[name] === null) {
                writes.push([configKey, undefined]);
                delete fudgeProvenance[field];
                cleared.push(name);
                continue;
            }
            writes.push([configKey, policyNumber(name, args[name], [0, TRAVEL_FUDGE_MAX_MM], 'mm beyond the model box at each end')]);
            fudgeProvenance[field] = { source, setAt: at };
            updated.push(name);
        }
        writes.push(['mcpTravelFudgeProvenance', fudgeProvenance]);
    }

    if (given('landmark_confirm_ttl_hours')) {
        if (args.landmark_confirm_ttl_hours === null) {
            writes.push(['mcpLandmarkConfirmTtlHours', undefined]);
            writes.push(['mcpLandmarkConfirmTtlProvenance', undefined]);
            cleared.push('landmark_confirm_ttl_hours');
        } else {
            writes.push(['mcpLandmarkConfirmTtlHours', policyNumber('landmark_confirm_ttl_hours', args.landmark_confirm_ttl_hours,
                [LANDMARK_CONFIRM_TTL_HOURS.min, LANDMARK_CONFIRM_TTL_HOURS.max], 'hours an operator landmark review stays valid')]);
            writes.push(['mcpLandmarkConfirmTtlProvenance', { source, setAt: at }]);
            updated.push('landmark_confirm_ttl_hours');
        }
    }

    for (const [configKey, value] of writes) {
        if (value === undefined) {
            machineStore.unsetFor(key, configKey);
        } else {
            machineStore.setFor(key, configKey, value);
        }
    }
    return { machineKey: key, updated, cleared, policy: describeMachinePolicy(key) };
}

export function registerMachineTools(registry: ToolRegistry): void {
    registry.register({
        name: 'get_machine_profile',
        description: 'Machine profile: build volume, per-toolhead work ranges, and kinematics '
            + '(which element moves per axis). Defaults to the connected machine, else the one '
            + 'selected in Luban Machine Settings; installed add-on modules (bracing kit, quick-swap) '
            + 'come from those same settings. Read-only.',
        inputSchema: {
            type: 'object',
            properties: {
                identifier: {
                    type: 'string',
                    description: 'Machine identifier, e.g. "Snapmaker 2.0 A350". Omit for the connected machine.',
                },
            },
            additionalProperties: false,
        },
        handler: async (args: { identifier?: string }) => {
            const status = connectionManager.getConnectionStatus();
            const appSettings = readAppMachineSettings();
            const identifier = args.identifier || status.machineIdentifier || (appSettings && appSettings.series) || '';
            if (!identifier) {
                throw new McpToolError('No machine connected, none selected in Luban Machine Settings, and no '
                    + `identifier given. Known identifiers: ${MACHINES.map((m) => m.identifier).join(', ')}`);
            }

            const machine = findMachine(identifier);
            if (!machine) {
                throw new McpToolError(`Unknown machine identifier: ${identifier}. `
                    + `Known identifiers: ${MACHINES.map((m) => m.identifier).join(', ')}`);
            }

            const state = connectionManager.getLatestMachineState();

            // Add-on modules (quick-swap kit, bracing kit) translate the work
            // envelope by workRangeOffset. Which ones are installed cannot be
            // detected from the machine - it is whatever the operator selected
            // in Luban's Machine Settings (readAppMachineSettings).
            const modules = (machine.metadata.modules || []).map((module) => ({
                identifier: module.identifier,
                workRangeOffset: module.workRangeOffset || null,
            }));
            const installedModules = (appSettings ? appSettings.modules : [])
                .filter((id) => modules.some((module) => module.identifier === id));
            const netOffset = [0, 0, 0];
            for (const module of modules) {
                if (installedModules.includes(module.identifier) && module.workRangeOffset) {
                    netOffset[0] += module.workRangeOffset[0];
                    netOffset[1] += module.workRangeOffset[1];
                    netOffset[2] += module.workRangeOffset[2];
                }
            }
            const hasOffset = netOffset.some((v) => v !== 0);

            const capability = machineCapabilityFor(machine.identifier);
            return {
                identifier: machine.identifier,
                fullName: machine.fullName,
                machineType: machine.machineType,
                size: machine.metadata.size,
                /** false on the Ray (size.z 0): no Z axis, so no motion floor, traverse height or move_z - XY runs at the only height. */
                hasZ: capability.hasZ,
                /** The travel the planners allow on this machine: model +/- the travel fudge at each end of each axis. */
                travel: (() => {
                    const fudge = travelFudge(machine.identifier);
                    return { ...modelTravel(machine.metadata.size, fudge), fudgeMm: { x: fudge.x, y: fudge.y }, fudgeSource: fudge.source };
                })(),
                /**
                 * This machine's own policy (per-machine store, set_machine_policy):
                 * the Z policy with where each value came from, the travel
                 * fudge with its source, and whether approval-free transport
                 * applies here at all.
                 */
                policy: describeMachinePolicy(machineStore.keyForIdentifier(machine.identifier)),
                toolHeads: machine.metadata.toolHeads.map((toolHead) => ({
                    identifier: toolHead.identifier,
                    workRange: toolHead.workRange || null,
                    // Luban translates min and max alike by the module offset
                    // (see src/app/flux/printing/index.ts).
                    effectiveWorkRange: hasOffset && toolHead.workRange ? {
                        min: toolHead.workRange.min.map((v, i) => v + netOffset[i]),
                        max: toolHead.workRange.max.map((v, i) => v + netOffset[i]),
                    } : null,
                })),
                modules,
                installedModules,
                installedModulesSource: appSettings ? 'Luban Machine Settings (machine.json)' : 'unavailable - machine.json not found',
                machineSettings: appSettings,
                netWorkRangeOffset: hasOffset ? netOffset : null,
                // null means "not recorded" - do not guess kinematics.
                kinematics: KINEMATICS_BY_IDENTIFIER[machine.identifier] || null,
                connected: identifier === status.machineIdentifier,
                connectedHead: state ? {
                    headType: (state as { headType?: string }).headType || null,
                    toolHead: (state as { toolHead?: string }).toolHead || null,
                } : null,
            };
        },
    });

    registry.register({
        name: 'get_position',
        description: 'The machine POSITION OF RECORD: the judged machine-frame position with its `reliability` '
            + '(verified | heartbeat | cached-offset | awaiting-resync | stale), the frame it rests on, why (`reasons`), '
            + 'plus the raw work-frame report and originOffset, B, homed/idle flags and the report age. `connectedMachine` '
            + 'says which machine this is ({identifier, type, hasZ}): on a machine with hasZ false (the Ray) there is no Z '
            + 'axis, no motion floor and no traverse height - XY moves run at its only height and move_z is refused. Motion '
            + 'and staging refuse unless reliability is verified/heartbeat/cached-offset; awaiting-resync clears on the next '
            + 'coherent beat (2 s). Never compute machine = work - originOffset yourself. Read-only.',
        inputSchema: {
            type: 'object',
            properties: {},
            additionalProperties: false,
        },
        handler: async () => getPositionSnapshot(),
    });

    registry.register({
        name: 'set_machine_policy',
        description: 'Store the CONNECTED machine\'s motion policy in its own entry of the per-machine store (other machines\' '
            + 'entries are never touched). safe_traverse_z = the PARK height procedures hop at and end at; motion_floor_z = the '
            + 'lowest machine Z any XY move over 1 mm may happen at. Both are machine Z, stated from this machine (its home Z / '
            + 'top of travel), never copied from another model. Only the Snapmaker 2.0 A350 has defaults (328 / 320); on any '
            + 'other machine with a Z axis every Z-planning tool refuses until both are stated. Not applicable on a machine with '
            + 'no Z axis (the Ray). traverse_without_approval_at_safe_z can only be turned ON for a machine verified on hardware '
            + '(the A350). travel_fudge_* widen the model box at each end of each axis (default 25 mm). null clears a value. '
            + 'Each value records its source and time; get_machine_profile.policy reads them back.',
        inputSchema: {
            type: 'object',
            properties: {
                safe_traverse_z: { type: ['number', 'null'], description: 'Park height, machine Z. Must be within this machine\'s Z travel.' },
                motion_floor_z: { type: ['number', 'null'], description: 'Lowest machine Z for XY transport; not above safe_traverse_z.' },
                traverse_without_approval_at_safe_z: { type: ['boolean', 'null'], description: 'Approval-free transport at the park height. ON only on a hardware-verified machine.' },
                travel_fudge_mm: { type: ['number', 'null'], description: 'mm beyond the model box at each end of X and Y (default 25).' },
                travel_fudge_x_mm: { type: ['number', 'null'], description: 'Per-axis override of travel_fudge_mm for X.' },
                travel_fudge_y_mm: { type: ['number', 'null'], description: 'Per-axis override of travel_fudge_mm for Y.' },
                landmark_confirm_ttl_hours: {
                    type: ['number', 'null'],
                    description: `How long an operator landmark review stays valid (default ${LANDMARK_CONFIRM_TTL_HOURS.default} h, or until disconnect).`,
                },
                reason: { type: 'string', description: 'Who stated it / how it was measured; stored as the values\' source.' },
            },
            additionalProperties: false,
        },
        handler: async (args: { [key: string]: unknown }) => {
            try {
                return setMachinePolicy(args);
            } catch (err) {
                throw err instanceof McpToolError ? err : new McpToolError((err as Error).message);
            }
        },
    });
}

// The per-machine store reads the live connection (identifier, and WPC's
// deviceSerial / host when present) and, while nothing is connected, the
// machine selected in Luban Machine Settings. Defensive: the inert test
// harnesses hand in a ConnectionManager stub without getConnectionStatus.
setMachineStoreSources({
    status: () => {
        const manager = connectionManager as unknown as { getConnectionStatus?: () => ConnectionStatusLike };
        return typeof manager.getConnectionStatus === 'function' ? manager.getConnectionStatus() : null;
    },
    selectedMachine: () => {
        const settings = readAppMachineSettings();
        return settings && settings.series ? settings.series : null;
    },
});
