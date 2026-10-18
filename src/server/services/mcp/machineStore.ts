// Per-machine MCP state (tyeth/Luban#265, WP2). Everything the operator
// states or measures about ONE machine - its travel ends, Z policy, travel
// fudge, rotary jig and probe geometry, tool setter, fitted tool, expected
// tool region, jog cap, camera preference, rotary gravity calibration - lives
// under that machine's entry in one configstore key, `mcpMachines`, and every
// machine's entry coexists. Switching machines never discards another
// machine's data: #264's single `mcpTravelMachine` scope retired the A350's
// travel ends the moment the Ray's were stated, which is the defect this
// replaces.
//
// Keyed by machineIdentifier ("Snapmaker 2.0 A350"), with the device ids a
// connection presents kept as ALIASES of that entry (amendment R3): the A350
// over SACP has a serial number, over SSTP a host, over USB nothing, and all
// three are the same machine. A connect presenting an SACP serial (`sn:`)
// when the entry already records a different serial is a `deviceConflict`:
// maybe a second machine of the same model. The records then read as
// unconfirmed and nothing auto-executes until the operator answers
// (assignMachineDevice: same machine -> alias; different -> a new empty entry
// "<identifier>#<deviceId>"). Different id types never conflict.
//
// Only serials are identity. An SSTP `host:` id is the address the channel
// was opened with - DHCP moves it - so a new host is recorded as one more
// alias (lastSeen kept current) and NEVER raises a conflict: an A350 that
// reconnects over Wi-Fi from a new address keeps its records and its
// approval-free transport. The limitation: two machines of the same model
// that only ever connect over SSTP cannot be told apart, and share an entry.
//
// Consumers keep their old configstore key names: `machineConfig.get(key)`
// maps a legacy key (and its `Note` / `At` companions) to its place in the
// current machine's entry (PER_MACHINE_KEYS), so the env > per-machine >
// default order in each reader is unchanged and the migration below is
// driven by the same table.
//
// Migration (idempotent, on first access - never at import): when
// `mcpMachines` is absent, every legacy per-machine key that is set moves into
// the A350's entry (the only machine the MCP ran on before #264), except
// travel ends #264 scoped to another machine via `mcpTravelMachine`. Legacy
// keys are LEFT IN PLACE so a rollback to #264 keeps working, and are ignored
// from then on (a legacy key edited after migration changes nothing;
// `migratedFrom` records what moved).
import config from '../configstore';
import { LEGACY_MACHINE_IDENTIFIER, recordMachineScope } from './machineCapability';
import logger from '../../lib/logger';

export const MACHINE_STORE_KEY = 'mcpMachines';
export const MACHINE_STORE_VERSION = 1;
/** #264's single travel scope; read only by the migration. */
export const LEGACY_TRAVEL_MACHINE_KEY = 'mcpTravelMachine';

export interface DeviceAlias {
    /** `sn:<SACP masterControlSerialNumber>` or `host:<SSTP-HTTP address>`. */
    id: string;
    firstSeen: number;
    lastSeen: number;
}

export interface MachineEntry {
    devices: DeviceAlias[];
    updatedAt?: number;
    [section: string]: unknown;
}

export interface MigrationRecord {
    at: number;
    /** Legacy configstore key -> the machine entry it moved to. Empty when nothing was set. */
    legacyKeys: { [key: string]: string };
    /** #264's mcpTravelMachine at migration time (null on a pre-#264 store). */
    pr264TravelMachine: string | null;
    note: string;
}

export interface MachineStoreData {
    version: number;
    machines: { [machineKey: string]: MachineEntry };
    migratedFrom: MigrationRecord | null;
}

export type DeviceSource = 'sacp-serial-number' | 'sstp-host' | null;

export interface ConnectedDevice {
    machineIdentifier: string | null;
    deviceId: string | null;
    deviceSource: DeviceSource;
    /** The store entry that applies (a split entry when this device was assigned one); null when nothing applies. */
    machineKey: string | null;
}

export interface DeviceConflict {
    machineIdentifier: string;
    deviceId: string;
    /** The ids of the same type already recorded for this model. */
    recorded: string[];
    note: string;
}

export interface CurrentMachine extends ConnectedDevice {
    /** Where the entry came from: the live connection, else the machine selected in Luban Machine Settings. */
    basis: 'connected' | 'selected' | null;
    deviceConflict: DeviceConflict | null;
}

