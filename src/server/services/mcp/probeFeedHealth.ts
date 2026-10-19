// What a probe feed's silence MEANS, in words an operator or an agent can act
// on.
//
// Live 2026-09-19: the KB2040 U2IF bridge enumerated on USB, `import board`
// resolved its board id, and the first `digitalio.DigitalInOut(...)` never
// returned - the bridge was wedged. The transport reported "GPIO monitor
// produced no ready line within 30000 ms" and retried quietly for eighteen
// minutes. That sentence is equally true of a missing interpreter, an
// uninstalled Blinka and a hung bridge, and only one of those is fixed by
// replugging a board. Nothing else said anything at all: the machine was not
// connected, so the Workspace pills were not on screen, and the status was a
// `connected: false` among forty other fields.
//
// Probing itself was never unsafe - assertChannelReady refuses without a live
// feed - but "you find out when you try to probe" is not good enough for a
// sensor whose whole job is to be watching.
//
// Pure: no server imports, unit-tested in tests/probeFeedHealth.test.ts.

/**
 * How far the monitor got before it stopped answering. The stages are emitted
 * by MONITOR_SOURCE, so a timeout can say what is actually wrong instead of
 * "no ready line".
 */
export interface MonitorProgress {
    /** null = nothing at all arrived: the interpreter or the Blinka import never returned. */
    stage: 'imported' | 'pin' | null;
    board: string | null;
    /** Channels whose pin was configured before it stopped. */
    pinsDone: string[];
    /** The channel it was configuring when it stopped, if it got that far. */
    stuckOn: string | null;
}

export const EMPTY_PROGRESS: MonitorProgress = { stage: null, board: null, pinsDone: [], stuckOn: null };

/**
 * What a ready timeout MEANS.
 *
 * Live 2026-09-19: the KB2040 U2IF bridge enumerated on USB, `import board`
 * resolved its board id, and the first `digitalio.DigitalInOut(...)` never
 * returned - the bridge was wedged. The transport reported "GPIO monitor
 * produced no ready line within 30000 ms" and retried silently for 18 minutes.
 * That message is true of a missing interpreter, an uninstalled Blinka and a
 * hung bridge alike, and only one of those is fixed by replugging a board.
 */
export function describeReadyTimeout(progress: MonitorProgress, timeoutMs: number, python: string, blinkaEnv: string): string {
    const waited = `${Math.round(timeoutMs / 1000)} s`;
    if (progress.stage === null) {
        return `The GPIO monitor produced nothing in ${waited}: "${python}" started but neither reported a Blinka `
            + 'import failure nor loaded a board. Check that the interpreter is the venv with adafruit-blinka '
            + `installed, and that the Blinka environment ("${blinkaEnv}") names the bridge you have fitted.`;
    }
    const board = progress.board || 'an unknown board';
    if (progress.stage === 'imported' && !progress.pinsDone.length) {
        return `Blinka loaded and the bridge answered as ${board}, but configuring the first pin`
            + `${progress.stuckOn ? ` (${progress.stuckOn})` : ''} never returned in ${waited}. That is a LEAKED `
            + 'CLAIM: a previous monitor died holding the libusb claim without reattaching the kernel driver, so '
            + 'the board still enumerates and still reports its id while the first pin blocks for ever. `lsusb -t` '
            + 'shows its HID interface as Driver=[none] instead of Driver=usbhid. The transport resets the bridge '
            + 'on the USB bus and retries by itself; only if that keeps failing is replugging the board the answer.';
    }
    return `Blinka loaded on ${board} and configured ${progress.pinsDone.join(', ')}, then stopped while setting up `
        + `${progress.stuckOn || 'the next pin'} - it did not finish within ${waited}. That pin is most likely `
        + 'mis-named for this board, or the bridge stopped answering part way through. Check the pin names in '
        + 'Settings -> MCP Server, then replug the board.';
}

export interface FeedHealthInput {
    configured: boolean;
    connected: boolean;
    connecting: boolean;
    /** Sensors the operator has switched off; an all-off feed is not a fault. */
    disabledSensors: string[];
    /** How long it has been failing, ms; null when it has never connected on this run. */
    downForMs: number | null;
    reconnectAttempts: number;
    lastError: string | null;
}

export interface FeedHealth {
    /** Fault | fine. Procedures refuse either way when it is not connected. */
    ok: boolean;
    /** Down long enough that nobody is about to see it come back on its own. */
    degraded: boolean;
    /** One sentence, meant to be read - this is the part that was missing. */
    note: string;
}

/** Past this, a feed that keeps retrying is not "reconnecting", it is broken. */
export const DEGRADED_AFTER_MS = 2 * 60 * 1000;

function humanDuration(ms: number): string {
    const minutes = Math.floor(ms / 60000);
    if (minutes < 1) {
        return `${Math.round(ms / 1000)} s`;
    }
    return minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
}

/**
 * The probe feed's health as a sentence.
 *
 * Carried by get_probe_feed_status AND get_stored_state - the call every
 * session is told to make first - because a dead sensor bridge should not be
 * something you discover by trying to probe.
 */
export function describeFeedHealth(input: FeedHealthInput): FeedHealth {
    if (!input.configured) {
        return {
            ok: true,
            degraded: false,
            note: 'No probe feed is configured on this machine; probing procedures that need a sensor will refuse '
                + 'until one is (Settings -> MCP Server -> Probe sensor feed).',
        };
    }
    if (input.connected) {
        const off = input.disabledSensors.length
            ? ` Disabled by the operator: ${input.disabledSensors.join(', ')}.`
            : '';
        return { ok: true, degraded: false, note: `Probe feed connected.${off}` };
    }
    if (input.connecting) {
        return { ok: true, degraded: false, note: 'Probe feed is connecting.' };
    }
    const down = input.downForMs === null ? null : humanDuration(input.downForMs);
    const degraded = input.downForMs !== null && input.downForMs >= DEGRADED_AFTER_MS;
    const forHowLong = down ? ` for ${down}` : '';
    const attempts = input.reconnectAttempts > 1 ? ` after ${input.reconnectAttempts} attempts` : '';
    return {
        ok: false,
        degraded,
        note: `PROBE FEED DOWN${forHowLong}${attempts}: ${input.lastError || 'reason unknown'} `
            + 'Every probing procedure, tool-setter run and probe_program will refuse until it is back - the '
            + 'overtravel tripwire cannot be armed without it. It keeps retrying in the background, so nothing '
            + 'needs restarting once the cause is fixed.',
    };
}
