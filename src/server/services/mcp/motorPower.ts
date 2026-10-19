/* eslint-disable camelcase */
// Result keys are snake_case: they are serialised straight into tool results.
//
// The Ray's motor-power mode, read before the MCP homes it or starts a job on
// it (tyeth/Luban#321; multi-machine overhaul #265; the Ray data map #315).
//
// Luban's Set Origin Mode on the Ray is a firmware motor-power mode, SACP
// 0x01 0x48 (SacpClient.setMotorPowerHoldMode; Luban's enum MotorPowerMode
// {GETCURRENTMODE, SHUTAll, ONLYLINEAR, STAYPOWER}): Manual Mode sets SHUTAll,
// Control Mode sets STAYPOWER. Live on 2026-10-19 (V1.7.4 over Wi-Fi) the Ray
// in Manual Mode ACKed $H with result 0 and never moved; the MCP's home timed
// out after 120 s and Luban's own Go Home did nothing either. In Control Mode
// the same $H homed it in about 4 s. The refusal rests on that observation:
// the firmware source shows when the steppers are released, not the line that
// drops the $H.
//
// RayController 91a675f, snapmaker/src/service/motion_platform.cpp:
// - hmi_cb_set_motor_mode (:491-506, registered :763-764) ACKs two bytes,
//   [err, mode]. The SDK splits them into response.result and response.data,
//   so setMotorPowerHoldMode returns the mode byte. The mode byte is written
//   even when err is E_PARAM or E_INVALID_STATE.
// - set_motor_power_mode (:441-488): request 0 (GETCURRENTMODE) changes
//   nothing unless the stored mode is INVALID (0), which it never is after
//   init: snapmaker.cpp:706 sets DISABLE_ALL (1) at every boot, :1664 on a
//   settings reset, and Protocol.cpp:292 on every alarm. So every reboot and
//   every alarm puts the Ray in Manual Mode.
// - Modes 1 (SHUTAll) and 2 (ONLYLINEAR) run the same code (:461-472). The
//   steppers (Stepper.cpp:474) and the job-end path (file_manager.cpp:1468)
//   treat only 3 (KEEL_ALL_ENABLE = STAYPOWER) differently; nothing at this
//   commit releases only the linear motors. ONLYLINEAR therefore refuses like
//   SHUTAll: only STAYPOWER is known to move.
//
// Home and job starts only READ the mode. Switching it is the operator's call:
// Manual Mode is the Ray's hand-push mode, and powering the steppers under
// someone's hands must never happen silently. The one way the MCP switches it
// is set_motor_power (tools/motorPower.ts, tyeth/Luban#326): staged for the
// operator's click on a confirm page, or on the call only under the
// operator-only setting "Allow motor-mode changes without an approval page"
// with the agent quoting the operator's instruction. Control sets STAYPOWER
// and then homes (M5, $H), as Luban's Control Mode radio does; Manual sets
// SHUTAll after M5 and latches the position untrusted (below) until a home.
//
// Pure: no server imports, unit-tested in tests/motorPower.test.ts.

/** Luban's MotorPowerMode.GETCURRENTMODE: the read-only 0x48 request. */
export const MOTOR_POWER_GET_CURRENT = 0;

export type MotorPowerModeName = 'SHUTAll' | 'ONLYLINEAR' | 'STAYPOWER';

/** The firmware's mode bytes (snapmaker.h:51-54) under Luban's names. 0 (INVALID) and anything else are unknown. */
export const MOTOR_POWER_MODES: Readonly<Record<number, MotorPowerModeName>> = { 1: 'SHUTAll', 2: 'ONLYLINEAR', 3: 'STAYPOWER' };

/** The only mode the MCP homes or starts jobs in. */
export const MOTOR_POWER_MOTION_MODE: MotorPowerModeName = 'STAYPOWER';

/**
 * How long the read may take. The handler is unblocked (no motion attribute,
 * :763-764) and answers at once; Luban's heartbeat is 1 s and a beat missing
 * for 10 s is a lost connection, so 3 s is ample for one round trip and short
 * enough that a lost reply cannot hold up a tool.
 */
export const MOTOR_POWER_READ_TIMEOUT_MS = 3000;

export const MOTOR_POWER_SOURCE = 'SACP 0x01 0x48 GETCURRENTMODE, read fresh by this call';

export interface MotorPowerReading {
    /** The mode the firmware reported, or 'unknown' (no reply in time, an error, or a byte outside 1-3). */
    mode: MotorPowerModeName | 'unknown';
    /** The mode byte as received, or null. */
    raw: number | null;
    source: string;
    /** When the reply arrived (ms since the epoch), or null when none did. */
    read_at: number | null;
    /** Why the mode is unknown; null when it was read. */
    error: string | null;
}

export function decodeMotorPowerMode(raw: unknown): MotorPowerModeName | null {
    return typeof raw === 'number' && Object.prototype.hasOwnProperty.call(MOTOR_POWER_MODES, raw) ? MOTOR_POWER_MODES[raw] : null;
}

/**
 * Read the mode through `read` (the channel's GETCURRENTMODE request), bounded
 * by `timeoutMs`. Never throws: a missing reader, a rejection, a timeout or an
 * unknown byte all come back as mode 'unknown' with the reason.
 */