/** Where a legacy key lives in a machine entry. */
type StorePath = string[];

// Operator-stated values with provenance: <key> = value, <key>Note, <key>At.
const FIELD_KEYS: Array<[string, string, string]> = [
    ['mcpTravelXMin', 'travel', 'xMin'],
    ['mcpTravelXMax', 'travel', 'xMax'],
    ['mcpTravelYMin', 'travel', 'yMin'],
    ['mcpTravelYMax', 'travel', 'yMax'],
    ['mcpRotaryAxisX', 'rotary', 'axisX'],
    ['mcpRotaryAxisZ', 'rotary', 'axisZ'],
    ['mcpRotaryTailstockY', 'rotary', 'tailstockY'],
    ['mcpRotaryChuckFaceY', 'rotary', 'chuckFaceY'],
    // R5: physical machine-Z tops of the chuck and the tailstock bracket. New
    // in WP2, so no legacy key ever held them; the names only address the store.
    ['mcpRotaryChuckTopZ', 'rotary', 'chuckTopZ'],
    ['mcpRotaryTailstockTopZ', 'rotary', 'tailstockTopZ'],
    ['mcpRotaryAxisPoints', 'rotary', 'axisPoints'],
    ['mcpBedPlaneZ', 'rotary', 'bedPlaneZ'],
    ['mcpProbeEffectiveLength', 'probe', 'effectiveLength'],
    ['mcpProbeTipDiameter', 'probe', 'tipDiameter'],
    ['mcpProbeStylusExposed', 'probe', 'stylusExposed'],
    ['mcpProbeBodyDiameter', 'probe', 'bodyDiameter'],
];

const PLAIN_KEYS: Array<[string, StorePath]> = [
    ['mcpTravelFudgeMm', ['travelFudge', 'mm']],
    ['mcpTravelFudgeXMm', ['travelFudge', 'x']],
    ['mcpTravelFudgeYMm', ['travelFudge', 'y']],
    ['mcpSafeTraverseZ', ['zPolicy', 'safeTraverseZ']],
    ['mcpMotionFloorZ', ['zPolicy', 'motionFloorZ']],
    // Per machine only. The legacy global mcpTraverseWithoutApprovalAtSafeZ is
    // the Settings pane's host-wide switch and stays global (tools/machine.ts).
    ['mcpMachineTraverseWithoutApprovalAtSafeZ', ['zPolicy', 'traverseWithoutApprovalAtSafeZ']],
    ['mcpLandmarkConfirmTtlHours', ['landmarkConfirmTtlHours']],
    // {field: {source, setAt}} for what set_machine_policy (or the migration) wrote.
    ['mcpZPolicyProvenance', ['zPolicy', 'provenance']],
    ['mcpTravelFudgeProvenance', ['travelFudge', 'provenance']],
    ['mcpLandmarkConfirmTtlProvenance', ['landmarkConfirmTtlProvenance']],
    // WP5: the operator's approval of the landmark review (landmarkReview.ts) - written only by the staged review page.
    ['mcpLandmarksConfirmed', ['landmarksConfirmed']],
    ['mcpToolSetter', ['toolSetter']],
    ['mcpActiveTool', ['activeTool']],
    ['mcpToolRegion', ['toolRegion']],
    ['mcpMaxJogDistance', ['maxJogDistanceMm']],
    ['mcpCameraUrl', ['camera', 'url']],
    ['mcpCameraDevice', ['camera', 'device']],
    ['mcpCameraLastGood', ['camera', 'lastGood']],
    ['mcpRotaryGravityCalibration', ['rotaryGravityCalibration']],
];

/** Keys that never existed before WP2: addressed through the store, never migrated. */
const NEW_KEYS = new Set(['mcpRotaryChuckTopZ', 'mcpRotaryTailstockTopZ', 'mcpMachineTraverseWithoutApprovalAtSafeZ', 'mcpLandmarkConfirmTtlHours',
    'mcpZPolicyProvenance', 'mcpTravelFudgeProvenance', 'mcpLandmarkConfirmTtlProvenance', 'mcpLandmarksConfirmed']);

