import assert from 'assert';
import { Dispatcher } from '@snapmaker/snapmaker-sacp-sdk';
import Header, { Attribute, PeerId } from '@snapmaker/snapmaker-sacp-sdk/dist/communication/Header';
import Packet from '@snapmaker/snapmaker-sacp-sdk/dist/communication/Packet';
import Response from '@snapmaker/snapmaker-sacp-sdk/dist/communication/Response';
import { stringToBuffer } from '@snapmaker/snapmaker-sacp-sdk/dist/helper';
import {
    GcodeReply, LOG_FEEDBACK_LEVEL, LogFeedCallback, LogFeedOps, LubanLogFeed, ReplyEmitter, endsReply, parseGcodeAckData,
    parseLogFeedbackData, readGcodeReply, sacpBusinessId, SACP_LOG_FEEDBACK, withLogFeed,
} from '../../machine/channels/sacpGcodeReply';

// The SACP reply read (sacpGcodeReply.ts) against real packet bytes: packets
// are built with the SDK's own Header/Packet and fed through a real SDK
// Dispatcher over a fake UDP socket, so the parse path is the one Luban runs.

/** SACP packet bytes from the controller to Luban. */
function controllerPacket(commandSet: number, commandId: number, attribute: number, sequence: number, payload: Buffer): Buffer {
    const header = new Header();
    header.length = payload.byteLength + 8;
    header.commandSet = commandSet;
    header.commandId = commandId;
    header.attribute = attribute;
    header.receiverId = PeerId.LUBAN;
    header.senderId = PeerId.CONTROLLER;
    header.sequence = sequence;
    return new Packet(header, payload).toBuffer();
}

/** A 0x01 0xa1 log notification: payload = result byte, level, SACP String. */
function logPacket(text: string, sequence = 900, attribute = Attribute.ACK): Buffer {
    return controllerPacket(0x01, 0xa1, attribute, sequence, Buffer.concat([Buffer.from([0, 2]), stringToBuffer(text)]));
}

/** A real Dispatcher on a fake UDP socket; `sent` collects the request bytes Luban would put on the wire. */
function dispatcher() {
    const sent: Buffer[] = [];
    const client = new Dispatcher('udp', { socket: { send: (buffer: Buffer) => sent.push(buffer) }, host: '127.0.0.1', port: 8888 });
    return { client, sent };
}

/** Answer the last 0x01 0x02 request with an ACK carrying `ackData` after the result byte. */
function ackLastGcode(d: ReturnType<typeof dispatcher>, result = 0, ackData: Buffer = Buffer.alloc(0)): void {
    const request = new Packet().fromBuffer(d.sent[d.sent.length - 1]);
    assert.equal(request.header.commandSet, 0x01);
    assert.equal(request.header.commandId, 0x02);
    d.client.read(controllerPacket(0x01, 0x02, Attribute.ACK, request.header.sequence, Buffer.concat([Buffer.from([result]), ackData])));
}

const noLogCallback = () => undefined;

type Answer = number | 'silent';

/** The SDK's request result, which it types as possibly undefined (a send error it swallowed). */
export function answered<T>(value: T | undefined): T {
    assert.ok(value, 'the SDK resolved the request without a response');
    return value as T;
}

/**
 * A controller on the far side of a real SDK Dispatcher: answers 0x01 0x10
 * (level), 0x01 0x00 / 0x01 0x01 for 0x01 0xa1 (subscribe / unsubscribe) and
 * 0x01 0x02 (G-code) by script - 'silent' never answers - and pushes the
 * reply on the log feed ONLY while subscribed (the Ray: result 0, no ACK text).
 */
