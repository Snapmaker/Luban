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
import { LANDMARK_CONFIRM_TTL_HOURS, STEPPER_IDLE_TIMEOUT_S, TOOLHEAD_BODY_BELOW_REFERENCE_MM } from '../procedureLimits';
import { COMPUTED_HEIGHT_TOGGLE, MotionRulesSection, computedHeightTraversePolicy, motionRulesOf, validateClearanceSettings } from '../motionRules';
import {
    MACHINES,
    connectedDialect,
    connectedMachineCapability,
    connectedMachineIdentifier,
    connectedMachineTag,
    connectedToolheadNote,
    describeConnectedMachine,
    findMachine,
    machineCapabilityFor,
} from '../connectedMachine';
import { currentLandmarkReviewGate } from '../safeZPolicy';
import { TraverseMachine } from '../traversePlan';
import { GcodeDialect, dialectById } from '../gcodeDialect';
import { firmwareView } from './firmware';
import { GcodeForm, gcodeFormOf, genericMotionRefusal } from '../gcodeForms';
import { LogicalFrameReport, LogicalFrameTrust, judgeLogicalFrame, machineStatusOf, readLogicalFrameEvidence } from '../logicalFrame';
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
    allFrameLatches,
    otherMachineFrameLatches,
    setFrameLatchMachineSource,
    stickyMachineSource,
} from '../positionOfRecord';
import { describeFrameLatch, resyncHint } from '../frameRecovery';
import { McpToolError, ToolRegistry } from '../registry';
import { OperatorReviewStore, escapeHtml } from '../operatorReviews';
import logger from '../../../lib/logger';

export { machineStatusOf } from '../logicalFrame';

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
 * The dialect generic motion is written in: the connected machine's row, or
 * the Snapmaker 2.0 row when NO machine identifier is known (the A350 as the
 * MCP always assumed - zPolicyFor treats null the same way; the test harness's
 * ConnectionManager stub has no getConnectionStatus). A connected machine the
 * table does not list gets the 'unknown' row, which emits nothing.
 */
export function motionDialect(): GcodeDialect {
    return connectedMachineIdentifier() === null ? dialectById('sm2-marlin') : connectedDialect();
}

/**
 * The transport traits of the CONNECTED machine for the XY planners
 * (traversePlan.ts TraverseMachine): whether it has a Z axis, and which
 * gcode form its firmware is known to execute. A GRBL-flavoured machine (the
 * Ray, gcodeFlavor 'grbl' in its definition) gets Luban's own relative jog
 * form; everything else keeps the Snapmaker 2.0 own-line G53 / G54 steps.
 */
export function traverseMachine(action: string = 'this motion'): TraverseMachine {
    const capability = connectedMachineCapability();
    const dialect = motionDialect();
    const refusal = genericMotionRefusal(dialect, action);
    if (refusal) {
        throw new McpToolError(`${refusal} ${connectedMachineTag()}`);
    }
    // Derived from the dialect row (gcodeDialect.ts transportForm): the Ray,
    // the Original and the J1 take relative steps, the Snapmaker 2.0 and the
    // Artisan absolute steps in the declared frame. The two literals are #264's.
    return { hasZ: capability.hasZ, gcode: gcodeFormOf(dialect) === 'relative-steps' ? 'grbl-relative' : 'snapmaker-2', dialect };
}