export const PER_MACHINE_KEYS: { [key: string]: StorePath } = (() => {
    const table: { [key: string]: StorePath } = {};
    for (const [key, section, name] of FIELD_KEYS) {
        table[key] = [section, name, 'value'];
        table[`${key}Note`] = [section, name, 'note'];
        table[`${key}At`] = [section, name, 'setAt'];
    }
    for (const [key, storePath] of PLAIN_KEYS) {
        table[key] = storePath;
    }
    return table;
})();

const TRAVEL_KEYS = ['mcpTravelXMin', 'mcpTravelXMax', 'mcpTravelYMin', 'mcpTravelYMax']
    .reduce((keys: string[], key) => keys.concat([key, `${key}Note`, `${key}At`]), []);

interface ConfigLike {
    get(key: string): unknown;
    set(key: string, value: unknown): void;
}

export interface ConnectionStatusLike {
    connected?: boolean;
    machineIdentifier?: string | null;
    /** WPC: SACP masterControlSerialNumber as a decimal string. Absent before WPC lands. */
    deviceSerial?: string | null;
    /** WPC: the SSTP-HTTP address the channel was opened with. Absent before WPC lands. */
    host?: string | null;
}

export interface MachineStoreDeps {
    config: ConfigLike;
    status: () => ConnectionStatusLike | null;
    /** The machine selected in Luban Machine Settings, for reads and writes while nothing is connected. */
    selectedMachine?: () => string | null;
    log?: (line: string) => void;
    now?: () => number;
}

function isSet(value: unknown): boolean {
    return value !== undefined && value !== null && value !== '';
}

function clone<T>(value: T): T {
    return value === undefined ? value : JSON.parse(JSON.stringify(value));
}

function pathFor(key: string): StorePath {
    const storePath = PER_MACHINE_KEYS[key];
    if (!storePath) {
        throw new Error(`${key} is not a per-machine MCP key (machineStore.PER_MACHINE_KEYS).`);
    }
    return storePath;
}

function readPath(entry: MachineEntry | undefined, storePath: StorePath): unknown {
    let node: unknown = entry;
    for (const part of storePath) {
        if (!node || typeof node !== 'object') {
            return undefined;
        }
        node = (node as { [k: string]: unknown })[part];
    }
    return node;
}

function writePath(entry: MachineEntry, storePath: StorePath, value: unknown): void {
    let node = entry as { [k: string]: unknown };
    for (const part of storePath.slice(0, -1)) {
        if (!node[part] || typeof node[part] !== 'object') {
            node[part] = {};
        }
        node = node[part] as { [k: string]: unknown };
    }
    node[storePath[storePath.length - 1]] = value;
}

function removePath(entry: MachineEntry, storePath: StorePath): void {
    const parents: Array<{ [k: string]: unknown }> = [];
    let node = entry as { [k: string]: unknown };
    for (const part of storePath.slice(0, -1)) {
        if (!node[part] || typeof node[part] !== 'object') {
            return;
        }
        parents.push(node);
        node = node[part] as { [k: string]: unknown };
    }
    delete node[storePath[storePath.length - 1]];
    // Drop sections the removal emptied, so a cleared field leaves no husk.
    for (let i = storePath.length - 2; i >= 0; i--) {
        const parent = parents[i];
        const child = parent[storePath[i]] as { [k: string]: unknown };
        if (child && typeof child === 'object' && !Object.keys(child).length) {
            delete parent[storePath[i]];
        } else {
            break;
        }
    }
}

/** The device id a connection presents: SACP serial first, else the SSTP-HTTP host; none on text serial. Read defensively. */
export function deviceIdFromStatus(status: ConnectionStatusLike | null): { deviceId: string | null; deviceSource: DeviceSource } {
    const serial = status && status.deviceSerial !== undefined && status.deviceSerial !== null ? String(status.deviceSerial).trim() : '';
    if (serial) {
        return { deviceId: `sn:${serial}`, deviceSource: 'sacp-serial-number' };
    }
    const host = status && typeof status.host === 'string' ? status.host.trim() : '';
    if (host) {
        return { deviceId: `host:${host}`, deviceSource: 'sstp-host' };
    }
    return { deviceId: null, deviceSource: null };
}

function idType(deviceId: string): string {
    return deviceId.split(':')[0];
}

/** The model a store key belongs to: "Snapmaker 2.0 A350#sn:12" -> "Snapmaker 2.0 A350". */
export function baseIdentifier(machineKey: string): string {
    const hash = machineKey.indexOf('#');
    return hash < 0 ? machineKey : machineKey.slice(0, hash);
}

