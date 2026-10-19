// What may be sent to a GRBL machine (the Ray) as ONE SACP 0x01 0x02 string
// (tyeth/Luban#312). The Ray V1.7.4 ACKs result 0 before it looks at the
// line, then silently drops what it cannot take, so the MCP refuses such a
// payload up front with the reason instead of reporting "ok" for nothing.
// Source: Snapmaker/RayController 91a675f.
//
// - Length: the handler appends '\n' and run_gcode drops the line when that
//   length passes MOTION_REQ_GCODE_SIZE (80) - snapmaker.cpp:272-291,
//   motion_platform.cpp:1280-1283 - after a success ACK (95+ gets E_PARAM).
//   The limit is per SACP string, and SacpUdpChannel sends a multi-line
//   payload as ONE string, so it is checked on the whole payload (and on each
//   line, for the serial channel that sends line by line). The firmware's
//   test is `strlen > 80`, so it takes 79 bytes + '\n'; this keeps one byte
//   of margin: payload + '\n' must stay below 80.
// - Realtime bytes `?`, `!`, `~`, 0x18 and anything >= 0x80 act wherever they
//   appear, even inside a SACP string (Serial.cpp:189-190, 263-269): 0x18
//   resets GRBL. Only a line that is exactly `?` may carry one.
// - `$PS` (any prefix, any case) flips the USB port to SACP (research s3/s5).
//
// Pure module; tests in tests/sacpLineGuard.test.ts.

/** The largest payload (bytes) sent as one SACP G-code string to a GRBL machine: + the firmware's '\n' stays below 80. */
export const SACP_GRBL_MAX_PAYLOAD_BYTES = 78;

/**
 * The payload without whole-line `;` comments and blank lines (GRBL ignores
 * them; on SACP they only cost bytes of the 78) - e.g. a relative step's
 * `; mcp-settle machine` line, which the settle check reads from the staged text.
 */
export function withoutCommentLines(payload: string): string {
    return String(payload).split(/\r?\n/).filter((line) => line.trim() && !line.trim().startsWith(';')).join('\n');
}

/** null when `payload` may be sent to a GRBL machine as one SACP 0x01 0x02 string, else why not. */
export function sacpGrblPayloadRefusal(payload: string): string | null {
    const text = String(payload);
    if (!text.trim()) {
        return 'Refused: nothing left to send (empty, or comment lines only).';
    }
    const bytes = Buffer.byteLength(text, 'utf8');
    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const where = lines.length > 1 ? `line ${i + 1} (${JSON.stringify(line.slice(0, 40))})` : JSON.stringify(text.slice(0, 40));
        const bad = Array.from(line).find((ch) => ch.charCodeAt(0) < 0x20 || ch.charCodeAt(0) > 0x7e);
        if (bad !== undefined) {
            return `Refused ${where}: byte 0x${bad.charCodeAt(0).toString(16).padStart(2, '0')} is not printable ASCII. The GRBL firmware `
                + 'acts on control and >= 0x80 bytes as realtime commands wherever they appear (0x18 resets it).';
        }
        if (/^\s*\$PS/i.test(line)) {
            return `Refused ${where}: a line starting "$PS" switches the machine's USB port to SACP. It is never sent.`;
        }
        if (/[?!~]/.test(line) && line.trim() !== '?') {
            return `Refused ${where}: "?", "!" and "~" are GRBL realtime commands (status, feed hold, resume) that act wherever they `
                + 'appear, comments included; only a line that is exactly "?" may carry one.';
        }
    }
    if (bytes > SACP_GRBL_MAX_PAYLOAD_BYTES) {
        return `Refused: ${bytes} bytes in one SACP G-code string. The GRBL firmware appends a newline and silently drops a string `
            + `that reaches 80 bytes after acknowledging it with result 0; the most sent is ${SACP_GRBL_MAX_PAYLOAD_BYTES}. Shorten it `
            + '(comments, fewer lines per step).';
    }
    return null;
}
