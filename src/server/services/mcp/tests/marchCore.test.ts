import { strict as assert } from 'assert';

import {
    DescentIo,
    STEPPED_HOP_STEP_MM,
    SteppedIo,
    Words,
    Xyz,
    linkDescentCore,
    steppedTraverseCore,
} from '../marchCore';
import { isProcedureAbort } from '../procedureAbort';
import { planRaiseToTop } from '../traversePlan';

// A fake machine for the stepped traverse: the head moves where it is told
// (per-axis words over the last position), and material is a predicate on
// the position - the probe reads contact whenever the tip centre is inside
// it. Every move is logged so a test can assert the exact path.
interface Fake {
    io: SteppedIo & DescentIo;
    moves: { tag: string; words: Words; feed: number }[];
    position: Xyz;
    expected: boolean[];
}

function fakeMachine(start: Xyz, material: (p: Xyz) => boolean, fastDescentFail: ((z: number) => boolean) | null = null): Fake {
    const fake: Fake = { moves: [], position: { ...start }, expected: [], io: null as unknown as SteppedIo & DescentIo };
    let clock = 0;
    const apply = (words: Words) => {
        fake.position = {
            x: words.x === undefined ? fake.position.x : words.x,
            y: words.y === undefined ? fake.position.y : words.y,
            z: words.z === undefined ? fake.position.z : words.z,
        };
    };
    fake.io = {
        move: async (tag, words, feed) => {
            fake.moves.push({ tag, words, feed });
            apply(words);
        },
        moveZ: async (tag, z, feed) => {
            fake.moves.push({ tag, words: { z }, feed });
            apply({ z });
        },
        descendFast: async (tag, fromZ, toZ) => {
            fake.moves.push({ tag, words: { z: toZ }, feed: 600 });
            if (fastDescentFail && fastDescentFail(toZ)) {
                throw new Error('crash latch during the fast segments');
            }
            apply({ z: toZ });
        },
        sense: async () => material(fake.position),
        senseRelease: async () => material(fake.position),
        setExpectedContact: () => { fake.expected.push(true); },
        clearExpectedContact: () => { fake.expected.push(false); },
        now: () => { clock += 1; return clock; },
    };
    return fake;
}

const silent = () => undefined;
const near = (a: number, b: number, tol = 1e-6) => Math.abs(a - b) <= tol;

// The pass-2 geometry (job f84f2a263333): a pocket wall at machine Y 248.55
// (tip centre stops at ~247.63 - the wall minus the 0.625 tip radius and the
// approach), stations at Z 203.4, top at 206.4.
const WALL_Y = 247.7;
const TOP_Z = 206.4;
const inWall = (p: Xyz) => p.y >= WALL_Y && p.z < TOP_Z;