export function createMachineStore(deps: MachineStoreDeps) {
    const now = deps.now || (() => Date.now());
    const log = deps.log || (() => undefined);
    // Device sightings written this process: lastSeen moves once per device per run, not on every read.
    const sighted = new Set<string>();

    function migrate(): MachineStoreData {
        const at = now();
        const rawScope = deps.config.get(LEGACY_TRAVEL_MACHINE_KEY);
        const pr264TravelMachine = typeof rawScope === 'string' && rawScope.trim() ? rawScope.trim() : null;
        const travelOwner = recordMachineScope(rawScope);
        const machines: { [key: string]: MachineEntry } = {};
        const legacyKeys: { [key: string]: string } = {};
        for (const key of Object.keys(PER_MACHINE_KEYS)) {
            if (NEW_KEYS.has(key) || NEW_KEYS.has(key.replace(/(Note|At)$/, ''))) {
                continue;
            }
            const value = deps.config.get(key);
            if (!isSet(value)) {
                continue;
            }
            const owner = TRAVEL_KEYS.includes(key) ? travelOwner : LEGACY_MACHINE_IDENTIFIER;
            if (!machines[owner]) {
                machines[owner] = { devices: [] };
            }
            writePath(machines[owner], PER_MACHINE_KEYS[key], clone(value));
            legacyKeys[key] = owner;
        }
        const provenance: Array<[string, StorePath]> = [
            ['mcpSafeTraverseZ', ['zPolicy', 'provenance', 'safeTraverseZ']],
            ['mcpMotionFloorZ', ['zPolicy', 'provenance', 'motionFloorZ']],
            ['mcpTravelFudgeMm', ['travelFudge', 'provenance', 'mm']],
            ['mcpTravelFudgeXMm', ['travelFudge', 'provenance', 'x']],
            ['mcpTravelFudgeYMm', ['travelFudge', 'provenance', 'y']],
        ];
        for (const [key, storePath] of provenance) {
            if (legacyKeys[key]) {
                writePath(machines[legacyKeys[key]], storePath, { source: `migrated from configstore ${key}`, setAt: at });
            }
        }
        for (const entry of Object.values(machines)) {
            entry.updatedAt = at;
        }
        const data: MachineStoreData = {
            version: MACHINE_STORE_VERSION,
            machines,
            migratedFrom: {
                at,
                legacyKeys,
                pr264TravelMachine,
                note: 'Legacy per-machine configstore keys copied once into the machine they belong to; they are left in place '
                    + 'for a rollback and ignored from now on.',
            },
        };
        deps.config.set(MACHINE_STORE_KEY, data);
        const moved = Object.keys(legacyKeys);
        log(`MCP per-machine store created (${MACHINE_STORE_KEY}): ${moved.length ? `moved ${moved.join(', ')} `
            + `into ${Array.from(new Set(Object.values(legacyKeys))).join(', ')}` : 'no legacy per-machine keys were set'}`);
        return data;
    }

    /** The store, migrating on first access. Always a private copy: callers mutate and save(). */
    function load(): MachineStoreData {
        const raw = deps.config.get(MACHINE_STORE_KEY) as MachineStoreData | undefined;
        if (!raw || typeof raw !== 'object' || !raw.machines || typeof raw.machines !== 'object') {
            return clone(migrate());
        }
        return clone({ version: raw.version || MACHINE_STORE_VERSION, machines: raw.machines, migratedFrom: raw.migratedFrom || null });
    }

    function save(data: MachineStoreData): void {
        deps.config.set(MACHINE_STORE_KEY, data);
    }

    function status(): ConnectionStatusLike | null {
        try {
            return deps.status();
        } catch (err) {
            return null;
        }
    }

    /** Which entry a connect of (identifier, deviceId) reads, and whether its device id conflicts with a recorded one. */
    function resolve(data: MachineStoreData, identifier: string, deviceId: string | null): { key: string; conflict: DeviceConflict | null } {
        if (!deviceId) {
            return { key: identifier, conflict: null };
        }
        const candidates = Object.keys(data.machines).filter((key) => key === identifier || key.startsWith(`${identifier}#`));
        for (const key of candidates) {
            if ((data.machines[key].devices || []).some((d) => d.id === deviceId)) {
                return { key, conflict: null };
            }
        }
        // A host is weak identity (DHCP): never a conflict, only another alias (see the header).
        if (idType(deviceId) !== 'sn') {
            return { key: identifier, conflict: null };
        }
        const entry = data.machines[identifier];
        const sameType = entry ? (entry.devices || []).filter((d) => idType(d.id) === idType(deviceId)).map((d) => d.id) : [];
        if (!sameType.length) {
            return { key: identifier, conflict: null };
        }
        return {
            key: identifier,
            conflict: {
                machineIdentifier: identifier,
                deviceId,
                recorded: sameType,
                note: `This ${identifier} presents ${deviceId}, but its records were made on ${sameType.join(', ')}. It may be a `
                    + 'different machine of the same model: the stored travel, landmarks, tool setter, rotary and probe geometry '
                    + 'and Z policy are UNCONFIRMED for it and nothing runs without approval until the operator answers '
                    + '"is this the same machine?" (assign_machine_device).',
            },
        };
    }

    function recordSighting(data: MachineStoreData, key: string, deviceId: string): void {
        const memo = `${key}|${deviceId}`;
        if (sighted.has(memo)) {
            return;
        }
        sighted.add(memo);
        const at = now();
        if (!data.machines[key]) {
            data.machines[key] = { devices: [] };
        }
        const entry = data.machines[key];
        entry.devices = entry.devices || [];
        const known = entry.devices.find((d) => d.id === deviceId);
        if (known) {
            known.lastSeen = at;
        } else {
            entry.devices.push({ id: deviceId, firstSeen: at, lastSeen: at });
        }
        save(data);
    }

    /** The machine whose entry applies now: the connection's, else the one selected in Luban Machine Settings. */
    function currentMachine(): CurrentMachine {
        const live = status();
        const identifier = live && typeof live.machineIdentifier === 'string' && live.machineIdentifier ? live.machineIdentifier : null;
        if (!identifier) {
            let selected: string | null = null;
            try {
                selected = deps.selectedMachine ? deps.selectedMachine() : null;
            } catch (err) {
                selected = null;
            }
            return {
                machineIdentifier: selected,
                deviceId: null,
                deviceSource: null,
                machineKey: selected,
                basis: selected ? 'selected' : null,
                deviceConflict: null,
            };
        }
        const { deviceId, deviceSource } = deviceIdFromStatus(live);
        const data = load();
        const { key, conflict } = resolve(data, identifier, deviceId);
        if (deviceId && !conflict) {
            recordSighting(data, key, deviceId);
        }
        return { machineIdentifier: identifier, deviceId, deviceSource, machineKey: key, basis: 'connected', deviceConflict: conflict };
    }

    /** The store key `identifier` reads: the current machine's key when it is that model, else the identifier itself. */
    function keyForIdentifier(identifier: string | null): string | null {
        if (!identifier) {
            return null;
        }
        const current = currentMachine();
        return current.machineIdentifier === identifier && current.machineKey ? current.machineKey : identifier;
    }

    function getFor(machineKey: string | null, key: string): unknown {
        const storePath = pathFor(key);
        if (!machineKey) {
            return undefined;
        }
        return clone(readPath(load().machines[machineKey], storePath));
    }

    function requireKey(machineKey: string | null, key: string): string {
        if (!machineKey) {
            throw new Error(`${key} is stored per machine, and no machine is connected or selected in Luban Machine Settings to `
                + 'store it for. Connect (or select) the machine first.');
        }
        return machineKey;
    }

    function setFor(machineKey: string | null, key: string, value: unknown): void {
        const storePath = pathFor(key);
        const target = requireKey(machineKey, key);
        const data = load();
        if (!data.machines[target]) {
            data.machines[target] = { devices: [] };
        }
        writePath(data.machines[target], storePath, clone(value));
        data.machines[target].updatedAt = now();
        save(data);
    }

    function unsetFor(machineKey: string | null, key: string): void {
        const storePath = pathFor(key);
        if (!machineKey) {
            return;
        }
        const data = load();
        const entry = data.machines[machineKey];
        if (!entry || readPath(entry, storePath) === undefined) {
            return;
        }
        removePath(entry, storePath);
        entry.updatedAt = now();
        save(data);
    }

    /**
     * The operator's answer to a deviceConflict (R3). `sameMachine` adds the
     * connected device id as an alias of the model's entry; otherwise the
     * device gets its own entry "<identifier>#<deviceId>", which starts empty.
     * Refused when there is no conflict to answer. The staged operator page
     * that calls this is WP5's; nothing agent-callable reaches it directly.
     */
    function assignMachineDevice(sameMachine: boolean): { machineKey: string; deviceId: string; created: boolean } {
        const conflict = currentMachine().deviceConflict;
        if (!conflict) {
            throw new Error('No device conflict is open for the connected machine: nothing to assign.');
        }
        const data = load();
        const at = now();
        if (sameMachine) {
            const entry = data.machines[conflict.machineIdentifier];
            entry.devices = [...(entry.devices || []), { id: conflict.deviceId, firstSeen: at, lastSeen: at }];
            entry.updatedAt = at;
            save(data);
            return { machineKey: conflict.machineIdentifier, deviceId: conflict.deviceId, created: false };
        }
        const splitKey = `${conflict.machineIdentifier}#${conflict.deviceId}`;
        data.machines[splitKey] = { devices: [{ id: conflict.deviceId, firstSeen: at, lastSeen: at }], updatedAt: at };
        save(data);
        return { machineKey: splitKey, deviceId: conflict.deviceId, created: true };
    }

    /** get_stored_state: every entry, which one applies, device aliases, any conflict, and the migration snapshot. */
    function describe() {
        const current = currentMachine();
        const data = load();
        const machines: { [key: string]: object } = {};
        for (const [key, entry] of Object.entries(data.machines)) {
            machines[key] = { applies: key === current.machineKey, model: baseIdentifier(key), ...entry };
        }
        return {
            configKey: MACHINE_STORE_KEY,
            current: {
                machineKey: current.machineKey,
                machineIdentifier: current.machineIdentifier,
                basis: current.basis,
                deviceId: current.deviceId,
                deviceSource: current.deviceSource,
                deviceScope: current.basis === 'connected' && !current.deviceId
                    ? 'model (this connection presents no device id - text serial, or a build without device identity)'
                    : null,
            },
            deviceConflict: current.deviceConflict,
            machines,
            migratedFrom: data.migratedFrom,
            note: 'Per-machine records coexist: stating something for one machine never touches another machine\'s entry. '
                + 'Environment variables (LUBAN_MCP_*) still pin a value for whatever machine is connected and report source "env".',
        };
    }

    const current = () => currentMachine().machineKey;
    return {
        load,
        currentMachine,
        keyForIdentifier,
        getFor,
        setFor,
        unsetFor,
        assignMachineDevice,
        describe,
        /** configstore-shaped access to the CURRENT machine's entry, by legacy key name. */
        machineConfig: {
            get: (key: string): unknown => getFor(current(), key),
            set: (key: string, value: unknown): void => setFor(current(), key, value),
            unset: (key: string): void => unsetFor(current(), key),
        },
    };
}