/** `gcode_form` for tool results: 'sm2' | 'relative-steps' (throws, naming the machine, where nothing is emitted). */
export function motionGcodeForm(): GcodeForm {
    const dialect = motionDialect();
    try {
        return gcodeFormOf(dialect);
    } catch (err) {
        throw new McpToolError(`${(err as Error).message} ${connectedMachineTag()}`);
    }
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

/** The per-machine toggle's name on Settings -> MCP Server -> Motion rules (and in every reason that points there). */
export const MOTION_RULE_TOGGLE = 'Move at safe top Z without approval';
const MOTION_RULES_PANE = 'Settings > MCP > Motion rules';
/** The provenance source the Settings pane writes; nothing on the MCP tool surface may write it. */
export const MOTION_RULE_SETTINGS_SOURCE = 'settings';

export interface MotionRuleEligibility {
    /** Whether the Motion rules toggle can be turned ON for this machine at all. */
    eligible: boolean;
    /** Why not, or null when eligible. */
    reason: string | null;
}

/**
 * Whether `machineKey` may move at safe top Z without approval once the
 * operator allows it (operator ruling 2026-10-19, tyeth/Luban#265 WP9): the
 * 2.0-family absolute transport (gcodeDialect.ts transportForm 'sm2': A150 /
 * A250 / A350 and the Artisan), a Z axis and a stated Z policy (the A350 has
 * defaults). A relative-step machine (Ray, Original, J1) has no top-Z
 * transport to skip a click for. Evaluated on every gate read, so clearing a
 * machine's Z policy takes its toggle back out of force.
 */
export function motionRuleEligibility(machineKey: string | null): MotionRuleEligibility {
    if (machineKey === null) {
        return { eligible: false, reason: 'no machine is connected or selected' };
    }
    const identifier = baseIdentifier(machineKey);
    const capability = machineCapabilityFor(identifier);
    const form = capability.dialect ? capability.dialect.transportForm : 'none';
    if (form === 'relative-steps') {
        return { eligible: false, reason: 'relative-step machine: every move is staged' };
    }
    if (form !== 'sm2') {
        return {
            eligible: false,
            reason: `no known transport form (dialect ${capability.dialect ? capability.dialect.id : 'unknown'}): every move is staged`,
        };
    }
    if (!capability.hasZ) {
        return { eligible: false, reason: 'no Z axis, so there is no safe top Z: every move is staged' };
    }
    const policy = zPolicyFor(machineKey);
    if (policy.missing.length) {
        return { eligible: false, reason: `no ${policy.missing.join(' / ')} is stated: state both heights with set_machine_policy first` };
    }
    return { eligible: true, reason: null };
}

/** The per-machine flag and who set it: the stored value, else ON for the A350 and OFF for every other machine. */
function machineTraverseFlag(machineKey: string | null): { value: boolean; stored: boolean | null; source: string; setAt: number | null } {
    const identifier = machineKey === null ? null : baseIdentifier(machineKey);
    const stored = parseSwitch(machineKey === null ? undefined : machineStore.getFor(machineKey, 'mcpMachineTraverseWithoutApprovalAtSafeZ'));
    const provenance = storedProvenance(machineKey, 'mcpZPolicyProvenance');
    const stated = provenance && provenance.traverseWithoutApprovalAtSafeZ;
    if (stored === null) {
        return { value: identifier === LEGACY_MACHINE_IDENTIFIER && DEFAULT_TRAVERSE_WITHOUT_APPROVAL_AT_SAFE_Z, stored, source: 'default', setAt: null };
    }
    return { value: stored, stored, source: (stated && stated.source) || 'config', setAt: (stated && stated.setAt) || null };
}

export interface TraverseApproval {
    /** What the motion tools honour: the setting AND the machine gate. */
    enabled: boolean;
    /** The setting before the gate. */
    setting: boolean;
    /** env > host switch OFF > this machine's flag (Motion rules / set_machine_policy) > host switch ON > default. */
    source: 'env' | 'host-setting' | 'machine' | 'default';
    /** Why the gate holds approval-free transport off on this machine, or null when it does not. */
    gatedBy: string | null;
    /** The machine's Motion rules toggle: its value, who set it ('settings' = the operator's click) and when. */
    machineFlag: { value: boolean; source: string; setAt: number | null };
    eligibility: MotionRuleEligibility;
}

/**
 * Approval-free transport for `machineKey` (default: the current machine):
 * host switch ON (env > configstore > default) AND this machine's Motion
 * rules toggle ON AND the machine eligible (motionRuleEligibility), and never
 * while a device conflict (machineStore.ts) leaves the records unconfirmed.
 * The host switch OFF wins over any machine. The A350's toggle defaults ON
 * (unchanged since #241); every other eligible machine (A150, A250, Artisan)
 * stays OFF until the operator turns it on in Settings - set_machine_policy
 * can turn it off but never on there (R9 still holds for the agent).
 */
export function traverseWithoutApprovalPolicy(machineKey?: string | null): TraverseApproval {
    const current = machineStore.currentMachine();
    const key = machineKey === undefined ? current.machineKey : machineKey;
    const identifier = key === null ? null : baseIdentifier(key);
    const a350 = identifier === LEGACY_MACHINE_IDENTIFIER;
    let setting: boolean;
    let source: TraverseApproval['source'];
    const env = parseSwitch(process.env.LUBAN_MCP_TRAVERSE_WITHOUT_APPROVAL_AT_SAFE_Z);
    const host = parseSwitch(config.get('mcpTraverseWithoutApprovalAtSafeZ'));
    const flag = machineTraverseFlag(key);
    const operatorOff = flag.stored === false && flag.source === MOTION_RULE_SETTINGS_SOURCE;
    if (env !== null && !(env && operatorOff)) {
        // The env pin is the host switch: it can never turn ON a machine the
        // operator turned OFF on the Motion rules pane.
        [setting, source] = [env, 'env'];
    } else if (host === false) {
        [setting, source] = [false, 'host-setting'];
    } else if (flag.stored !== null) {
        [setting, source] = [flag.stored, 'machine'];
    } else if (!a350) {
        [setting, source] = [false, 'default'];
    } else if (host !== null) {
        [setting, source] = [host, 'host-setting'];
    } else {
        [setting, source] = [DEFAULT_TRAVERSE_WITHOUT_APPROVAL_AT_SAFE_Z, 'default'];
    }
    const eligibility = motionRuleEligibility(key);
    let gatedBy: string | null = null;
    if (!eligibility.eligible) {
        gatedBy = `${identifier || 'no machine'}: ${eligibility.reason}`;
    } else if (!a350 && !(flag.value && flag.source === MOTION_RULE_SETTINGS_SOURCE)) {
        // Off the A350 only the operator's click in Settings turns it on - an
        // env pin or a hand-edited store does not.
        gatedBy = `enable '${MOTION_RULE_TOGGLE}' for ${key} in ${MOTION_RULES_PANE} to move at safe top Z without approval`;
    } else if (key === current.machineKey && current.deviceConflict) {
        gatedBy = `device conflict: ${current.deviceConflict.note}`;
    }
    return {
        enabled: setting && gatedBy === null,
        setting,
        source,
        gatedBy,
        machineFlag: { value: flag.value, source: flag.source, setAt: flag.setAt },
        eligibility,
    };
}

/** What traverse_xy / goto_tool_change_position / move_z honour (safeZPolicy.ts). */
export function traverseWithoutApprovalAtSafeZ(): boolean {
    return traverseWithoutApprovalPolicy().enabled;
}

/**
 * The safeZPolicy inputs for the current machine: whether approval-free
 * transport is on, and when it is off, why - in the words of the Motion
 * rules pane (the machine gate, else the host switch), never the config key.
 */
export function safeZApprovalInput(): { enabled: boolean; gatedBy: string | null } {
    const policy = traverseWithoutApprovalPolicy();
    if (policy.enabled) {
        return { enabled: true, gatedBy: null };
    }
    if (policy.gatedBy) {
        return { enabled: false, gatedBy: policy.gatedBy };
    }
    let where = `'${MOTION_RULE_TOGGLE}' is off for this machine (${MOTION_RULES_PANE})`;
    if (policy.source === 'env') {
        where = 'pinned off by LUBAN_MCP_TRAVERSE_WITHOUT_APPROVAL_AT_SAFE_Z';
    } else if (policy.source === 'host-setting') {
        where = `the host-wide switch is off (${MOTION_RULES_PANE})`;
    }
    return { enabled: false, gatedBy: `moving at safe top Z without approval: ${where}` };
}

/** The landmark review validity of the current machine (R4; WP5 reads it). */
export function landmarkConfirmTtlHours(machineKey: string | null = machineStore.currentMachine().machineKey): { hours: number; source: string } {
    const raw = Number(machineKey === null ? undefined : machineStore.getFor(machineKey, 'mcpLandmarkConfirmTtlHours'));
    if (Number.isFinite(raw) && raw >= LANDMARK_CONFIRM_TTL_HOURS.min && raw <= LANDMARK_CONFIRM_TTL_HOURS.max) {
        return { hours: raw, source: 'set_machine_policy' };
    }
    return { hours: LANDMARK_CONFIRM_TTL_HOURS.default, source: 'default' };
}

/** Only the Original releases its steppers on idle (logicalFrame.ts header); the policy applies to it alone. */
function releasesSteppersOnIdle(identifier: string | null): boolean {
    return identifier !== null && machineCapabilityFor(identifier).dialect.id === 'original-marlin';
}

/**
 * The stepper idle timeout of a machine (#265 follow-up; logicalFrame.ts),
 * with its source: stated with set_machine_policy, else the upstream Marlin
 * default (procedureLimits STEPPER_IDLE_TIMEOUT_S - not measured on the
 * Original). Null on every machine that does not release its steppers on idle.
 */
export function stepperIdleTimeout(machineKey: string | null = machineStore.currentMachine().machineKey): { seconds: number; source: string } | null {
    if (machineKey === null || !releasesSteppersOnIdle(baseIdentifier(machineKey))) {
        return null;
    }
    const raw = Number(machineStore.getFor(machineKey, 'mcpStepperIdleTimeoutS'));
    if (Number.isFinite(raw) && raw >= STEPPER_IDLE_TIMEOUT_S.min && raw <= STEPPER_IDLE_TIMEOUT_S.max) {
        return { seconds: raw, source: 'set_machine_policy stepper_idle_timeout_s' };
    }
    return {
        seconds: STEPPER_IDLE_TIMEOUT_S.default,
        source: `the upstream Marlin firmware default (DEFAULT_STEPPER_DEACTIVE_TIME ${STEPPER_IDLE_TIMEOUT_S.default} s, Marlin 1.1.x `
            + 'Configuration_adv.h) - NOT measured on the Original; state the measured value with set_machine_policy stepper_idle_timeout_s',
    };
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
    /**
     * USB text serial only (null elsewhere): whether the controller's LOGICAL
     * M114 position is taken as the machine position (logicalFrame.ts), and
     * why. Untrusted = the position is refused with `reason` (home first, a
     * G92 since the home, a machine with workspaces...).
     */
    logicalFrame?: LogicalFrameTrust | null;
    /**
     * USB text serial only (null elsewhere): the newest report's M114 was
     * written after a planner sync that followed the last motion line, so the
     * head was at rest at it. false = it may be the planner's queued target.
     * A Snapmaker 2.0 over USB: its Count agreed with the mapped position
     * (logicalFrame.atRest) - the steppers are at the planner's target.
     */
    motionAtRest?: boolean | null;
    /**
     * The Original over USB only (null elsewhere): seconds until its steppers
     * may be released on idle and the home is treated as lost (0 = lost, null
     * = never: M84 S0, or no home yet). logicalFrame.stepperIdle has the timeout and its source.
     */
    // eslint-disable-next-line camelcase
    stepper_idle_remaining_s?: number | null;
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

/** The on-disk form since #265 WP8: every machine's latch, keyed by the machine it was raised on. */
export interface PersistedFrameLatches {
    version: 2;
    latches: FrameLatch[];
}

/**
 * Writes EVERY machine's latch (positionOfRecord.allFrameLatches), not just
 * the one that applies now: an A350 latch must survive a session on the
 * Original.
 */
export function persistFrameLatch(latches: FrameLatch[] = allFrameLatches()): void {
    const file = frameLatchPath();
    if (!file) { return; }
    try {
        if (latches.length) {
            const temp = `${file}.tmp`;
            const data: PersistedFrameLatches = { version: 2, latches };
            fs.writeFileSync(temp, `${JSON.stringify(data)}\n`);
            fs.renameSync(temp, file);
        } else if (fs.existsSync(file)) {
            fs.removeSync(file);
        }
    } catch (err) {
        // The in-memory latch still refuses motion; only the carry-over across a restart is at risk.
        log.warn(`Could not ${latches.length ? 'write' : 'remove'} the frame latch file ${file}: ${(err as Error).message}`);
    }
}

/** The on-disk latch file: null when no file, its content when readable, 'unreadable' when it exists but cannot be read or parsed. */
export function readPersistedFrameLatch(): Partial<FrameLatch> | Partial<PersistedFrameLatches> | 'unreadable' | null {
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

/**
 * Pure: the latches a saved file stands for, each with the machine it binds.
 * A pre-WP8 file is ONE untagged latch: it was raised on the A350 (the only
 * machine the MCP drove before latches were per machine), so it migrates as
 * the A350's. An UNREADABLE file cannot say which machine it was raised on,
 * and unknown is conservative (#265 WP10): it raises a latch of its own for
 * EVERY machine in `knownMachines` (the per-machine store) - each cleared only
 * by that machine's own verified restore - plus an unscoped one (null) for
 * machines not known yet, which releases each such machine on its own restore
 * and goes once no machine's own latch is left (positionOfRecord.clearFrameLatch).
 */
export function persistedFrameLatches(
    saved: ReturnType<typeof readPersistedFrameLatch>,
    knownMachines: string[] = [],
    now: number = Date.now()
): Array<{ machineIdentifier: string | null; reason: string }> {
    const carried = (reason: unknown) => `Carried over from before Luban restarted: ${String(reason || 'a queued pendant run')} `
        + 'Restore the work frame before any motion.';
    if (saved === null) {
        return [];
    }
    if (saved === 'unreadable') {
        const at = new Date(now).toISOString();
        const reason = (whom: string) => `Carried over from before Luban restarted: latch file unreadable at ${at} - an unreadable latch `
            + `file (${FRAME_LATCH_FILE}) cannot say which machine's workspace may have been left selected, so it binds ${whom}. `
            + 'Restore the work frame on this machine before any motion.';
        const unique = knownMachines.filter((id, i) => id && knownMachines.indexOf(id) === i);
        return [
            ...unique.map((id) => ({ machineIdentifier: id, reason: reason(`every machine the MCP knows, ${id} included`) })),
            { machineIdentifier: null, reason: reason('every machine not known yet as well') },
        ];
    }
    const latches = Array.isArray((saved as Partial<PersistedFrameLatches>).latches)
        ? (saved as PersistedFrameLatches).latches
        : [saved as Partial<FrameLatch>];
    return latches.filter((latch) => latch && typeof latch === 'object').map((latch) => ({
        machineIdentifier: latch.machineIdentifier === undefined ? LEGACY_MACHINE_IDENTIFIER : latch.machineIdentifier,
        reason: carried(latch.reason),
    }));
}

/** Every machine identifier the per-machine store knows (an unreadable latch file binds each); [] when it cannot be read. */
function knownMachineIdentifiers(): string[] {
    try {
        return Object.keys(machineStore.load().machines).map((key) => baseIdentifier(key));
    } catch (err) {
        return [];
    }
}

export function restorePersistedFrameLatch(): void {
    const saved = readPersistedFrameLatch();
    if (saved === 'unreadable') {
        log.warn(`The frame latch file ${frameLatchPath()} exists but could not be read: raising a latch for every known machine and one for machines not known yet.`);
    }
    for (const latch of persistedFrameLatches(saved, saved === 'unreadable' ? knownMachineIdentifiers() : [])) {
        latchFrameUncertain(latch.reason, Date.now(), latch.machineIdentifier);
    }
}

// The latch belongs to the machine it is raised on (positionOfRecord.ts):
// stamp it with the connected identifier. Set before the restore below, which
// names its machines itself.
setFrameLatchMachineSource(stickyMachineSource(() => connectedMachineIdentifier()));

// Persist every change; the lease's recovery hold needs no update because it
// reads the latch itself (machine/gcodeLease.ts).
onFrameLatchChange(() => persistFrameLatch());
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
        // #265 WP8: latches raised on other machines - ignored here, kept for their own machine.
        frameUncertainOtherMachines: otherMachineFrameLatches(),
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
 * Text serial: the head is at rest at the newest report. A Snapmaker 2.0:
 * its Count agreed with the mapped position (logicalFrame.atRest). The
 * Original: the report's M114 followed a planner sync (reportAtRest).
 */
function logicalMotionAtRest(logicalFrame: LogicalFrameTrust, state: { [key: string]: unknown }): boolean {
    if (logicalFrame.mapping === 'work-offset') {
        return logicalFrame.atRest === true;
    }
    return state.reportAtRest === true;
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
    // USB text serial reports the LOGICAL position: it is the machine position
    // on the Original homed on this connection with no shift written since and
    // its steppers not idle past their timeout, and on a Snapmaker 2.0 through
    // a fresh M1007 work offset its stepper Count agrees with
    // (logicalFrame.ts). Otherwise the judge refuses it.
    const logicalFrame = (state as { positionFrame?: unknown }).positionFrame === 'logical'
        ? judgeLogicalFrame(connectedDialect(), readLogicalFrameEvidence((state as { frameEvidence?: unknown }).frameEvidence), {
            now,
            report: { pos: state.pos as LogicalFrameReport['pos'], counts: (state as { counts?: unknown }).counts as LogicalFrameReport['counts'] },
            stepperIdleTimeout: stepperIdleTimeout(),
        })
        : null;
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
            logicalAsMachine: logicalFrame !== null && logicalFrame.trusted,
            logicalOffset: logicalFrame && logicalFrame.trusted && logicalFrame.mapping === 'work-offset' ? logicalFrame.offset : null,
            logicalFrameReason: logicalFrame && !logicalFrame.trusted ? logicalFrame.reason : null,
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
        // Text serial: homed only when the MCP OBSERVED a full home complete on
        // this connection (logicalFrame.ts) - never MarlinController's
        // isHomed, which a SENT G28 sets.
        isHomed: logicalFrame ? logicalFrame.homed : (state as { isHomed?: boolean }).isHomed ?? null,
        machineStatus: machineStatusOf(state as { [key: string]: unknown }),
        reportAgeMs: now - state.timestamp,
        reportedAt: state.timestamp,
        convention: 'machine = the JUDGED position of record (machinePosition.ts) with `reliability`; work/originOffset are the '
            + 'raw report - never derive machine = work - originOffset by hand. Agents plan in machine coordinates; the work '
            + 'origin is the operator\'s.',
        warnings: [...judgement.reasons, ...frameWarnings],
        logicalFrame,
        motionAtRest: logicalFrame ? logicalMotionAtRest(logicalFrame, state) : null,
        stepper_idle_remaining_s: logicalFrame && logicalFrame.stepperIdle ? logicalFrame.stepperIdle.remainingS : null,
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
export function assertFreshHeartbeat(what: string, options: { homing?: boolean } = {}): void {
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
    const snapshot = getPositionSnapshot();
    // Only where a home CAN make the logical frame the machine frame (the
    // Original; a Snapmaker 2.0 through its M1007 offset); a Ray or an
    // Artisan on plain-text USB stays refused.
    if (options.homing === true && snapshot.logicalFrame && snapshot.logicalFrame.mappable && !snapshot.logicalFrame.trusted) {
        // Homing is what ESTABLISHES a logical-frame position (the Original):
        // refusing it for lacking one would be circular. The beat is fresh;
        // a frame latch still refuses, as for every other motion.
        const latch = getFrameLatch();
        if (latch) {
            throw new McpToolError(`Refusing ${what}: ${describeFrameLatch(latch)}`);
        }
        return;
    }
    requireReliableMachine(snapshot, what);
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
        // Null on every machine that never releases its steppers on idle (all but the Original).
        stepperIdleTimeout: stepperIdleTimeout(machineKey),
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

// ---- Loosening a stated safety bound needs the operator (#265 WP10, R11 spirit) ----
//
// R11: "landmarks are temporary but only a human removes them" - loosening one
// is staged for the operator. The same holds for the per-machine bounds
// set_machine_policy writes: lowering safe_traverse_z or motion_floor_z,
// widening a travel fudge, a shallower toolhead body (the computed safe height
// of R13 comes lower), a longer landmark-confirmation validity or a longer
// stepper idle timeout (the Original's home is trusted for longer). Such a
// change is staged on an operator review page (/confirm/r<id>, the WP5 store)
// and applied on the operator's click, after the store re-checks the machine
// and this module re-checks that the value is still the one the page showed.
// Tightening, clearing to unknown (the tools then refuse) and a first
// statement on a machine with no value apply at once as before. The A350's
// built-in 328 / 320 and every default count as stated values.

const POLICY_ARGS = ['safe_traverse_z', 'motion_floor_z', 'traverse_without_approval_at_safe_z', 'travel_fudge_mm', 'travel_fudge_x_mm',
    'travel_fudge_y_mm', 'landmark_confirm_ttl_hours', 'traverse_without_approval_at_computed_height', 'toolhead_body_below_reference_mm',
    'stepper_idle_timeout_s'];

let policyReviews: OperatorReviewStore | null = null;
let policyReviewBaseUrl: () => string = () => '';

/** Injected by landmarkReviewState.ts (the store behind /confirm/r<id>); null unsets (tests). */
export function setMachinePolicyReviews(store: OperatorReviewStore | null, confirmBaseUrl: () => string = () => ''): void {
    policyReviews = store;
    policyReviewBaseUrl = confirmBaseUrl;
}

/** What set_machine_policy returns: what it applied now and, when it loosens a bound, the staged page. */
export interface MachinePolicyResult {
    machineKey: string;
    updated: string[];
    cleared: string[];
    policy: ReturnType<typeof describeMachinePolicy> | null;
    staged?: object;
    // eslint-disable-next-line camelcase
    staged_because?: string;
    // eslint-disable-next-line camelcase
    next_step?: string;
}

/** Which way a bound loosens. */
export type BoundDirection = 'lower-loosens' | 'higher-loosens';

/**
 * Pure: whether moving a bound from `before` to `after` loosens it. No stated
 * value before (a first statement) or none after (cleared: the tools that need
 * it refuse) never does.
 */
export function loosensBound(direction: BoundDirection, before: number | null, after: number | null): boolean {
    if (before === null || after === null || !Number.isFinite(before) || !Number.isFinite(after)) {
        return false;
    }
    return direction === 'lower-loosens' ? after < before : after > before;
}

export interface PolicyLoosening {
    /** The bound ('travel_fudge_x' / '_y' for the per-axis fudge the fudge arguments resolve to). */
    name: string;
    /** The set_machine_policy arguments that move it (staged together). */
    args: string[];
    before: number;
    after: number;
    why: string;
}

/** The bound as it applies to the connected machine now (what a staged page is re-checked against). */
function boundNow(key: string, name: string): number | null {
    switch (name) {
        case 'safe_traverse_z': return zPolicyFor(key).safeTraverseZ.value;
        case 'motion_floor_z': return zPolicyFor(key).motionFloorZ.value;
        case 'travel_fudge_x': return travelFudge().x;
        case 'travel_fudge_y': return travelFudge().y;
        case 'landmark_confirm_ttl_hours': return landmarkConfirmTtlHours(key).hours;
        case 'stepper_idle_timeout_s': {
            const timeout = stepperIdleTimeout(key);
            return timeout ? timeout.seconds : null;
        }
        case 'toolhead_body_below_reference_mm': {
            const body = motionRulesOf({ motionRules: machineStore.getFor(key, 'mcpMotionRules') }).toolheadBodyBelowReferenceMm;
            return body ? body.value : null;
        }
        default: return null;
    }
}

/** Every bound this (already validated) call would loosen on the connected machine. */
function policyLoosenings(key: string, identifier: string, args: { [key: string]: unknown }): PolicyLoosening[] {
    const given = (name: string) => args[name] !== undefined;
    const out: PolicyLoosening[] = [];
    const add = (name: string, moved: string[], direction: BoundDirection, after: number | null, why: string) => {
        const before = boundNow(key, name);
        if (loosensBound(direction, before, after)) {
            out.push({ name, args: moved, before: before as number, after: after as number, why });
        }
    };
    const stated = (name: string): number | null => (args[name] === null ? null : Number(args[name]));
    if (given('safe_traverse_z')) {
        add('safe_traverse_z', ['safe_traverse_z'], 'lower-loosens',
            args.safe_traverse_z === null && hasA350Defaults(identifier) ? DEFAULT_SAFE_TRAVERSE_Z : stated('safe_traverse_z'),
            'a lower park / top height lets transport and the approval-free top-Z moves run lower');
    }
    if (given('motion_floor_z')) {
        add('motion_floor_z', ['motion_floor_z'], 'lower-loosens',
            args.motion_floor_z === null && hasA350Defaults(identifier) ? DEFAULT_MOTION_FLOOR_Z : stated('motion_floor_z'),
            'a lower floor lets XY transport (law 2) and the computed safe height run lower');
    }
    const fudgeArgs = FUDGE_ARGS.filter(([name]) => given(name));
    if (fudgeArgs.length) {
        const after = (name: string, env: string, configKey: string): number | null => {
            if (given(name)) {
                return stated(name);
            }
            const setting = fudgeSetting(env, configKey, key);
            return setting ? setting.value : null;
        };
        const [common, x, y] = FUDGE_ARGS.map(([name, configKey, env]) => after(name, env, configKey));
        const moved = fudgeArgs.map(([name]) => name);
        const why = 'a wider fudge admits targets further beyond the model travel';
        const fallback = common !== null ? common : DEFAULT_TRAVEL_FUDGE_MM;
        add('travel_fudge_x', moved, 'higher-loosens', x !== null ? x : fallback, why);
        add('travel_fudge_y', moved, 'higher-loosens', y !== null ? y : fallback, why);
    }
    if (given('landmark_confirm_ttl_hours')) {
        add('landmark_confirm_ttl_hours', ['landmark_confirm_ttl_hours'], 'higher-loosens',
            args.landmark_confirm_ttl_hours === null ? LANDMARK_CONFIRM_TTL_HOURS.default : stated('landmark_confirm_ttl_hours'),
            'a longer validity keeps an operator landmark confirmation in force longer');
    }
    if (given('stepper_idle_timeout_s')) {
        add('stepper_idle_timeout_s', ['stepper_idle_timeout_s'], 'higher-loosens',
            args.stepper_idle_timeout_s === null ? STEPPER_IDLE_TIMEOUT_S.default : stated('stepper_idle_timeout_s'),
            'a longer timeout keeps trusting the Original\'s home through a longer idle, when its steppers may already be released');
    }
    if (given('toolhead_body_below_reference_mm')) {
        add('toolhead_body_below_reference_mm', ['toolhead_body_below_reference_mm'], 'lower-loosens', stated('toolhead_body_below_reference_mm'),
            'a shallower toolhead body lets the computed safe height (R13) come lower');
    }
    return out;
}

/** Stage the loosening part of a set_machine_policy call for the operator; apply the rest now. */
function stagePolicyLoosening(args: { [key: string]: unknown }, loose: PolicyLoosening[]): MachinePolicyResult {
    const current = machineStore.currentMachine();
    const key = current.machineKey as string;
    const listed = loose.map((l) => `${l.name} ${l.before} -> ${l.after}`).join(', ');
    if (!policyReviews) {
        throw new McpToolError(`Refusing: ${listed} would LOOSEN a stated safety bound on ${key}, which only the operator may approve, `
            + 'and the operator review pages are not available in this build. Nothing was changed.');
    }
    const stagedNames = new Set(loose.reduce((all: string[], l) => all.concat(l.args), []));
    const withReason = (names: string[]) => {
        const picked: { [key: string]: unknown } = {};
        for (const name of names) {
            picked[name] = args[name];
        }
        if (args.reason !== undefined) {
            picked.reason = args.reason;
        }
        return picked;
    };
    const restNames = POLICY_ARGS.filter((name) => args[name] !== undefined && !stagedNames.has(name));
    let stagedArgs = withReason(POLICY_ARGS.filter((name) => stagedNames.has(name) && args[name] !== undefined));
    let immediate: MachinePolicyResult | null = null;
    let immediateNote: string | null = null;
    if (restNames.length) {
        try {
            // eslint-disable-next-line @typescript-eslint/no-use-before-define
            immediate = setMachinePolicy(withReason(restNames));
        } catch (err) {
            // The tightening half alone does not validate (e.g. a floor raised
            // above the park height that the same call lowers): nothing is
            // applied now and the whole call goes on the page instead.
            immediateNote = `the rest of the call does not stand on its own (${(err as Error).message}), so the whole call is staged`;
            stagedArgs = withReason(POLICY_ARGS.filter((name) => args[name] !== undefined));
        }
    }
    const rows = loose.map((l) => `<tr><td>${escapeHtml(l.name)}</td><td>${l.before}</td><td><strong>${l.after}</strong></td>`
        + `<td>${escapeHtml(l.why)}</td></tr>`).join('');
    let id = '';
    const item = policyReviews.stage({
        kind: 'policy-loosen',
        title: `loosen ${loose.map((l) => l.name).join(', ')}`,
        machineKey: key,
        subject: 'machine-policy',
        bodyHtml: '<p>An agent asks to LOOSEN a stated safety bound of this machine with set_machine_policy'
            + `${args.reason ? ` (reason: <em>${escapeHtml(String(args.reason))}</em>)` : ''}. It applies only if you approve.</p>`
            + `<table border="1" cellpadding="6" style="border-collapse:collapse"><tr><th>Bound</th><th>Now</th><th>Requested</th><th>Effect</th></tr>${rows}</table>`
            + `<p>Arguments applied on approval: <code>${escapeHtml(JSON.stringify(stagedArgs))}</code></p>`,
        summary: { loosens: loose, args: stagedArgs },
        precondition: () => {
            const now = machineStore.currentMachine();
            if (now.deviceConflict) {
                return `a device conflict is open (${now.deviceConflict.note})`;
            }
            for (const l of loose) {
                const value = boundNow(key, l.name);
                if (value !== l.before) {
                    return `${l.name} is ${value === null ? 'not stated' : value} now, not the ${l.before} this page showed`;
                }
            }
            return null;
        },
        // eslint-disable-next-line @typescript-eslint/no-use-before-define
        apply: () => setMachinePolicy(stagedArgs, { approvedReview: id }),
    });
    id = item.id;
    return {
        machineKey: key,
        updated: immediate ? immediate.updated : [],
        cleared: immediate ? immediate.cleared : [],
        staged: policyReviews.describe(item, policyReviewBaseUrl()),
        staged_because: `${listed} would LOOSEN a stated safety bound (${loose.map((l) => l.why).join('; ')}): only the operator approves `
            + `that (#265 R11). Those fields are unchanged until they do${immediateNote ? `; ${immediateNote}` : ''}.`,
        next_step: 'Ask the operator to open staged.confirm_url and approve; the change applies on their click, after re-checking that '
            + 'this machine is connected and the values are still the ones the page showed.',
        policy: describeMachinePolicy(key),
    };
}

function machinePolicyCall(args: { [key: string]: unknown }, options: { dryRun?: boolean; approvedReview?: string }): MachinePolicyResult {
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
    if (!POLICY_ARGS.some(given)) {
        throw new McpToolError(`Nothing to set: pass one or more of ${POLICY_ARGS.join(', ')}.`);
    }
    const reason = String(args.reason || '').trim();
    const approved = options.approvedReview ? ` (approved by the operator, review ${options.approvedReview})` : '';
    const source = `${reason ? `set_machine_policy: ${reason}` : 'set_machine_policy'}${approved}`;
    const at = Date.now();
    const writes: Array<[string, unknown]> = [];
    const updated: string[] = [];
    const cleared: string[] = [];
    // One provenance object for the Z heights and the approval flag, written once below.
    const zProvenance = { ...(storedProvenance(key, 'mcpZPolicyProvenance') || {}) };
    let zProvenanceChanged = false;

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
        zProvenanceChanged = true;
    }

    if (given('traverse_without_approval_at_safe_z')) {
        const raw = args.traverse_without_approval_at_safe_z;
        if (raw !== null && typeof raw !== 'boolean') {
            throw new McpToolError('traverse_without_approval_at_safe_z must be true, false or null.');
        }
        // The agent may always turn it OFF. ON (or null, which is ON again on
        // the A350) only where the A350 default applies - the one machine whose
        // motion is verified on hardware (R9) - and never over the operator's
        // own OFF from Settings -> MCP -> Motion rules. Any other machine is
        // turned on there by the operator, never here.
        const flag = machineTraverseFlag(key);
        const operatorOff = flag.stored === false && flag.source === MOTION_RULE_SETTINGS_SOURCE;
        if (raw === true && identifier !== LEGACY_MACHINE_IDENTIFIER) {
            throw new McpToolError(`Refusing to turn approval-free transport ON for ${identifier}: off the ${LEGACY_MACHINE_IDENTIFIER} (the `
                + `machine verified on hardware) only the operator can enable '${MOTION_RULE_TOGGLE}', in ${MOTION_RULES_PANE}.`);
        }
        if (raw !== false && operatorOff && identifier === LEGACY_MACHINE_IDENTIFIER) {
            throw new McpToolError(`Refusing to turn approval-free transport back ON for ${key}: the operator turned '${MOTION_RULE_TOGGLE}' `
                + `OFF in ${MOTION_RULES_PANE}; only they can turn it on again there.`);
        }
        if (raw === false && operatorOff) {
            // Already off by the operator's click: keep their provenance, so a
            // later agent ON stays refused.
        } else if (raw === null) {
            writes.push(['mcpMachineTraverseWithoutApprovalAtSafeZ', undefined]);
            delete zProvenance.traverseWithoutApprovalAtSafeZ;
            cleared.push('traverse_without_approval_at_safe_z');
        } else {
            writes.push(['mcpMachineTraverseWithoutApprovalAtSafeZ', raw]);
            zProvenance.traverseWithoutApprovalAtSafeZ = { source, setAt: at };
            updated.push('traverse_without_approval_at_safe_z');
        }
        zProvenanceChanged = true;
    }
    if (zProvenanceChanged) {
        writes.push(['mcpZPolicyProvenance', zProvenance]);
    }

    // Motion rules R13 (motionRules.ts). The computed-height toggle: an agent
    // may only turn it OFF, on any machine - the operator turns it on in
    // Settings. The toolhead body offset is agent-measurable, so it is stated
    // here like every other measured machine value.
    if (given('traverse_without_approval_at_computed_height') || given('toolhead_body_below_reference_mm')) {
        const rules: MotionRulesSection = { ...motionRulesOf({ motionRules: machineStore.getFor(key, 'mcpMotionRules') }) };
        if (given('traverse_without_approval_at_computed_height')) {
            const raw = args.traverse_without_approval_at_computed_height;
            if (raw === true) {
                throw new McpToolError(`Refusing to turn '${COMPUTED_HEIGHT_TOGGLE}' ON for ${key}: only the operator can, in ${MOTION_RULES_PANE}.`);
            }
            if (raw !== false && raw !== null) {
                throw new McpToolError('traverse_without_approval_at_computed_height must be false or null (only the operator turns it on).');
            }
            // Never overwrite the operator's own OFF: their provenance stays.
            if (!(rules.computedHeight && rules.computedHeight.value === false && rules.computedHeight.source === MOTION_RULE_SETTINGS_SOURCE)) {
                rules.computedHeight = { value: false, source, setAt: at };
            }
            updated.push('traverse_without_approval_at_computed_height');
        }
        if (given('toolhead_body_below_reference_mm')) {
            if (args.toolhead_body_below_reference_mm === null) {
                delete rules.toolheadBodyBelowReferenceMm;
                cleared.push('toolhead_body_below_reference_mm');
            } else {
                rules.toolheadBodyBelowReferenceMm = {
                    value: policyNumber('toolhead_body_below_reference_mm', args.toolhead_body_below_reference_mm,
                        [TOOLHEAD_BODY_BELOW_REFERENCE_MM.min, TOOLHEAD_BODY_BELOW_REFERENCE_MM.max],
                        'mm the toolhead unit\'s lowest point sits below the toolhead reference, measured'),
                    source,
                    setAt: at,
                };
                updated.push('toolhead_body_below_reference_mm');
            }
        }
        writes.push(['mcpMotionRules', rules]);
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

    if (given('stepper_idle_timeout_s')) {
        if (!releasesSteppersOnIdle(identifier)) {
            throw new McpToolError('stepper_idle_timeout_s does not apply: only the Snapmaker Original releases its steppers on idle '
                + `(the Snapmaker 2.0 firmware sets DISABLE_INACTIVE_X/Y/Z false) ${connectedMachineTag()}.`);
        }
        if (args.stepper_idle_timeout_s === null) {
            writes.push(['mcpStepperIdleTimeoutS', undefined]);
            writes.push(['mcpStepperIdleTimeoutProvenance', undefined]);
            cleared.push('stepper_idle_timeout_s');
        } else {
            writes.push(['mcpStepperIdleTimeoutS', policyNumber('stepper_idle_timeout_s', args.stepper_idle_timeout_s,
                [STEPPER_IDLE_TIMEOUT_S.min, STEPPER_IDLE_TIMEOUT_S.max], 'seconds without motion before the firmware releases the steppers')]);
            writes.push(['mcpStepperIdleTimeoutProvenance', { source, setAt: at }]);
            updated.push('stepper_idle_timeout_s');
        }
    }

    if (options.dryRun) {
        return { machineKey: key, updated, cleared, policy: null };
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

/**
 * set_machine_policy: validate everything first, then write into the
 * connected machine's entry only - except that a change that LOOSENS a stated
 * safety bound is staged for the operator (see above). `approvedReview` is
 * the operator review whose click is applying it (the store's apply).
 */
export function setMachinePolicy(args: { [key: string]: unknown }, options: { approvedReview?: string } = {}): MachinePolicyResult {
    if (!options.approvedReview) {
        machinePolicyCall(args, { dryRun: true });
        const current = machineStore.currentMachine();
        const loose = policyLoosenings(current.machineKey as string, current.machineIdentifier as string, args);
        if (loose.length) {
            return stagePolicyLoosening(args, loose);
        }
    }
    return machinePolicyCall(args, { approvedReview: options.approvedReview });
}

/** Every machine the MCP knows: the per-machine store's entries plus the connected / selected machine. */
function knownMachineKeys(): string[] {
    const keys = Object.keys(machineStore.load().machines);
    const current = machineStore.currentMachine().machineKey;
    if (current && !keys.includes(current)) {
        keys.push(current);
    }
    return keys;
}

/** The facts a caller outside this module supplies for the CURRENT machine (api-mcp.js reads clearanceContext). */
export interface MotionRuleLiveFacts {
    /** Trusted tool protrusion of the connected machine's fitted tool (clearanceContext.currentToolProtrusion().mm). */
    toolProtrusionMm?: number | null;
    toolProtrusionNote?: string | null;
}

/**
 * The landmark review (#265 WP5) as it stands. A confirmation is valid only on
 * the connection it was approved on, for the set of landmarks it showed, and
 * within its validity (landmarkReview.ts confirmationValidity) - so the stored
 * record alone (`landmarksConfirmed`) proves nothing: the CURRENT machine is
 * read from the live review (the provider landmarkReviewState.ts registers
 * with safeZPolicy; imported from there because that module imports this
 * one), and any other machine is not confirmed by construction.
 */
function landmarkReviewFact(machineKey: string): { confirmed: boolean | null; note: string } {
    if (machineKey !== machineStore.currentMachine().machineKey || machineStore.currentMachine().basis !== 'connected') {
        const stored = machineStore.getFor(machineKey, 'mcpLandmarksConfirmed') as { at?: unknown } | undefined;
        const at = stored && Number.isFinite(Number(stored.at)) ? new Date(Number(stored.at)).toISOString() : null;
        return {
            confirmed: false,
            note: `not connected: a landmark confirmation lives only on the connection it was approved on${at ? ` (last approved ${at})` : ''}`,
        };
    }
    const gate = currentLandmarkReviewGate();
    if (gate.status === 'unknown') {
        return { confirmed: null, note: gate.question || 'the landmark review is not available' };
    }
    if (!gate.confirmed) {
        return { confirmed: false, note: `landmark_review ${gate.status} - confirm_landmarks stages the review page for the operator` };
    }
    const ttl = landmarkConfirmTtlHours(machineKey);
    return { confirmed: true, note: `landmarks confirmed by the operator on this connection (valid up to ${ttl.hours} h)` };
}

/** Measured physical bed Z for `machineKey` (set_probe_geometry bed_plane_z; env LUBAN_MCP_BED_PLANE_Z pins the current machine). */
function bedPlaneZFor(machineKey: string, isCurrent: boolean): number | null {
    const env = String(process.env.LUBAN_MCP_BED_PLANE_Z || '').trim();
    const raw = isCurrent && env ? env : machineStore.getFor(machineKey, 'mcpBedPlaneZ');
    if (raw === undefined || raw === null || raw === '') {
        return null;
    }
    const z = Number(raw);
    return Number.isFinite(z) ? z : null;
}

/**
 * Motion rules R13 for one machine (motionRules.ts computedHeightTraversePolicy):
 * what moving at a computed safe height below top Z needs, and whether the
 * machine has it. traverse_xy acts on it (tools/gcode.ts, #265 WP10).
 */
export function computedHeightRuleFor(machineKey: string, live: MotionRuleLiveFacts = {}) {
    const current = machineStore.currentMachine();
    const isCurrent = machineKey === current.machineKey;
    const eligibility = motionRuleEligibility(machineKey);
    const review = landmarkReviewFact(machineKey);
    const liveProtrusion = live.toolProtrusionMm === undefined ? null : live.toolProtrusionMm;
    let protrusionNote: string | null = null;
    if (!isCurrent || current.basis !== 'connected') {
        protrusionNote = 'judged only for the connected machine';
    } else if (liveProtrusion === null) {
        protrusionNote = live.toolProtrusionNote || null;
    }
    const verdict = computedHeightTraversePolicy({ motionRules: machineStore.getFor(machineKey, 'mcpMotionRules') }, {
        hostEnabled: traverseWithoutApprovalHostSetting(),
        eligible: eligibility.eligible,
        eligibilityReason: eligibility.reason,
        toolProtrusionMm: isCurrent && current.basis === 'connected' ? liveProtrusion : null,
        toolProtrusionNote: protrusionNote,
        bedPlaneZ: bedPlaneZFor(machineKey, isCurrent),
        landmarksConfirmed: review.confirmed,
        landmarksNote: review.note,
    });
    const section = motionRulesOf({ motionRules: machineStore.getFor(machineKey, 'mcpMotionRules') });
    const toggle = section.computedHeight;
    return {
        toggle: COMPUTED_HEIGHT_TOGGLE,
        on: !!toggle && toggle.value === true && toggle.source === MOTION_RULE_SETTINGS_SOURCE,
        source: toggle ? toggle.source : 'default',
        setAt: toggle ? toggle.setAt : null,
        eligible: eligibility.eligible,
        reason: eligibility.reason,
        clearanceSource: {
            ideal: section.clearanceIdealMm ? section.clearanceIdealMm.source : 'default',
            min: section.clearanceMinMm ? section.clearanceMinMm.source : 'default',
        },
        toolheadBodyBelowReferenceMm: section.toolheadBodyBelowReferenceMm || null,
        ...verdict,
        note: 'When allowed, traverse_xy runs without approval at the computed safe height of its swept path (never lowering Z: '
            + 'a head below it is raised straight up first); every other move below top Z stages as before.',
    };
}

/**
 * Settings -> MCP Server -> Motion rules (GET /api/mcp): the host switch and,
 * per known machine, its dialect, Z axis, Z policy and travel fudge (read-only
 * here - heights are stated with set_machine_policy), its "Move at safe top Z
 * without approval" toggle with eligibility and provenance, and the R13
 * computed-height rule with what it needs.
 */
export function describeMotionRules(live: MotionRuleLiveFacts = {}) {
    const current = machineStore.currentMachine();
    return {
        host: { enabled: traverseWithoutApprovalHostSetting(), source: traverseWithoutApprovalSource() },
        toggle: MOTION_RULE_TOGGLE,
        machines: knownMachineKeys().map((machineKey) => {
            const identifier = baseIdentifier(machineKey);
            const capability = machineCapabilityFor(identifier);
            const policy = describeMachinePolicy(machineKey);
            const approval = policy.traverseWithoutApprovalAtSafeZ;
            return {
                machineKey,
                identifier,
                current: machineKey === current.machineKey ? current.basis : null,
                dialect: capability.dialect
                    ? { id: capability.dialect.id, label: capability.dialect.label, transportForm: capability.dialect.transportForm }
                    : null,
                hasZ: capability.hasZ,
                zPolicy: policy.zPolicy,
                travelFudge: { xMm: policy.travelFudge.xMm, yMm: policy.travelFudge.yMm, source: policy.travelFudge.source },
                traverseWithoutApproval: {
                    on: approval.machineFlag.value && (identifier === LEGACY_MACHINE_IDENTIFIER
                        || approval.machineFlag.source === MOTION_RULE_SETTINGS_SOURCE),
                    effective: approval.enabled,
                    eligible: approval.eligibility.eligible,
                    reason: approval.eligibility.reason,
                    source: approval.machineFlag.source,
                    setAt: approval.machineFlag.setAt,
                    gatedBy: approval.gatedBy,
                },
                computedHeight: computedHeightRuleFor(machineKey, live),
            };
        }),
    };
}

/**
 * The operator's edit of one machine's Motion rules (POST
 * /api/mcp/motion-rules). The ONE path that turns either approval-free rule
 * ON off the A350 defaults; it is served only by the settings API, never
 * registered as an MCP tool. OFF is accepted for any known machine; ON only
 * for an eligible one, refused with the reason. Every write records source
 * 'settings' and the time. Body fields (each optional, at least one):
 * traverseWithoutApprovalAtSafeZ, computedHeightTraverse (booleans),
 * clearanceIdealMm, clearanceMinMm (mm; null or '' = default).
 */
export function setMotionRuleFromSettings(body: { [field: string]: unknown }) {
    const { machineKey } = body;
    if (typeof machineKey !== 'string' || !machineKey.trim()) {
        throw new McpToolError('machineKey must name a machine from the Motion rules list.');
    }
    const fields = ['traverseWithoutApprovalAtSafeZ', 'computedHeightTraverse', 'clearanceIdealMm', 'clearanceMinMm'];
    if (!fields.some((field) => body[field] !== undefined)) {
        throw new McpToolError(`Nothing to set: pass one or more of ${fields.join(', ')}.`);
    }
    for (const field of ['traverseWithoutApprovalAtSafeZ', 'computedHeightTraverse']) {
        if (body[field] !== undefined && typeof body[field] !== 'boolean') {
            throw new McpToolError(`${field} must be true or false.`);
        }
    }
    const key = machineKey.trim();
    if (!knownMachineKeys().includes(key)) {
        throw new McpToolError(`${key} is not a machine the MCP knows (connect or select it first).`);
    }
    const current = machineStore.currentMachine();
    if (key === current.machineKey && current.deviceConflict) {
        throw new McpToolError(`Refusing to change ${key} while its device conflict is open: ${current.deviceConflict.note}`);
    }
    if (body.traverseWithoutApprovalAtSafeZ === true || body.computedHeightTraverse === true) {
        const eligibility = motionRuleEligibility(key);
        if (!eligibility.eligible) {
            const toggle = body.traverseWithoutApprovalAtSafeZ === true ? MOTION_RULE_TOGGLE : COMPUTED_HEIGHT_TOGGLE;
            throw new McpToolError(`'${toggle}' cannot be turned on for ${key}: ${eligibility.reason}.`);
        }
    }
    // Validate everything before the first write.
    const rules: MotionRulesSection = { ...motionRulesOf({ motionRules: machineStore.getFor(key, 'mcpMotionRules') }) };
    let clearances: { idealMm: number | null; minMm: number | null } | null = null;
    if (body.clearanceIdealMm !== undefined || body.clearanceMinMm !== undefined) {
        try {
            clearances = validateClearanceSettings(body, rules);
        } catch (err) {
            throw new McpToolError((err as Error).message);
        }
    }
    const at = Date.now();
    const stated = { source: MOTION_RULE_SETTINGS_SOURCE, setAt: at };
    if (typeof body.traverseWithoutApprovalAtSafeZ === 'boolean') {
        const provenance = { ...(storedProvenance(key, 'mcpZPolicyProvenance') || {}) };
        provenance.traverseWithoutApprovalAtSafeZ = stated;
        machineStore.setFor(key, 'mcpMachineTraverseWithoutApprovalAtSafeZ', body.traverseWithoutApprovalAtSafeZ);
        machineStore.setFor(key, 'mcpZPolicyProvenance', provenance);
    }
    if (typeof body.computedHeightTraverse === 'boolean') {
        rules.computedHeight = { value: body.computedHeightTraverse, ...stated };
    }
    if (clearances) {
        for (const [field, value] of [['clearanceIdealMm', clearances.idealMm], ['clearanceMinMm', clearances.minMm]] as const) {
            if (body[field] === undefined) {
                continue;
            }
            if (value === null) {
                delete rules[field];
            } else {
                rules[field] = { value, ...stated };
            }
        }
    }
    if (typeof body.computedHeightTraverse === 'boolean' || clearances) {
        machineStore.setFor(key, 'mcpMotionRules', rules);
    }
    return { machineKey: key, traverseWithoutApprovalAtSafeZ: traverseWithoutApprovalPolicy(key), computedHeight: computedHeightRuleFor(key) };
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
            const connected = identifier === status.machineIdentifier;
            const toolheadNote = connected ? connectedToolheadNote() : null;
            return {
                identifier: machine.identifier,
                fullName: machine.fullName,
                machineType: machine.machineType,
                /** This machine's G-code dialect row (gcodeDialect.ts), e.g. 'ray-grbl', 'sm2-marlin'; 'unknown' when not in the table. */
                dialect: capability.dialect.id,
                dialectLabel: capability.dialect.label,
                /**
                 * What the connected controller's firmware reported on THIS
                 * connection (tools/firmware.ts: the Ray's $$ acceleration, S max,
                 * ... with readAt and source), in memory only; null when this is
                 * not the connected machine or nothing was read.
                 */
                firmware: connected ? firmwareView() : null,
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
                connected,
                connectedHead: state ? {
                    headType: (state as { headType?: string }).headType || null,
                    toolHead: (state as { toolHead?: string }).toolHead || null,
                } : null,
                // The Ray only: head state unknown (never "off") and the MCP's own laser words, advisory.
                ...(connected && toolheadNote ? { toolhead: toolheadNote } : {}),
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
            + 'coherent beat (2 s). Never compute machine = work - originOffset yourself. On a machine whose firmware never reports '
            + 'its head state (the Ray) `toolhead` says so - state unknown, never off - with `mcp_sent_laser`, an ADVISORY record of '
            + 'the laser words this MCP itself sent (jobs from Luban\'s UI or the phone app are invisible to it). Read-only.',
        inputSchema: {
            type: 'object',
            properties: {},
            additionalProperties: false,
        },
        handler: async () => {
            const snapshot = getPositionSnapshot();
            const toolheadNote = connectedToolheadNote();
            return toolheadNote ? { ...snapshot, toolhead: toolheadNote } : snapshot;
        },
    });

    registry.register({
        name: 'set_machine_policy',
        description: 'Store the CONNECTED machine\'s motion policy in its own entry of the per-machine store (other machines\' '
            + 'entries are never touched). safe_traverse_z = the PARK height procedures hop at and end at; motion_floor_z = the '
            + 'lowest machine Z any XY move over 1 mm may happen at. Both are machine Z, stated from this machine (its home Z / '
            + 'top of travel), never copied from another model. Only the Snapmaker 2.0 A350 has defaults (328 / 320); on any '
            + 'other machine with a Z axis every Z-planning tool refuses until both are stated. Not applicable on a machine with '
            + 'no Z axis (the Ray). traverse_without_approval_at_safe_z: false turns approval-free top-Z moves OFF on any machine; '
            + 'true only on the A350 (verified on hardware) and never over the operator\'s own OFF - on an A150 / A250 / Artisan '
            + 'only the operator turns it on, in Settings > MCP > Motion rules. travel_fudge_* widen the model box at each end of '
            + 'each axis (default 25 mm). null clears a value. LOOSENING a stated bound (lower safe_traverse_z or motion_floor_z - the '
            + 'A350\'s 328 / 320 count as stated - a wider travel fudge, a shallower toolhead_body_below_reference_mm, a longer '
            + 'landmark_confirm_ttl_hours or stepper_idle_timeout_s) is NOT applied: it is staged on an operator review page (staged.confirm_url) and applies on '
            + 'the operator\'s click; tightening and a first statement apply at once. '
            + 'Each value records its source and time; get_machine_profile.policy reads them back.',
        inputSchema: {
            type: 'object',
            properties: {
                safe_traverse_z: { type: ['number', 'null'], description: 'Park height, machine Z. Must be within this machine\'s Z travel.' },
                motion_floor_z: { type: ['number', 'null'], description: 'Lowest machine Z for XY transport; not above safe_traverse_z.' },
                traverse_without_approval_at_safe_z: { type: ['boolean', 'null'], description: 'Approval-free transport at the park height. OFF on any machine; ON only on the A350 (others: Settings > MCP > Motion rules).' },
                traverse_without_approval_at_computed_height: { type: ['boolean', 'null'], description: 'Approval-free moves at a computed safe height below top Z: false only (the operator turns it on in Settings > MCP > Motion rules).' },
                toolhead_body_below_reference_mm: { type: ['number', 'null'], description: 'Measured mm the toolhead unit\'s own lowest point (body, collet nut, clip-on shoe) sits below the toolhead reference tool protrusion is measured from.' },
                travel_fudge_mm: { type: ['number', 'null'], description: 'mm beyond the model box at each end of X and Y (default 25).' },
                travel_fudge_x_mm: { type: ['number', 'null'], description: 'Per-axis override of travel_fudge_mm for X.' },
                travel_fudge_y_mm: { type: ['number', 'null'], description: 'Per-axis override of travel_fudge_mm for Y.' },
                landmark_confirm_ttl_hours: {
                    type: ['number', 'null'],
                    description: `How long an operator landmark review stays valid (default ${LANDMARK_CONFIRM_TTL_HOURS.default} h, or until disconnect).`,
                },
                stepper_idle_timeout_s: {
                    type: ['number', 'null'],
                    description: 'The Snapmaker Original only: seconds without motion after which its firmware releases the steppers and the '
                        + `MCP treats the home as lost (${STEPPER_IDLE_TIMEOUT_S.min}-${STEPPER_IDLE_TIMEOUT_S.max}; default `
                        + `${STEPPER_IDLE_TIMEOUT_S.default} = upstream Marlin's DEFAULT_STEPPER_DEACTIVE_TIME, not measured on the Original). `
                        + 'M18/M84 S<n> written on the connection override it (S0 = never).',
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