export const tests: Array<[string, () => Promise<void> | void]> = [
    ['wall link: the first contact retreats along the REVERSE travel vector, never +Z, and blocks the destination', async () => {
        // L274 of pocket_pass2.nc: from the L273 cycle start (193.57, 247.05) toward (192.17, 248.05) at Z 203.4.
        const from = { x: 193.57, y: 247.05, z: 203.4 };
        const to = { x: 192.17, y: 248.05, z: 203.4 };
        const d = { x: to.x - from.x, y: to.y - from.y };
        const len = Math.hypot(d.x, d.y);
        const u = { x: d.x / len, y: d.y / len };
        const fake = fakeMachine(from, inWall);
        const result = await steppedTraverseCore(fake.io, 'cam', 'L274', from, to, {
            retreatUnit: { x: -u.x, y: -u.y, z: 0 },
            liftMm: 2,
            maxLiftTotalMm: 2,
            onMax: 'block',
            onContact: 'block',
            capRetreatAtStart: true,
            sensorDelayMs: 50,
            releaseTimeoutMs: 100,
            travelFeed: 600,
        }, silent);
        assert.ok(result.blocked, 'the traverse reports the block');
        assert.ok(result.blocked!.contact.y >= WALL_Y, `contact recorded at the wall (y ${result.blocked!.contact.y})`);
        assert.deepEqual(result.blocked!.travelUnit, { x: Number(u.x.toFixed(3)), y: Number(u.y.toFixed(3)), z: 0 });
        // Every Z word in the whole traverse is the link Z: no +Z retreat inside a pocket.
        for (const m of fake.moves) {
            assert.ok(m.words.z === undefined || near(m.words.z, 203.4), `no Z change in a wall link (${JSON.stringify(m.words)})`);
        }
        // The retreat is 1 mm back (the hop-back) plus the 2 mm lift along -u, capped at the start.
        const back = fake.moves.filter((m) => m.tag.includes('hop-back'));
        const lift = fake.moves.filter((m) => m.tag.includes('hop-lift'));
        assert.equal(back.length, 1);
        assert.equal(lift.length, 1);
        const along = (p: Xyz) => (p.x - from.x) * u.x + (p.y - from.y) * u.y;
        assert.ok(along(result.position) < along(result.blocked!.contact), 'the head ends behind the contact along the path');
        assert.ok(along(result.position) >= -1e-6, 'never behind the traverse start');
        // The link is 1.72 mm long: step 1 clear, the step to the end touches; hop-back to s = 1, then
        // the 2 mm retreat is capped to the 1 mm of proven path behind that point - back at the start.
        assert.equal(result.blocked!.retreatMm, Number(len.toFixed(3)));
        assert.deepEqual(result.position, from);
        assert.equal(fake.expected[fake.expected.length - 1], false, 'expected contact cleared on return');
    }],

    ['wall link: a contact on the very first step retreats only to the start (nothing behind it is proven)', async () => {
        const from = { x: 100, y: 100, z: 203.4 };
        const to = { x: 100, y: 110, z: 203.4 };
        const fake = fakeMachine(from, (p) => p.y >= 100.5 && p.z < TOP_Z);
        const result = await steppedTraverseCore(fake.io, 'cam', 'first', from, to, {
            retreatUnit: { x: 0, y: -1, z: 0 },
            liftMm: 2,
            maxLiftTotalMm: 2,
            onMax: 'block',
            onContact: 'block',
            capRetreatAtStart: true,
            sensorDelayMs: 50,
            releaseTimeoutMs: 100,
            travelFeed: 600,
        }, silent);
        assert.ok(result.blocked);
        assert.deepEqual(result.position, { x: 100, y: 100, z: 203.4 }, 'back at the start, not beyond it');
        assert.equal(result.blocked!.retreatMm, STEPPED_HOP_STEP_MM, 'only the 1 mm hop-back; no lift room behind the start');
    }],

    ['top link (the old behaviour): a contact lifts +Z and retries the same step; the destination is reached higher', async () => {
        // A 3 mm step up in the surface half-way along the link.
        const from = { x: 0, y: 0, z: 10 };
        const to = { x: 6, y: 0, z: 10 };
        const fake = fakeMachine(from, (p) => p.x >= 3 && p.z < 12.5);
        const result = await steppedTraverseCore(fake.io, 'cam', 'top', from, to, {
            retreatUnit: { x: 0, y: 0, z: 1 },
            liftMm: 2,
            maxLiftTotalMm: 318,
            onMax: 'plain-move',
            sensorDelayMs: 50,
            releaseTimeoutMs: 100,
            travelFeed: 600,
        }, silent);
        assert.equal(result.blocked, null);
        assert.deepEqual(result.position, { x: 6, y: 0, z: 14 }, 'two 2 mm lifts clear a 2.5 mm step');
        assert.equal(result.lifts.length, 2);
    }],

    ['top link with a stated top: a lift that would leave the pocket blocks the station instead of climbing out', async () => {
        // Link at Z 203.4 inside a pocket whose top is 206.4; a wall at x >= 3.
        const from = { x: 0, y: 0, z: 203.4 };
        const to = { x: 6, y: 0, z: 203.4 };
        const fake = fakeMachine(from, (p) => p.x >= 3 && p.z < TOP_Z + 5);
        const result = await steppedTraverseCore(fake.io, 'cam', 'capped', from, to, {
            retreatUnit: { x: 0, y: 0, z: 1 },
            liftMm: 2,
            maxLiftTotalMm: TOP_Z - 203.4, // topLinkLiftCap: never above the top
            onMax: 'block',
            sensorDelayMs: 50,
            releaseTimeoutMs: 100,
            travelFeed: 600,
        }, silent);
        assert.ok(result.blocked, 'blocked rather than lifted onto the rim');
        const maxZ = Math.max(...fake.moves.map((m) => m.words.z ?? 0));
        assert.ok(maxZ <= TOP_Z + 1e-6, `never above the stated top (max Z ${maxZ})`);
        assert.ok(result.position.x < 3, 'head left behind the wall');
    }],

    ['link descent at a stepped destination: a contact on the way down is a BLOCKED station - lift back to the link Z, no abort', async () => {
        // Pass 2 step 3: the link climbed to 207.4 over the rim; the descent to 203.4 meets the top at 206.4.
        const fake = fakeMachine({ x: 192.17, y: 248.05, z: 207.4 }, (p) => p.z <= TOP_Z);
        const result = await linkDescentCore(fake.io, 'cam', 'L274', 207.4, 203.4, {
            guardMm: 20,
            sensorDelayMs: 50,
            releaseTimeoutMs: 100,
            guardFeed: 100,
            travelFeed: 600,
            onContact: () => 'block',
            mayBlock: true,
            toleranceMm: 0.05,
        }, silent);
        assert.equal(result.blocked, true);
        assert.ok(result.contactZ !== null && near(result.contactZ, 206.4), `contact at the top (${result.contactZ})`);
        assert.equal(result.z, 207.4, 'back at the Z the descent started from');
        assert.equal(fake.position.z, 207.4);
        assert.equal(fake.expected[0], false, 'the fast segments run with nothing expected (crash guard)');
        assert.ok(fake.expected.includes(true), 'the guarded steps run with the contact expected - sensed here, not latched');
        assert.equal(fake.expected[fake.expected.length - 1], false);
        // Nothing moved below the contact.
        const minZ = Math.min(...fake.moves.map((m) => m.words.z ?? 999));
        assert.ok(minZ >= 206.4 - 1e-6, `never pressed past the contact (min Z ${minZ})`);
    }],

    ['link descent in raise mode with no stated top: a contact is still an abort, and the abort path raises straight to the traverse height', async () => {
        const fake = fakeMachine({ x: 10, y: 10, z: 328 }, (p) => p.z <= 210);
        let error: unknown = null;
        try {
            await linkDescentCore(fake.io, 'cam', 'L9', 328, 200, {
                guardMm: 20,
                sensorDelayMs: 50,
                releaseTimeoutMs: 100,
                guardFeed: 100,
                travelFeed: 600,
                onContact: () => 'abort',
                mayBlock: false,
                toleranceMm: 0.05,
            }, silent);
        } catch (err) {
            error = err;
        }
        assert.ok(isProcedureAbort(error), 'a ProcedureAbort, which the runner answers with abortRaiseToTop');
        assert.ok(!fake.expected.includes(true), 'no contact was expected: the crash guard stayed armed');
        // Law 8: from wherever the contact left the head, the abort decision is one Z-only raise to the traverse height.
        const decision = planRaiseToTop(fake.position.z, 328);
        assert.equal(decision.action, 'raise');
        assert.equal(decision.targetZ, 328);
    }],

    ['link descent that reaches its target reports no block and ends at the target', async () => {
        const fake = fakeMachine({ x: 0, y: 0, z: 328 }, () => false);
        const result = await linkDescentCore(fake.io, 'cam', 'L5', 328, 203.4, {
            guardMm: 20,
            sensorDelayMs: 50,
            releaseTimeoutMs: 100,
            guardFeed: 100,
            travelFeed: 600,
            onContact: () => 'block',
            mayBlock: true,
            toleranceMm: 0.05,
        }, silent);
        assert.deepEqual(result, { contactZ: null, z: 203.4, blocked: false });
        const fast = fake.moves.find((m) => m.tag.includes(':descend:'));
        assert.ok(fast && near(fast.words.z as number, 223.4), 'fast segments stop 20 mm above the target');
        const guarded = fake.moves.filter((m) => m.tag.includes('descend-guard'));
        assert.equal(guarded.length, 20, 'then 1 mm guarded steps');
    }],

    ['a descent whose start is below its target is refused (a descent never rises)', async () => {
        const fake = fakeMachine({ x: 0, y: 0, z: 200 }, () => false);
        let error: unknown = null;
        try {
            await linkDescentCore(fake.io, 'cam', 'L5', 200, 203.4, {
                guardMm: 20, sensorDelayMs: 50, releaseTimeoutMs: 100, guardFeed: 100, travelFeed: 600, onContact: () => 'block', mayBlock: true, toleranceMm: 0.05,
            }, silent);
        } catch (err) {
            error = err;
        }
        assert.ok(isProcedureAbort(error) && (error as Error).message.includes('never rises'));
        assert.equal(fake.moves.length, 0);
    }],
];