export type MachineStore = ReturnType<typeof createMachineStore>;

// The live connection and the app's selected machine are handed in by
// tools/machine.ts at load (setMachineStoreSources) rather than imported: the
// store sits under activeTool / toolSetter / rotaryGeometry, which must stay
// loadable without the connection layer (and tools/machine.ts would be a cycle).
let connectionStatusSource: (() => ConnectionStatusLike | null) | null = null;
let selectedMachineResolver: (() => string | null) | null = null;

export function setMachineStoreSources(sources: { status: () => ConnectionStatusLike | null; selectedMachine: () => string | null }): void {
    connectionStatusSource = sources.status;
    selectedMachineResolver = sources.selectedMachine;
}

export const machineStore = createMachineStore({
    config: config as unknown as ConfigLike,
    status: () => (connectionStatusSource ? connectionStatusSource() : null),
    selectedMachine: () => (selectedMachineResolver ? selectedMachineResolver() : null),
    log: (line: string) => logger('mcp:machine-store').info(line),
});

export const machineConfig = machineStore.machineConfig;

/** The plan's connectedDevice(): identifier, device id and the entry that applies; all null when not connected. */
export function connectedDevice(): ConnectedDevice {
    const current = machineStore.currentMachine();
    if (current.basis !== 'connected') {
        return { machineIdentifier: null, deviceId: null, deviceSource: null, machineKey: null };
    }
    return { machineIdentifier: current.machineIdentifier, deviceId: current.deviceId, deviceSource: current.deviceSource, machineKey: current.machineKey };
}
