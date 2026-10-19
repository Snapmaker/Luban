import assert from 'assert';
import { Dispatcher } from '@snapmaker/snapmaker-sacp-sdk';
import Header, { Attribute, PeerId } from '@snapmaker/snapmaker-sacp-sdk/dist/communication/Header';
import Packet from '@snapmaker/snapmaker-sacp-sdk/dist/communication/Packet';
import Response from '@snapmaker/snapmaker-sacp-sdk/dist/communication/Response';
import { stringToBuffer } from '@snapmaker/snapmaker-sacp-sdk/dist/helper';
import {
    ReplyEmitter, endsReply, parseGcodeAckData, parseLogFeedbackData, readGcodeReply, sacpBusinessId, SACP_LOG_FEEDBACK,
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
];
