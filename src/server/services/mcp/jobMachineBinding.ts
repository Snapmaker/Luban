// A staged job belongs to the machine it was staged for (#265 WP3, lead
// addition found by WP4b).
//
// Staging validates a program against the CONNECTED machine: its dialect
// rules, its travel, its frame, its Z. Luban can switch machines between the
// operator's approval and start_gcode_job, and before this a job staged and
// approved on the A350 would have started on the Ray. The job now records the
// machine it was staged for (identifier, dialect, and the device serial when
// the connection reports one), and approval and start both refuse when the
// connected machine is a different one - before anything is sent.
//
// A device serial is compared only when BOTH sides have one (SACP reports it;
// SSTP and USB text serial do not), and a host is never compared: one machine
// over Wi-Fi and USB is the same machine.
//
// Pure: no server imports, unit-tested in tests/jobMachineBinding.test.ts.

export interface StagedMachine {
    /** Luban machineIdentifier ('Ray', 'Snapmaker 2.0 A350'). */
    identifier: string;
    /** gcodeDialect.ts DialectId. */
    dialect: string;
    /** The connection's device serial, or null when it reports none. */
    deviceSerial: string | null;
}

export type BindingAction = 'approve' | 'start';

function describe(machine: StagedMachine): string {
    return `${machine.identifier} (${machine.dialect}${machine.deviceSerial ? `, serial ${machine.deviceSerial}` : ''})`;
}

/**
 * Why `action` must be refused for a job staged for `staged` while `connected`
 * is connected, or null when it may proceed.
 *
 * - `staged` undefined: a job recorded before the binding existed - not judged.
 * - `staged` null: staged with no machine connected, so it was judged by the
 *   legacy A350 rules only; refused once any machine is connected.
 * - `connected` null: nothing to compare with - start's own connection checks
 *   refuse a job with no machine; approval may go ahead.
 */
export function machineBindingRefusal(staged: StagedMachine | null | undefined, connected: StagedMachine | null, action: BindingAction): string | null {
    if (staged === undefined || connected === null) {
        return null;
    }
    const verb = action === 'approve' ? 'Approval refused' : 'Start refused';
    const after = action === 'approve' ? 'Nothing was approved and nothing was sent.' : 'Nothing was sent.';
    const restage = 'Withdraw it (stop_gcode_job) and stage it again while the machine it is for is connected.';
    if (staged === null) {
        return `${verb}: this job was staged with no machine connected, so it was validated against no machine's rules, travel or `
            + `frame; the connected machine is now ${describe(connected)}. ${after} ${restage}`;
    }
    if (staged.identifier !== connected.identifier) {
        return `${verb}: this job was staged for ${describe(staged)}, but the connected machine is now ${describe(connected)}. `
            + `It was validated against the ${staged.identifier}'s rules, travel and frame, which do not hold on the `
            + `${connected.identifier}. ${after} ${restage}`;
    }
    if (staged.deviceSerial && connected.deviceSerial && staged.deviceSerial !== connected.deviceSerial) {
        return `${verb}: this job was staged for the ${staged.identifier} with serial ${staged.deviceSerial}, but the connected `
            + `${connected.identifier} reports serial ${connected.deviceSerial} - a different machine of the same model, whose `
            + `landmarks, travel and origin are its own. ${after} ${restage}`;
    }
    return null;
}
