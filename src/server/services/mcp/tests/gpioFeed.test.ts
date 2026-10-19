import assert from 'assert';
import { EventEmitter } from 'events';
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import ts from 'typescript';
import type { GpioProbeTransport } from '../gpioFeed';
import * as health from '../probeFeedHealth';
import * as transport from '../probeTransport';

// Run the actual transport against a fake child and clock. Never import Blinka or touch USB.
function fixture() {
    let now = 0;
    let nextId = 0;
    let resets = 0;
    let kills = 0;
    let closes = 0;
    type Timer = { at: number; callback: () => void | Promise<void> };
    const timers = new Map<number, Timer>();
    const child = Object.assign(new EventEmitter(), {
        pid: 123,
        stdout: new EventEmitter(),
        stderr: new EventEmitter(),
        kill: () => { kills++; child.emit('exit', null, 'SIGTERM'); },
    });
    const dependencies: Record<string, unknown> = {
        child_process: { spawn: () => child },
        events: { EventEmitter },
        '../../lib/logger': () => ({ info: () => undefined, warn: () => undefined, error: () => undefined }),
        '../configstore': { get: () => undefined },
        './diagnostics': { recordSensorLatency: () => undefined },
        './probeTransport': transport,
        './probeFeedHealth': health,
        './usbBridgeReset': {
            resetStrandedBridges: async () => {
                assert.strictEqual(kills, 1, 'release the monitor USB claim before checking for a stranded bridge');
                assert.strictEqual(closes, 0, 'do not reconnect before USB recovery completes');
                resets++;
                return { reset: [], skipped: [], error: null };
            },
            describeBridgeReset: () => ' USB recovery attempted.',
        },
    };
    const source = fs.readFileSync(path.join(__dirname, '../gpioFeed.ts'), 'utf8');
    const compiled = ts.transpileModule(source, { compilerOptions: {
        module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2019, esModuleInterop: true,
    } });
    const exports: Record<string, any> = {}; // eslint-disable-line @typescript-eslint/no-explicit-any
    vm.runInNewContext(compiled.outputText, {
        exports,
        Buffer,
        process: { env: {}, platform: 'linux' },
        setTimeout: (callback: () => void | Promise<void>, delay: number) => {
            nextId++; timers.set(nextId, { at: now + delay, callback }); return nextId;
        },
        clearTimeout: (id: number) => timers.delete(id),
        require: (name: string) => {
            if (!(name in dependencies)) { throw new Error(`Unstubbed dependency: ${name}`); }
            return dependencies[name];
        },
    });
    const feed: GpioProbeTransport = new exports.GpioProbeTransport({
        ...exports.resolveGpioFeedConfig(), pins: { toolsetter: { pin: 'D2', pull: 'up' }, overtravel: null, probe: null },
    });
    const errors: string[] = [];
    feed.on('close', () => { closes++; });
    feed.on('error', (error: Error) => errors.push(error.message));
    const result = feed.connect().then(() => null, (error: Error) => error);
    const send = (message: object) => child.stdout.emit('data', Buffer.from(`${JSON.stringify(message)}\n`));
    const advance = async (ms: number) => {
        const until = now + ms;
        for (;;) {
            const next = [...timers.entries()].sort((a, b) => a[1].at - b[1].at)[0];
            if (!next || next[1].at > until) { break; }
            now = next[1].at;
            timers.delete(next[0]);
            await next[1].callback();
        }
        now = until;
    };
    return { feed, child, errors, result, send, advance, timers, resets: () => resets, kills: () => kills };
}

export const tests: Array<[string, () => Promise<void>]> = [
    ['stuck first pin survives the heartbeat deadline and reaches USB recovery at 30 seconds', async () => {
        const f = fixture();
        f.send({ t: 'progress', stage: 'imported', board: 'KB2040_U2IF' });
        await f.advance(5000);
        assert.strictEqual(f.kills(), 0);
        assert.strictEqual(f.feed.isConnected(), false);
        await f.advance(24999);
        assert.strictEqual(f.resets(), 0);
        await f.advance(1);
        assert.strictEqual(f.resets(), 1);
        assert.strictEqual(f.kills(), 1);
        assert.match((await f.result)?.message || '', /USB recovery attempted/);
        assert.strictEqual(f.timers.size, 0);
    }],
    ['slow startup can become ready after five seconds, and ready alone arms the heartbeat watchdog', async () => {
        const f = fixture();
        f.send({ t: 'progress', stage: 'imported', board: 'KB2040_U2IF' });
        await f.advance(6000);
        f.send({ t: 'progress', stage: 'pin', channel: 'toolsetter' });
        await f.advance(6000);
        f.send({ t: 'ready', board: 'KB2040_U2IF' });
        assert.strictEqual(await f.result, null);
        assert.strictEqual(f.feed.isConnected(), true);
        await f.advance(4999);
        assert.strictEqual(f.kills(), 0);
        await f.advance(1);
        assert.strictEqual(f.kills(), 1);
        assert.match(f.errors[0], /silent for 5000 ms/);
        assert.strictEqual(f.feed.isConnected(), false);
        await f.advance(30000);
        assert.strictEqual(f.resets(), 0);
    }],
    ['live heartbeats extend the watchdog; stopping cancels all deadlines', async () => {
        const f = fixture();
        f.send({ t: 'ready', board: 'KB2040_U2IF' });
        await f.result;
        await f.advance(4000);
        f.send({ t: 'hb', values: { toolsetter: '0' } });
        await f.advance(4000);
        assert.strictEqual(f.kills(), 0);
        f.feed.end();
        await f.advance(60000);
        assert.strictEqual(f.kills(), 1);
        assert.strictEqual(f.resets(), 0);
        assert.strictEqual(f.timers.size, 0);
    }],
    ['silent imports and later pin stalls time out without resetting an unrelated USB interface', async () => {
        for (const partial of [false, true]) {
            const f = fixture();
            if (partial) {
                f.send({ t: 'progress', stage: 'imported', board: 'KB2040_U2IF' });
                f.send({ t: 'progress', stage: 'pin', channel: 'toolsetter' });
            }
            await f.advance(29999);
            assert.strictEqual(f.kills(), 0);
            await f.advance(1);
            assert.ok(await f.result);
            assert.strictEqual(f.kills(), 1);
            assert.strictEqual(f.resets(), 0);
        }
    }],
    ['ending during startup cancels USB recovery', async () => {
        const f = fixture();
        f.send({ t: 'progress', stage: 'imported', board: 'KB2040_U2IF' });
        f.feed.end();
        await f.advance(60000);
        assert.ok(await f.result);
        assert.strictEqual(f.resets(), 0);
        assert.strictEqual(f.timers.size, 0);
    }],
];