export async function readMotorPower(
    read: (() => Promise<unknown>) | null,
    now: () => number = Date.now,
    timeoutMs: number = MOTOR_POWER_READ_TIMEOUT_MS,
): Promise<MotorPowerReading> {
    const unknown = (error: string, raw: number | null = null): MotorPowerReading => ({
        mode: 'unknown', raw, source: MOTOR_POWER_SOURCE, read_at: null, error,
    });
    if (!read) {
        return unknown('the connected channel cannot send SACP 0x01 0x48 (the Ray reports its motor-power mode only over SACP)');
    }
    let timer: ReturnType<typeof setTimeout> | null = null;
    const timeout = new Promise<{ timedOut: true }>((resolve) => {
        timer = setTimeout(() => resolve({ timedOut: true }), timeoutMs);
    });
    try {
        const outcome = await Promise.race([
            Promise.resolve().then(read).then((value) => ({ value }), (err: unknown) => ({ failed: err })),
            timeout,
        ]);
        if ('timedOut' in outcome) {
            return unknown(`no reply to SACP 0x01 0x48 within ${timeoutMs} ms`);
        }
        if ('failed' in outcome) {
            const message = outcome.failed instanceof Error ? outcome.failed.message : String(outcome.failed);
            return unknown(`the SACP 0x01 0x48 read failed: ${message}`);
        }
        const raw = typeof outcome.value === 'number' && Number.isFinite(outcome.value) ? outcome.value : null;
        const mode = decodeMotorPowerMode(raw);
        if (!mode) {
            return unknown(`SACP 0x01 0x48 returned mode ${raw === null ? JSON.stringify(outcome.value) : raw}, which is not 1-3 `
                + '(SHUTAll, ONLYLINEAR, STAYPOWER)', raw);
        }
        return { mode, raw, source: MOTOR_POWER_SOURCE, read_at: now(), error: null };
    } finally {
        if (timer) {
            clearTimeout(timer);
        }
    }
}

const TO_CONTROL_MODE = 'Switch with set_motor_power {mode:\'control\'} (it stages a confirm page and then homes the Ray), or switch '
    + 'Luban\'s Set Origin Mode to Control Mode, then retry.';

/**
 * The refusal for `action` unless the mode reads STAYPOWER, else null. `tag`
 * names the connected machine; `after` says what this refusal left untouched
 * (nothing sent, the approval still valid).
 */
export function motorPowerRefusal(reading: MotorPowerReading, action: string, tag: string, after: string): string | null {
    if (reading.mode === MOTOR_POWER_MOTION_MODE) {
        return null;
    }
    let why: string;
    if (reading.mode === 'SHUTAll') {
        why = `the Ray's motors are off (Manual Mode / SHUTAll): it acknowledges commands and ignores them. ${TO_CONTROL_MODE}`;
    } else if (reading.mode === 'ONLYLINEAR') {
        why = 'the Ray\'s motor-power mode is ONLYLINEAR, which its firmware (V1.7.4) treats exactly as SHUTAll: the motors are '
            + `released, so it would acknowledge commands and ignore them. ${TO_CONTROL_MODE}`;
    } else {
        why = `motor power unknown (${reading.error}). In Manual Mode the Ray acknowledges commands and ignores them, so the MCP reads `
            + `its motor-power mode first and refuses rather than guess. Check the connection; if Luban shows Manual Mode, ${TO_CONTROL_MODE}`;
    }
    return `Refusing ${action}: ${why} Nothing here changes the motor-power mode silently. ${after} ${tag}`;
}

/** The `motor_power` block results, get_position and get_machine_profile carry where the machine has the mode (the Ray). */
export function motorPowerNote(reading: MotorPowerReading, basis: string): MotorPowerReading & { motion_allowed: boolean; basis: string } {
    return { ...reading, motion_allowed: reading.mode === MOTOR_POWER_MOTION_MODE, basis };
}

/** The firmware's mode bytes set_motor_power sends (snapmaker.h:51-54): SHUTAll 1, STAYPOWER 3. */
export const MOTOR_POWER_SET_BYTES: Readonly<Record<'SHUTAll' | 'STAYPOWER', number>> = { SHUTAll: 1, STAYPOWER: 3 };

// ---- The position after the motors were released (#326) -------------------
//
// With the motors released (SHUTAll) the head can be pushed by hand, and the
// firmware keeps reporting the old coordinates and "homed". After
// set_motor_power {mode:'manual'} the MCP latches the position untrusted for
// that machine: getPositionSnapshot reports isHomed false with the reason, so
// staging, the start re-check (#323) and the policy paths all refuse until a
// home is sent in Control Mode (homeMachine clears the latch once the home is
// accepted). Keyed by machine identifier so another machine's position is
// never touched. In memory only: a restart of Luban loses it, but a Ray left
// in SHUTAll is refused by the motor-power gate (#321) anyway, and switching
// it to Control Mode homes it.

export interface MotorsReleasedLatch {
    machineIdentifier: string | null;
    at: number;
    /** What released them: the approved job, or the setting with the operator's instruction. */
    by: string;
}

let motorsReleased: MotorsReleasedLatch | null = null;

export function noteMotorsReleased(latch: MotorsReleasedLatch): void {
    motorsReleased = { ...latch };
}

/** The latch for `machineIdentifier`, or null. */
export function motorsReleasedFor(machineIdentifier: string | null): MotorsReleasedLatch | null {
    return motorsReleased && motorsReleased.machineIdentifier === machineIdentifier ? motorsReleased : null;
}

/** Clear the latch for `machineIdentifier` (a home was accepted); with no argument, whatever machine (tests). */
export function clearMotorsReleased(machineIdentifier?: string | null): void {
    if (machineIdentifier === undefined || (motorsReleased && motorsReleased.machineIdentifier === machineIdentifier)) {
        motorsReleased = null;
    }
}

export function motorsReleasedReason(latch: MotorsReleasedLatch): string {
    return `The motors were released (Manual Mode / SHUTAll) by ${latch.by} at ${new Date(latch.at).toISOString()}: the head may `
        + 'have been pushed by hand, so the position is untrusted and reads unhomed until a home in Control Mode '
        + '(set_motor_power {mode:\'control\'} homes).';
}
