// Camera models per machine (tyeth/Luban#265 follow-up): the untagged
// pre-scoping file is the A350's by the legacy rule (migrated once, original
// backed up, legacy flag surviving later saves), the Ray and the Original see
// no model, a solve on one machine never supersedes or evicts another's, and
// the camera device stays the judge's call (fingerprint), not a lookup key.
import { strict as assert } from 'assert';
import * as fs from 'fs';
import path from 'path';

import * as machineCapability from '../machineCapability';
import { CameraModel, judgeCameraModel } from '../cameraModel';
import { isolatedModule } from './jobDashboard.test';

const A350 = 'Snapmaker 2.0 A350';
const RAY = 'Ray';
const ORIGINAL = 'Original';
const DEVICE = 'usb-Sonix_Technology_Co.__Ltd._USB_2.0_Camera';
const FILE = '/data/mcp-camera-model.json';

/** JSON round trip: values built in the vm realm have that realm's prototypes. */
const plain = (v: unknown) => JSON.parse(JSON.stringify(v));

type Scope = { machineIdentifier: string | null; basis: 'connected' | 'selected' | null; deviceConflict: string | null };
const connected = (machineIdentifier: string | null): Scope => ({ machineIdentifier, basis: machineIdentifier ? 'connected' : null, deviceConflict: null });

/** A model as the pre-scoping build wrote it: no machineIdentifier. */
function rawModel(id: string, over: Partial<CameraModel> = {}): Partial<CameraModel> {
    return {
        id,
        solvedAt: 1_000,
        fingerprint: { deviceId: DEVICE, width: 1280, height: 720, referenceFrameHash: 'abc123' },
        boundTo: { connectionEpoch: 7, machineIdentifier: A350 },
        extrinsics: { offset: { x: -110, y: 0, z: -40 }, rotation: [[1, 0, 0], [0, 1, 0], [0, 0, 1]] },
        intrinsics: { fx: 900, fy: 900, cx: 640, cy: 360, k1: null },
        validBandZ: [320, 328],
        centralRegion: 0.6,
        residuals: { rmsPx: 1.2, maxPx: 3.1, rmsMm: 0.4, nPoints: 24, nPoses: 8 },
        solvedFrom: { surveyId: 'f00d', targets: ['tool-setter'], poses: [] },
        verification: { at: 2_000, pose: { x: 200, y: 150, z: 328 }, residualPx: 1.8, residualMm: 0.6 },
        state: 'verified',
        ...over,
    };
}

/** What set_camera_model hands add(). */
function solved(deviceId: string | null = DEVICE) {
    const model = rawModel('x', { verification: null, fingerprint: { deviceId, width: 1280, height: 720, referenceFrameHash: null } });
    delete model.id;
    delete model.solvedAt;
    delete model.state;
    return model;
}

/** The real cameraModelStore.ts over a Map-backed file system that counts writes and copies. */
function fixture(initial: { [file: string]: unknown } = {}) {
    const files = new Map<string, string>();
    for (const [name, value] of Object.entries(initial)) {
        files.set(name, JSON.stringify(value));
    }
    const counts = { writes: 0, copies: 0 };
    const fsStub = {
        readJsonSync: (name: string) => {
            if (!files.has(name)) {
                throw new Error(`ENOENT ${name}`);
            }
            return JSON.parse(files.get(name) as string);
        },
        writeJsonSync: (name: string, value: unknown) => {
            counts.writes += 1;
            files.set(name, JSON.stringify(value));
        },
        existsSync: (name: string) => files.has(name),
        copySync: (from: string, to: string) => {
            counts.copies += 1;
            files.set(to, files.get(from) as string);
        },
    };
    const module = isolatedModule('cameraModelStore.ts', {
        'fs-extra': fsStub,
        '../../DataStorage': { userDataDir: '/data' },
        '../../lib/logger': () => ({ info: () => undefined, error: () => undefined }),
        './cameraModel': {},
        './machineCapability': machineCapability,
        './machineStore': { machineStore: { currentMachine: () => ({ machineIdentifier: null, basis: null, deviceConflict: null }) } },
    });
    let scope: Scope = connected(A350);
    const open = () => new module.CameraModelStore({ file: () => FILE, scope: () => scope });
    return {
        module,
        files,
        counts,
        open,
        setScope: (next: Scope) => { scope = next; },
        backup: path.join(path.dirname(FILE), module.BACKUP_FILE),
        json: (name: string = FILE) => JSON.parse(files.get(name) as string),
    };
}

const LEGACY_FILE = { models: [rawModel('old1', { state: 'superseded' }), rawModel('live1')] };

