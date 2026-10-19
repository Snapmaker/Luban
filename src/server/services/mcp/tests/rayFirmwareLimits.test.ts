import assert from 'assert';
import { SACP_GRBL_MAX_PAYLOAD_BYTES, sacpGrblPayloadRefusal, withoutCommentLines } from '../sacpLineGuard';
import { isFillPatternProductSn, isFillPatternSerial, parseSacpMachineInfo } from '../../machine/channels/sacpMachineState';
import { dialectById } from '../gcodeDialect';
import { relativeStep } from '../gcodeForms';
import { machineStoreFixture } from './machineStore.test';

// What SACP can and cannot carry to and from the Ray V1.7.4 (tyeth/Luban#312,
// Snapmaker/RayController 91a675f): the line guard on every MCP payload sent
// to a GRBL machine over SACP, the 0x01 0x21 machine-info parse (version and
// efuse product SN), the product-SN fill rule, and the per-machine store
// gaining the efuse SN as an alias of the Ray's existing entry.

const RAY = dialectById('ray-grbl');
const EFUSE_SN = 'RAY20AB1234567890123';

/** A SACP String: UInt16 LE length + bytes. */
function sacpString(text: string): Buffer {
    const body = Buffer.from(text, 'latin1');
    const length = Buffer.alloc(2);
    length.writeUInt16LE(body.length, 0);
    return Buffer.concat([length, body]);
}

/** 0x01 0x21's data as the Ray sends it (snapmaker.cpp:159-191): model, hw, the 0x66666666 dummy, version, product SN. */
function rayMachineInfo(sn: string | null, version = 'V1.7.4'): Buffer {
    const head = Buffer.alloc(6);
    head.writeUInt8(5, 0);
    head.writeUInt8(1, 1);
    head.writeUInt32LE(0x66666666, 2);
    return Buffer.concat([head, sacpString(version), ...(sn === null ? [] : [sacpString(sn)])]);
}

/** A string of exactly `bytes` bytes that is a harmless G-code (a G90 padded by a trailing comment). */
function payloadOf(bytes: number): string {
    return `G90 ;${'x'.repeat(bytes - 5)}`;
}