export function controller(script: { level?: Answer; subscribe?: Answer; unsubscribe?: Answer; gcode?: Answer; reply?: string[] } = {}) {
    const sent: Packet[] = [];
    const state = { subscribed: false, level: null as number | null };
    let logSequence = 2000;
    const holder: { client: Dispatcher | null } = { client: null };
    const answer = (request: Packet, result: number) => (holder.client as Dispatcher).read(controllerPacket(
        request.header.commandSet, request.header.commandId, Attribute.ACK, request.header.sequence, Buffer.from([result]),
    ));
    const respond = (request: Packet) => {
        const { commandSet, commandId } = request.header;
        const feed = request.payload[0] === 0x01 && request.payload[1] === 0xa1;
        if (commandSet !== 0x01) {
            return;
        }
        if (commandId === 0x10 && script.level !== 'silent') {
            const result = script.level === undefined ? 0 : script.level;
            state.level = result === 0 ? request.payload[0] : state.level;
            answer(request, result);
        } else if (commandId === 0x00 && feed && script.subscribe !== 'silent') {
            const result = script.subscribe === undefined ? 0 : script.subscribe;
            state.subscribed = state.subscribed || result === 0;
            answer(request, result);
        } else if (commandId === 0x01 && feed && script.unsubscribe !== 'silent') {
            const result = script.unsubscribe === undefined ? 0 : script.unsubscribe;
            state.subscribed = state.subscribed && result !== 0;
            answer(request, result);
        } else if (commandId === 0x02 && script.gcode !== 'silent') {
            answer(request, script.gcode === undefined ? 0 : script.gcode);
            for (const line of (state.subscribed ? script.reply || [] : [])) {
                (holder.client as Dispatcher).read(logPacket(line, logSequence++));
            }
        }
    };
    const client = new Dispatcher('udp', {
        socket: { send: (buffer: Buffer) => {
            const request = new Packet().fromBuffer(buffer);
            sent.push(request);
            setTimeout(() => respond(request), 1);
        } },
        host: '127.0.0.1',
        port: 8888,
    });
    holder.client = client;
    // The same calls SacpClient makes (logFeedbackLevel / subscribeLogFeedback / unSubscribeLogFeedback).
    const ops: LogFeedOps = {
        listeners: () => client.listeners('417') as LogFeedCallback[],
        removeListener: (callback) => { client.removeListener('417', callback); },
        setLevel: async (level) => answered(await client.send(0x01, 0x10, PeerId.CONTROLLER, Buffer.alloc(1, level))).response.result,
        subscribe: async (callback) => answered(await client.subscribe(0x01, 0xa1, 60000, callback)).response.result,
        unsubscribe: async (callback) => answered(await client.unsubscribe(0x01, 0xa1, callback)).response.result,
    };
    /** What Luban put on the wire, as "set id" in hex. */
    const wire = () => sent.map((p) => `${p.header.commandSet.toString(16)} ${p.header.commandId.toString(16)}`);
    return { client, sent, state, ops, wire };
}

/** One G-code reply read on a controller() client, the way SacpChannelBase.executeGcodeWithReply runs it. */
function readOn(c: ReturnType<typeof controller>, line: string, timeoutMs = 400) {
    return async (subscribedBefore: boolean | null): Promise<GcodeReply> => readGcodeReply({
        emitter: c.client as unknown as ReplyEmitter,
        send: async () => c.client.send(0x01, 0x02, PeerId.CONTROLLER, stringToBuffer(line)),
        timeoutMs,
        quietMs: 100,
        subscribed: subscribedBefore,
    });
}

/** Luban's own log setup as the channel records it; defaults: settled, level refused, never subscribed. */
function lubanFeed(overrides: Partial<LubanLogFeed> = {}): LubanLogFeed {
    return { callback: null, requestedAt: 0, pending: false, levelResult: 1, ...overrides };
}

/** Luban's own subscription made the way startHeartbeatLegacy makes it, on a controller() client. */
async function lubanSubscribes(c: ReturnType<typeof controller>, feed: LubanLogFeed): Promise<void> {
    const callback: LogFeedCallback = () => undefined;
    feed.callback = callback;
    feed.levelResult = await c.ops.setLevel(2);
    await c.ops.subscribe(callback);
}