export const tests: Array<[string, () => void]> = [
    ['migration: the untagged file is the A350\'s by the legacy rule, rewritten once with the original backed up', () => {
        const f = fixture({ [FILE]: LEGACY_FILE });
        const original = f.files.get(FILE);
        const store = f.open();
        const model = plain(store.current());
        assert.equal(model.id, 'live1', 'the A350 keeps the same model it used before');
        assert.equal(model.machineIdentifier, A350);
        assert.equal(model.legacyScope, true);
        assert.equal(f.counts.copies, 1);
        assert.equal(f.files.get(f.backup), original, 'the backup is the untouched pre-scoping file');
        const written = f.json();
        assert.equal(written.version, f.module.MODEL_FILE_VERSION);
        assert.deepEqual(written.models.map((m: CameraModel) => [m.id, m.machineIdentifier, m.legacyScope]), [['old1', A350, true], ['live1', A350, true]]);
        assert.deepEqual(written.migratedFrom.models, ['old1', 'live1']);
        assert.equal(written.migratedFrom.machineIdentifier, A350);
        assert.equal(written.migratedFrom.backup, f.backup);
    }],

    ['migration is idempotent, and the legacy flag survives a later save and reload', () => {
        const f = fixture({ [FILE]: LEGACY_FILE });
        const first = f.open();
        first.current();
        const writes = f.counts.writes;
        const after = f.files.get(FILE);
        const second = f.open();
        assert.equal(plain(second.current()).legacyScope, true);
        assert.equal(f.counts.writes, writes, 'an already-migrated file is not rewritten');
        assert.equal(f.counts.copies, 1, 'the backup is taken once');
        assert.equal(f.files.get(FILE), after);
        // verify_camera_model saves; a restart must still report the model as legacy.
        second.recordVerification('live1', { at: 3_000, pose: { x: 1, y: 2, z: 3 }, residualPx: 1, residualMm: 0.3 }, true);
        const third = plain(f.open().current());
        assert.equal(third.legacyScope, true);
        assert.equal(third.machineIdentifier, A350);
        assert.equal(f.counts.copies, 1);
    }],

    ['a model a rolled-back build appended is tagged A350 too, without overwriting the first backup', () => {
        const f = fixture({ [FILE]: LEGACY_FILE });
        f.open().current();
        const backup = f.files.get(f.backup);
        // The pre-scoping build rewrites only {models}, untagged.
        const rolledBack = f.json();
        f.files.set(FILE, JSON.stringify({ models: [...rolledBack.models.map((m: CameraModel) => ({ ...m, state: 'superseded' })), rawModel('rb1')] }));
        const store = f.open();
        const model = plain(store.current());
        assert.equal(model.id, 'rb1');
        assert.equal(model.machineIdentifier, A350);
        assert.equal(model.legacyScope, true);
        assert.equal(f.files.get(f.backup), backup, 'the first original is the one kept');
        assert.equal(f.counts.copies, 1);
    }],

    ['no file: nothing is written, and every machine has no model', () => {
        const f = fixture();
        const store = f.open();
        assert.equal(store.current(), null);
        assert.equal(store.current(connected(RAY)), null);
        assert.equal(f.counts.writes, 0);
        assert.equal(f.counts.copies, 0);
    }],

    ['the Ray and the Original see no model; the A350 sees the migrated one; no machine sees nothing', () => {
        const f = fixture({ [FILE]: LEGACY_FILE });
        const store = f.open();
        assert.equal(store.current(connected(RAY)), null);
        assert.equal(store.current(connected(ORIGINAL)), null);
        assert.deepEqual(plain(store.list(connected(RAY))), []);
        assert.equal(store.current(connected(null)), null);
        assert.equal(plain(store.current(connected(A350))).id, 'live1');
        // Disconnected: Luban's selected machine decides, like the per-machine store.
        f.setScope({ machineIdentifier: A350, basis: 'selected', deviceConflict: null });
        assert.equal(plain(store.current()).id, 'live1');
        f.setScope({ machineIdentifier: RAY, basis: 'selected', deviceConflict: null });
        assert.equal(store.current(), null);
    }],

    ['a model set on the Ray leaves the A350\'s current and verified, even after many Ray solves', () => {
        const f = fixture({ [FILE]: LEGACY_FILE });
        const store = f.open();
        const ray = plain(store.add(solved(), connected(RAY)));
        assert.equal(ray.machineIdentifier, RAY);
        assert.equal(ray.legacyScope, false);
        assert.equal(ray.state, 'unverified');
        assert.equal(plain(store.current(connected(RAY))).id, ray.id);
        const a350 = plain(store.current(connected(A350)));
        assert.equal(a350.id, 'live1');
        assert.equal(a350.state, 'verified', 'not superseded, not invalidated');
        for (let i = 0; i < 25; i++) {
            store.add(solved(), connected(RAY));
        }
        assert.equal(plain(store.current(connected(A350))).id, 'live1', 'Ray solves never evict the A350\'s model');
        assert.equal(store.list(connected(A350)).length, 2, 'nor its history');
        assert.equal(store.list(connected(RAY)).length, 20, 'retention is per machine');
        assert.equal(store.list(connected(RAY)).filter((m: CameraModel) => m.state !== 'superseded').length, 1);
        assert.equal(plain(f.open().current(connected(A350))).id, 'live1', 'and it persists');
    }],

    ['a new A350 solve supersedes only the A350\'s models; storing with no machine is refused', () => {
        const f = fixture({ [FILE]: LEGACY_FILE });
        const store = f.open();
        const ray = plain(store.add(solved(), connected(RAY)));
        const fresh = plain(store.add(solved(), connected(A350)));
        assert.equal(plain(store.current(connected(A350))).id, fresh.id);
        assert.equal(plain(store.get('live1')).state, 'superseded');
        assert.equal(plain(store.current(connected(RAY))).id, ray.id, 'the Ray\'s model is untouched');
        assert.throws(() => store.add(solved(), connected(null)), /no machine is connected or selected/);
    }],

    ['device id: recorded from the fingerprint, reported in machineScope, and judged - not used as a lookup key', () => {
        const f = fixture({ [FILE]: LEGACY_FILE });
        const store = f.open();
        const model = plain(store.current(connected(A350)));
        const scope = plain(f.module.describeCameraModelScope(connected(A350), model));
        assert.equal(scope.label, `${A350} (legacy)`);
        assert.equal(scope.legacy, true);
        assert.equal(scope.cameraDevice, DEVICE);
        assert.equal(scope.basis, 'connected');
        const ctx = (deviceId: string | null) => ({
            fingerprint: { deviceId, width: 1280, height: 720, referenceFrameHash: null },
            connectionEpoch: 7,
            machineIdentifier: A350,
            now: 5_000,
        });
        const other = judgeCameraModel(model, ctx('usb-Other_Camera'));
        assert.equal(other.usable, false, 'a different device on the same machine is a different geometry');
        assert.equal(other.remedy, 'camera_bootstrap');
        assert.equal(judgeCameraModel(model, ctx(null)).usable, true, 'an unnamed device is unknown, not different');
        // A model solved through an MJPEG URL names no device: stored and served all the same.
        const unnamed = plain(store.add(solved(null), connected(RAY)));
        assert.equal(plain(store.current(connected(RAY))).id, unnamed.id);
        assert.equal(plain(f.module.describeCameraModelScope(connected(RAY), unnamed)).cameraDevice, null);
        assert.equal(plain(f.module.describeCameraModelScope(connected(RAY), unnamed)).label, RAY);
    }],

    ['the no-model refusal names the machine, and get_stored_state shows which model applies where', () => {
        const f = fixture({ [FILE]: LEGACY_FILE });
        assert.ok(f.module.noCameraModelMessage(connected(RAY)).includes(`No camera model is stored for ${RAY}`));
        assert.ok(/No machine is connected or selected/.test(f.module.noCameraModelMessage(connected(null))));
        const store = f.open();
        store.add(solved(), connected(RAY));
        const described = plain(store.describe(connected(RAY)));
        assert.equal(described.machine, RAY);
        assert.equal(described.applying.label, RAY);
        type Row = { machineIdentifier: string; legacy: boolean; appliesNow: boolean };
        assert.deepEqual(described.models.map((m: Row) => [m.machineIdentifier, m.legacy, m.appliesNow]),
            [[RAY, false, true], [A350, true, false], [A350, true, false]]);
        assert.equal(described.migratedFrom.machineIdentifier, A350);
        assert.equal(plain(store.describe(connected(A350))).applying.label, `${A350} (legacy)`);
    }],

    ['applied_records names the camera model\'s machine (legacy) or none', () => {
        const source = fs.readFileSync(path.join(__dirname, '..', 'appliedRecords.ts'), 'utf8');
        const deps: Record<string, unknown> = {};
        const pattern = /from ['"]([^'"]+)['"]/g;
        for (let m = pattern.exec(source); m !== null; m = pattern.exec(source)) { deps[m[1]] = {}; }
        const applied = isolatedModule('appliedRecords.ts', deps);
        const facts = (machine: string, cameraModel: unknown) => ({
            machine: { identifier: machine, type: null, hasZ: true, dialect: 'x', verifiedOnHardware: false, gcodeForm: null, deviceId: null, machineKey: machine, basis: 'connected', deviceConflict: null },
            travel: null,
            zPolicy: null,
            landmarks: [],
            landmarkReview: null,
            toolSetter: null,
            probeGeometry: null,
            rotaryGeometry: null,
            activeTool: null,
            camera: { device: null, url: null },
            cameraModel,
            motionRules: null,
            unreadable: {},
        });
        assert.equal(applied.buildAppliedRecords(facts(A350, { id: 'live1', state: 'verified', legacy: true })).records.cameraModel,
            `${A350} record (legacy): live1 verified`);
        assert.equal(applied.buildAppliedRecords(facts(RAY, null)).records.cameraModel, 'none');
    }],
];