export const tests: Array<[string, () => void | Promise<void>]> = [
    // ---- The SACP line guard ------------------------------------------------------------
    ['length: 78 bytes is sent; 79 and 80 are refused (the firmware drops what reaches 80 with its newline, after ACK 0)', () => {
        assert.equal(SACP_GRBL_MAX_PAYLOAD_BYTES, 78);
        assert.equal(payloadOf(78).length, 78);
        assert.equal(sacpGrblPayloadRefusal(payloadOf(78)), null);
        assert.match(String(sacpGrblPayloadRefusal(payloadOf(79))), /79 bytes.*silently drops/);
        assert.match(String(sacpGrblPayloadRefusal(payloadOf(80))), /80 bytes/);
        // A multi-line payload is ONE SACP string on UDP: the whole of it counts.
        const lines = ['G91', 'G1 X10.000 Y10.000 F3000', 'G90', 'M2000 L13 P1', 'G91', 'G1 X-10.000 Y-10.000 F3000', 'G90'].join('\n');
        assert.ok(lines.length > 78);
        assert.match(String(sacpGrblPayloadRefusal(lines)), /bytes in one SACP G-code string/);
    }],
    ['$PS (any prefix, any case), realtime characters and non-ASCII bytes are refused; a line that is exactly "?" is not', () => {
        for (const bad of ['$PS', '$ps', ' $PS1', '$PSanything', 'G90\n$Ps']) {
            assert.match(String(sacpGrblPayloadRefusal(bad)), /\$PS/, JSON.stringify(bad));
        }
        for (const bad of ['G1 X1 ?', 'G90 ; ok?', '!', '~', 'M5\n?\nM5 !']) {
            assert.match(String(sacpGrblPayloadRefusal(bad)), /realtime/, JSON.stringify(bad));
        }
        for (const bad of ['G90\u0018', 'G1 X1é', 'G90\r', 'G90\tG91', 'M3 S\u0080']) {
            assert.match(String(sacpGrblPayloadRefusal(bad)), /not printable ASCII/, JSON.stringify(bad));
        }
        assert.equal(sacpGrblPayloadRefusal('?'), null);
        assert.equal(sacpGrblPayloadRefusal(' ? '), null);
        assert.match(String(sacpGrblPayloadRefusal('')), /nothing left to send/);
        assert.match(String(sacpGrblPayloadRefusal(withoutCommentLines('; only a comment'))), /nothing left to send/);
    }],
    ['whole-line comments are dropped before the guard; the Ray\'s longest planner payloads still fit', () => {
        // A relative step at the far corners of any Ray bed at a high feed, with its settle comment.
        const step = relativeStep(RAY, { from: { x: 0, y: 0 }, to: { x: -999.999, y: -999.999 } }, 99999, { command: 'G1', hasZ: false });
        assert.match(step, /^; mcp-settle machine/m, 'the staged text carries the settle comment');
        const sent = withoutCommentLines(step);
        assert.ok(!/;/.test(sent), 'nothing of the comment goes on the wire');
        assert.equal(sacpGrblPayloadRefusal(sent), null, `${Buffer.byteLength(sent)} bytes: ${JSON.stringify(sent)}`);
        // laser_frame's powered side on the Ray: power line, the step, M5 (laserPlan.ts push()).
        const powered = withoutCommentLines(['M5', 'M3 S1000', step, 'M5'].join('\n'));
        assert.equal(sacpGrblPayloadRefusal(powered), null, `${Buffer.byteLength(powered)} bytes`);
        for (const line of ['$H', 'G90', 'M8', 'M9', 'M2000 L13 P1', 'M2000 L13 P0', 'M5']) {
            assert.equal(sacpGrblPayloadRefusal(line), null, line);
        }
    }],

    // ---- SACP 0x01 0x21 machine info -------------------------------------------------------
    ['0x01 0x21: a real efuse SN after the version; the u32 serial is the 0x66666666 dummy', () => {
        const info = parseSacpMachineInfo(rayMachineInfo(EFUSE_SN));
        assert.ok(info);
        assert.equal(info.model, 5);
        assert.equal(info.hardwareVersion, 1);
        assert.equal(info.serialU32, 0x66666666);
        assert.ok(isFillPatternSerial(info.serialU32));
        assert.equal(info.firmwareVersion, 'V1.7.4');
        assert.equal(info.productSn, EFUSE_SN);
        assert.equal(info.productSnRaw, EFUSE_SN);
        assert.equal(info.truncated, null);
    }],
    ['0x01 0x21: an unprogrammed efuse (20 x "6") is no SN; a controller that sends none (the A350) has none', () => {
        const blank = parseSacpMachineInfo(rayMachineInfo('6'.repeat(20)));
        assert.ok(blank);
        assert.equal(blank.firmwareVersion, 'V1.7.4');
        assert.equal(blank.productSn, null);
        assert.equal(blank.productSnRaw, '6'.repeat(20));
        const none = parseSacpMachineInfo(rayMachineInfo(null, 'v4.6.2'));
        assert.ok(none);
        assert.equal(none.firmwareVersion, 'v4.6.2');
        assert.equal(none.productSn, null);
        assert.equal(none.productSnRaw, null);
        assert.equal(none.truncated, null, 'ending after the version is not truncation');
    }],
    ['0x01 0x21: short and truncated buffers never invent a field', () => {
        assert.equal(parseSacpMachineInfo(Buffer.from([4, 1, 0x66])), null, 'under the 6 fixed bytes');
        assert.equal(parseSacpMachineInfo(null), null);
        const full = rayMachineInfo(EFUSE_SN);
        const cutVersion = parseSacpMachineInfo(full.slice(0, 10));
        assert.ok(cutVersion);
        assert.equal(cutVersion.firmwareVersion, null);
        assert.match(String(cutVersion.truncated), /firmware version: 6 byte\(s\) announced, 2 present/);
        const cutSn = parseSacpMachineInfo(full.slice(0, full.length - 5));
        assert.ok(cutSn);
        assert.equal(cutSn.firmwareVersion, 'V1.7.4');
        assert.equal(cutSn.productSn, null);
        assert.match(String(cutSn.truncated), /product SN: 20 byte\(s\) announced, 15 present/);
        const cutLength = parseSacpMachineInfo(full.slice(0, 6 + 2 + 6 + 1));
        assert.ok(cutLength);
        assert.match(String(cutLength.truncated), /product SN: length field cut short/);
    }],
    ['fill patterns: the UInt32 rule is unchanged (A350 serials), and product SNs add one-character, empty and non-printable', () => {
        for (const fill of [0, 0xffffffff, 0x66666666, '1717986918', '0']) {
            assert.equal(isFillPatternSerial(fill), true, String(fill));
        }
        for (const real of [20481234, '20481234', 123, '123', 7, '1111']) {
            assert.equal(isFillPatternSerial(real), false, String(real));
        }
        for (const fill of ['6'.repeat(20), 'A'.repeat(20), '', '   ', '\0\0\0', 'RAY\u0001X']) {
            assert.equal(isFillPatternProductSn(fill), true, JSON.stringify(fill));
            assert.equal(isFillPatternSerial(fill), true, `as a device serial: ${JSON.stringify(fill)}`);
        }
        assert.equal(isFillPatternProductSn(EFUSE_SN), false);
        assert.equal(isFillPatternSerial(EFUSE_SN), false);
    }],

    // ---- The per-machine store: the efuse SN joins the Ray's entry --------------------------
    ['the Ray\'s entry gains the efuse SN as an alias: same key, no conflict, travel kept - from no id, a fill-pattern id or a host', () => {
        for (const legacy of [[], ['sn:1717986918'], ['host:192.168.1.50']]) {
            const f = machineStoreFixture({});
            f.connect({ machineIdentifier: 'Ray' });
            f.store.currentMachine();
            f.store.setFor('Ray', 'mcpTravelXMin', 3);
            const data = f.values.get('mcpMachines') as { machines: { [key: string]: { devices?: Array<{ id: string }> } } };
            data.machines.Ray.devices = legacy.map((id) => ({ id, firstSeen: 1, lastSeen: 1 }));
            f.config.set('mcpMachines', data);
            f.connect({ machineIdentifier: 'Ray', deviceSerial: '6'.repeat(20) });
            assert.equal(f.store.currentMachine().deviceId, null, `${legacy}: 20 x "6" is no device id`);
            f.connect({ machineIdentifier: 'Ray', deviceSerial: EFUSE_SN });
            const current = f.store.currentMachine();
            assert.equal(current.machineKey, 'Ray', String(legacy));
            assert.equal(current.deviceId, `sn:${EFUSE_SN}`);
            assert.equal(current.deviceConflict, null, `${legacy}: a first real serial is no conflict`);
            assert.equal(f.store.getFor('Ray', 'mcpTravelXMin'), 3, 'the stated travel carries over');
            const ids = f.store.load().machines.Ray.devices.map((d: { id: string }) => d.id);
            assert.deepEqual(ids, [...legacy, `sn:${EFUSE_SN}`]);
        }
    }],
];