export const tests: Array<[string, () => void | Promise<void>]> = [
    ['the 0x01 0x02 request carries the line as a SACP String; a result-only ACK parses to no text', () => {
        const d = dispatcher();
        d.client.send(0x01, 0x02, PeerId.CONTROLLER, stringToBuffer('$$'));
        const request = new Packet().fromBuffer(d.sent[0]);
        assert.equal(request.payload.readUInt16LE(0), 2);
        assert.equal(request.payload.slice(2).toString(), '$$');
        const ack = new Packet().fromBuffer(controllerPacket(0x01, 0x02, Attribute.ACK, request.header.sequence, Buffer.from([0])));
        const response = new Response().fromBuffer(ack.payload);
        assert.equal(response.result, 0);
        assert.deepEqual(parseGcodeAckData(response.data), { bytes: 0, text: null, form: null, hex: null });
    }],
    ['ACK payload text: a whole SACP String, plain bytes, and non-text reported as hex', () => {
        const asString = parseGcodeAckData(stringToBuffer('[VER:1.1f.20170801:]\nok'));
        assert.equal(asString.form, 'sacp-string');
        assert.equal(asString.text, '[VER:1.1f.20170801:]\nok');
        const raw = parseGcodeAckData(Buffer.from('$30=1000\nok\0'));
        assert.equal(raw.form, 'raw');
        assert.equal(raw.text, '$30=1000\nok');
        const binary = parseGcodeAckData(Buffer.from([0x01, 0xff, 0x00, 0x9c]));
        assert.equal(binary.text, null);
        assert.equal(binary.hex, '01ff009c');
    }],
    ['log feedback data parses as level + SACP String (the layout startHeartbeatLegacy reads)', () => {
        const packet = new Packet().fromBuffer(logPacket('[GC:G0 G54 G17 G21 G90 G94 M5 M9 T0 F0 S0]'));
        const response = new Response().fromBuffer(packet.payload);
        assert.deepEqual(parseLogFeedbackData(response.data), { level: 2, text: '[GC:G0 G54 G17 G21 G90 G94 M5 M9 T0 F0 S0]' });
        assert.equal(parseLogFeedbackData(Buffer.from([2, 9, 0, 0x41])), null, 'a string longer than the buffer is no line');
        assert.equal(sacpBusinessId(SACP_LOG_FEEDBACK), '417');
        assert.ok(endsReply('$32=1\nok'));
        assert.ok(endsReply('error:9'));
        assert.ok(!endsReply('$32=1'));
    }],
    ['a reply streamed on the log feedback is collected up to "ok", through a real Dispatcher', async () => {
        const d = dispatcher();
        d.client.on(sacpBusinessId(SACP_LOG_FEEDBACK), noLogCallback); // Luban's own subscription (startHeartbeatLegacy)
        const reply = await readGcodeReply({
            emitter: d.client as unknown as ReplyEmitter,
            send: async () => {
                const sent = d.client.send(0x01, 0x02, PeerId.CONTROLLER, stringToBuffer('$$'));
                setTimeout(() => {
                    ackLastGcode(d);
                    d.client.read(logPacket('$110=6000.000\n$111=6000.000', 901));
                    d.client.read(logPacket('$120=500.000\n$121=500.000', 902, Attribute.REQUEST));
                    d.client.read(logPacket('ok', 903));
                }, 5);
                return sent;
            },
            timeoutMs: 2000,
            quietMs: 500,
        });
        assert.equal(reply.result, 0);
        assert.equal(reply.source, 'log-feedback');
        assert.equal(reply.text, '$110=6000.000\n$111=6000.000\n$120=500.000\n$121=500.000\nok');
        assert.equal(reply.log.subscribed, true);
        assert.equal(reply.log.lines.length, 3);
        assert.equal(reply.timedOut, false);
        assert.ok(reply.elapsedMs < 500, `ended on the "ok" terminator, not the quiet period (${reply.elapsedMs} ms)`);
        assert.equal(d.client.listenerCount('417'), 1, 'only Luban\'s own log listener remains');
    }],
    ['text in the ACK payload wins and needs no log wait', async () => {
        const d = dispatcher();
        const reply = await readGcodeReply({
            emitter: d.client as unknown as ReplyEmitter,
            send: async () => {
                const sent = d.client.send(0x01, 0x02, PeerId.CONTROLLER, stringToBuffer('$I'));
                setTimeout(() => ackLastGcode(d, 0, stringToBuffer('[VER:1.1f.20170801:]\n[OPT:V,15,128]\nok')), 5);
                return sent;
            },
            timeoutMs: 2000,
            quietMs: 1500,
        });
        assert.equal(reply.source, 'ack-payload');
        assert.equal(reply.ack.form, 'sacp-string');
        assert.match(String(reply.text), /VER:1\.1f/);
        assert.ok(reply.elapsedMs < 1000);
        assert.equal(reply.log.subscribed, false, 'no 0x01 0xa1 subscription on this client');
        assert.equal(d.client.listenerCount('417'), 0, 'the temporary listener is removed');
    }],
    ['an ACK with no text and a silent log: result 0, text null, and the report says what was seen', async () => {
        const d = dispatcher();
        d.client.on('417', noLogCallback);
        const reply = await readGcodeReply({
            emitter: d.client as unknown as ReplyEmitter,
            send: async () => {
                const sent = d.client.send(0x01, 0x02, PeerId.CONTROLLER, stringToBuffer('M1005'));
                setTimeout(() => ackLastGcode(d), 5);
                return sent;
            },
            timeoutMs: 2000,
            quietMs: 150,
        });
        assert.equal(reply.result, 0);
        assert.equal(reply.text, null);
        assert.equal(reply.source, null);
        assert.equal(reply.ack.received, true);
        assert.equal(reply.ack.bytes, 0);
        assert.equal(reply.log.subscribed, true);
        assert.equal(reply.log.lines.length, 0);
        assert.equal(reply.timedOut, false);
    }],
    ['a refused line (result != 0) and a missing ACK both report result -1 with the reason', async () => {
        const d = dispatcher();
        const refused = await readGcodeReply({
            emitter: d.client as unknown as ReplyEmitter,
            send: async () => {
                const sent = d.client.send(0x01, 0x02, PeerId.CONTROLLER, stringToBuffer('$$'));
                setTimeout(() => ackLastGcode(d, 9), 5);
                return sent;
            },
            timeoutMs: 1000,
        });
        assert.equal(refused.result, -1);
        assert.match(String(refused.error), /result 9/);
        const silent = await readGcodeReply({
            emitter: d.client as unknown as ReplyEmitter,
            send: async () => new Promise(() => undefined),
            timeoutMs: 100,
        });
        assert.equal(silent.result, -1);
        assert.equal(silent.timedOut, true);
        assert.equal(d.client.listenerCount('417'), 0);
    }],

    // ---- withLogFeed: the read's own log subscription (the Ray, 2026-10-19) ---------------
    ['not subscribed by Luban: the read sets level 2, subscribes 0x01 0xa1 (on the wire), reads the text, then unsubscribes', async () => {
        const c = controller({ reply: ['[GC:G0 G54 G17 G21 G90 G94 M5 M9 T0 F0 S0]', 'ok'] });
        const feed = lubanFeed();
        const reply = await withLogFeed({ ops: c.ops, luban: () => feed, stepTimeoutMs: 400 }, readOn(c, '$G'));
        assert.deepEqual(c.wire(), ['1 10', '1 0', '1 2', '1 1'], 'level, subscribe (really sent), the query, unsubscribe');
        assert.equal(c.state.level, LOG_FEEDBACK_LEVEL);
        assert.equal(reply.source, 'log-feedback');
        assert.equal(reply.text, '[GC:G0 G54 G17 G21 G90 G94 M5 M9 T0 F0 S0]\nok');
        assert.equal(reply.log.subscribed, false, 'the state BEFORE the read, not the read\'s own subscription');
        const report = reply.feed;
        assert.ok(report);
        assert.equal(report.lubanSubscribed, false);
        assert.equal(report.levelSetByRead, true);
        assert.equal(report.levelResult, 0);
        assert.equal(report.subscribedByRead, true);
        assert.equal(report.subscribeResult, 0);
        assert.equal(report.unsubscribeResult, 0);
        assert.equal(report.restored, true);
        assert.equal(report.levelRestored, false, 'the level is set-only: reported, not invented');
        assert.ok(report.notes.some((n) => /set-only/.test(n)));
        assert.equal(c.state.subscribed, false, 'the controller is unsubscribed again');
        assert.equal(c.client.listenerCount('417'), 0, 'no listener left behind');
    }],
    ['already subscribed by Luban: nothing but the query is sent, and Luban\'s subscription and level stay', async () => {
        const c = controller({ reply: ['$32=1', 'ok'] });
        const feed = lubanFeed();
        await lubanSubscribes(c, feed);
        const before = c.sent.length;
        const lubanCallback = feed.callback;
        const reply = await withLogFeed({ ops: c.ops, luban: () => feed, stepTimeoutMs: 400 }, readOn(c, '$$'));
        assert.deepEqual(c.wire().slice(before), ['1 2'], 'no level, no subscribe, no unsubscribe');
        assert.equal(reply.text, '$32=1\nok');
        assert.equal(reply.log.subscribed, true);
        assert.equal(reply.feed && reply.feed.lubanSubscribed, true);
        assert.equal(reply.feed && reply.feed.levelSetByRead, false);
        assert.equal(reply.feed && reply.feed.levelRestored, null);
        assert.equal(reply.feed && reply.feed.restored, true);
        assert.equal(c.state.subscribed, true);
        assert.deepEqual(c.client.listeners('417'), [lubanCallback], 'only Luban\'s callback');
    }],
    ['Luban set the level but is not subscribed: the read subscribes and unsubscribes, and leaves the level alone', async () => {
        const c = controller({ reply: ['ok'] });
        const reply = await withLogFeed({ ops: c.ops, luban: () => lubanFeed({ levelResult: 0 }), stepTimeoutMs: 400 }, readOn(c, '$I'));
        assert.deepEqual(c.wire(), ['1 0', '1 2', '1 1']);
        assert.equal(reply.feed && reply.feed.levelSetByRead, false);
        assert.equal(reply.feed && reply.feed.levelRestored, null);
        assert.equal(reply.feed && reply.feed.lubanLevelSet, true);
    }],
    ['the read throws or times out: the subscription is still removed (finally)', async () => {
        const thrown = controller();
        await assert.rejects(withLogFeed({ ops: thrown.ops, luban: () => lubanFeed(), stepTimeoutMs: 400 }, async () => {
            throw new Error('read blew up');
        }), /read blew up/);
        assert.deepEqual(thrown.wire(), ['1 10', '1 0', '1 1']);
        assert.equal(thrown.state.subscribed, false);
        assert.equal(thrown.client.listenerCount('417'), 0);
        const silent = controller({ gcode: 'silent' });
        const reply = await withLogFeed({ ops: silent.ops, luban: () => lubanFeed(), stepTimeoutMs: 400 }, readOn(silent, '$$', 150));
        assert.equal(reply.timedOut, true);
        assert.equal(reply.result, -1);
        assert.deepEqual(silent.wire(), ['1 10', '1 0', '1 2', '1 1']);
        assert.equal(reply.feed && reply.feed.restored, true);
        assert.equal(silent.state.subscribed, false);
        assert.equal(silent.client.listenerCount('417'), 0);
    }],
    ['an unanswered unsubscribe is bounded: the read returns, restored false, and no listener is left', async () => {
        const c = controller({ unsubscribe: 'silent', reply: ['ok'] });
        const started = Date.now();
        const reply = await withLogFeed({ ops: c.ops, luban: () => lubanFeed(), stepTimeoutMs: 150 }, readOn(c, '$#'));
        assert.ok(Date.now() - started < 1500, 'did not wait on the SDK (it has no timeout)');
        assert.equal(reply.feed && reply.feed.restored, false);
        assert.equal(reply.feed && reply.feed.unsubscribeResult, null);
        assert.ok(reply.feed && reply.feed.notes.some((n) => /unsubscribe log feed: no answer/.test(n)));
        assert.equal(c.client.listenerCount('417'), 0, 'removed locally even though the SDK did not');
    }],
    ['unanswered level and subscribe: bounded, the read still runs, and an unsubscribe is sent in case it took', async () => {
        const c = controller({ level: 'silent', subscribe: 'silent' });
        const reply = await withLogFeed({ ops: c.ops, luban: () => lubanFeed(), stepTimeoutMs: 100 }, readOn(c, 'M1005', 300));
        assert.deepEqual(c.wire(), ['1 10', '1 0', '1 2', '1 1']);
        assert.equal(reply.result, 0);
        assert.equal(reply.text, null);
        assert.equal(reply.feed && reply.feed.levelResult, null);
        assert.equal(reply.feed && reply.feed.subscribeResult, null);
        assert.equal(reply.feed && reply.feed.restored, true);
        assert.equal(c.client.listenerCount('417'), 0);
    }],
    ['a refused subscribe needs no undo: no unsubscribe is sent', async () => {
        const c = controller({ subscribe: 9, reply: ['ok'] });
        const reply = await withLogFeed({ ops: c.ops, luban: () => lubanFeed(), stepTimeoutMs: 400 }, readOn(c, '$G'));
        assert.deepEqual(c.wire(), ['1 10', '1 0', '1 2']);
        assert.equal(reply.feed && reply.feed.subscribedByRead, false);
        assert.equal(reply.feed && reply.feed.subscribeResult, 9);
        assert.equal(reply.feed && reply.feed.restored, true);
        assert.equal(reply.text, null, 'nothing pushes a log');
        assert.equal(c.client.listenerCount('417'), 0);
    }],
    ['Luban subscribes while the read runs (the connect race): its subscription stays, only the read\'s listener goes', async () => {
        const c = controller({ reply: ['ok'] });
        const feed = lubanFeed({ levelResult: 0 });
        const reply = await withLogFeed({ ops: c.ops, luban: () => feed, stepTimeoutMs: 400 }, async (subscribedBefore) => {
            const lubanCallback: LogFeedCallback = () => undefined;
            feed.callback = lubanCallback;
            await c.ops.subscribe(lubanCallback); // the Dispatcher short-circuits: a listener exists already
            return readOn(c, '$G')(subscribedBefore);
        });
        assert.ok(!c.wire().includes('1 1'), 'no unsubscribe: it would cut Luban\'s feed');
        assert.equal(c.state.subscribed, true);
        assert.deepEqual(c.client.listeners('417'), [feed.callback]);
        assert.equal(reply.feed && reply.feed.restored, true);
        assert.ok(reply.feed && reply.feed.notes.some((n) => /Luban subscribed/.test(n)));
    }],
    ['Luban\'s own setup in flight right after connecting: the read waits (bounded) and then uses Luban\'s subscription', async () => {
        const c = controller({ reply: ['ok'] });
        let clock = 1000;
        const feed = lubanFeed({ requestedAt: 1000, pending: true, levelResult: null });
        const reply = await withLogFeed({
            ops: c.ops,
            luban: () => feed,
            stepTimeoutMs: 400,
            now: () => clock,
            sleep: async (ms) => {
                clock += ms;
                if (clock >= 1300 && feed.pending) {
                    await lubanSubscribes(c, feed);
                    feed.pending = false;
                }
            },
        }, readOn(c, '$$'));
        assert.equal(reply.feed && reply.feed.lubanSubscribed, true);
        assert.deepEqual(c.wire(), ['1 10', '1 0', '1 2'], 'Luban\'s level + subscribe, then only the query');
        const stuck = controller();
        let t = 0;
        const never = await withLogFeed({
            ops: stuck.ops,
            luban: () => lubanFeed({ requestedAt: 0, pending: true, levelResult: null }),
            setupWaitMs: 500,
            stepTimeoutMs: 400,
            now: () => t,
            sleep: async (ms) => { t += ms; },
        }, readOn(stuck, '$$'));
        assert.ok(t >= 500 && t < 700, `waited the bound, not forever (${t})`);
        assert.ok(never.feed && never.feed.notes.some((n) => /has not settled/.test(n)));
        assert.equal(never.feed && never.feed.subscribedByRead, true);
    }],
];