const topParams = {
    retreatUnit: { x: 0, y: 0, z: 1 },
    liftMm: 2,
    maxLiftTotalMm: 20,
    onMax: 'plain-move' as const,
    sensorDelayMs: 50,
    releaseTimeoutMs: 100,
    travelFeed: 600,
};
tests.push(
    ['0.5 mm shoulder link adds at most one ball radius along its verified incoming corridor before rising', async () => {
        const from = { x: 0, y: 259, z: 194.2 };
        const fake = fakeMachine(from, (p) => p.y >= 259.5 && p.z < 200);
        const result = await steppedTraverseCore(fake.io, 'scan', 's20', from, { ...from, y: 259.5 }, {
            ...topParams, extraBackoffMm: 1.25, backtrackMm: 1.25,
        }, silent);
        assert.equal(result.blocked, null);
        const extra = fake.moves.filter((m) => m.tag.includes('hop-back-extra'));
        assert.ok(extra.length);
        assert.equal(Math.min(...extra.map((m) => m.words.y!)), 257.75);
        assert.ok(fake.moves.filter((m) => m.tag.includes('hop-lift')).every((m) => m.words.y! < 259.5));
        assert.ok(result.position.z >= 200);
    }],
    ['extra backoff releases a ball that remains triggered at the ordinary backoff', async () => {
        const from = { x: 0, y: 259, z: 194.2 };
        let latched = false;
        const fake = fakeMachine(from, (p) => {
            if (p.y >= 259.5 && p.z < 196) { latched = true; }
            if (p.y <= 258.5 || p.z >= 196) { latched = false; }
            return latched;
        });
        const result = await steppedTraverseCore(fake.io, 'scan', 's20', from, { ...from, y: 259.5 }, {
            ...topParams, extraBackoffMm: 1.25, backtrackMm: 0.5,
        }, silent);
        assert.equal(result.blocked, null);
        assert.equal(Math.min(...fake.moves.map((m) => m.words.y ?? 259)), 258.5, 'never leaves verified corridor');
    }],
    ['catch during rise aborts before another XY step even if the contact subsequently releases', async () => {
        const from = { x: 0, y: 0, z: 10 };
        const fake = fakeMachine(from, (p) => p.x >= 0.5 && p.z < 14 || p.z >= 10.5);
        await assert.rejects(async () => steppedTraverseCore(fake.io, 'scan', 's2', from, { ...from, x: 0.5 }, topParams, silent), /contact during lift/);
        assert.ok(fake.moves[fake.moves.length - 1].tag.includes('hop-lift'));
        assert.equal(fake.position.x, 0);
        assert.equal(fake.position.z, 10.5);
    }],
    ['fractional backoff reports its actual distance and never backs beyond an unverified start', async () => {
        let touched = false;
        const from = { x: 0, y: 0, z: 10 };
        const fake = fakeMachine(from, (p) => { touched = touched || p.x >= 0.5; return touched; });
        await assert.rejects(async () => steppedTraverseCore(fake.io, 'scan', 's2', from, { ...from, x: 0.5 }, {
            ...topParams, extraBackoffMm: 1.25,
        }, silent), /backing off 0.5 mm/);
        assert.equal(Math.min(...fake.moves.map((m) => m.words.x ?? 0)), 0);
        assert.ok(!fake.moves.some((m) => m.tag.includes('hop-lift')));
    }],
);
