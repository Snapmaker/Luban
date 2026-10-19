// The connected machine's identity and capability, bound to the live
// connection (machineCapability.ts is the pure half). One place reads the
// machine identifier, so every tool - the motion planners, the stores that
// scope their records, the home tool's $H decision - agrees on which machine
// it is driving. Reads are defensive: the inert test harnesses hand in a
// ConnectionManager stub without getConnectionStatus.
import {
    SnapmakerA150Machine,
    SnapmakerA250Machine,
    SnapmakerA350Machine,
    SnapmakerArtisanMachine,
    SnapmakerJ1Machine,
    SnapmakerOriginalExtendedMachine,
    SnapmakerOriginalMachine,
    SnapmakerRayMachine,
} from '../../../app/machines';
import { connectionManager } from '../machine/ConnectionManager';
import { GcodeDialect } from './gcodeDialect';
import {
    CapabilityKey,
    MachineCapability,
    MachineDefinitionLike,
    MachineSummary,
    capabilityRefusal,
    deriveMachineCapability,
    machineTag,
    summariseMachine,
} from './machineCapability';
import { McpToolError } from './registry';
import { MotorPowerReading, motorPowerNote, motorPowerRefusal, readMotorPower } from './motorPower';
import { HeadReadings, McpLaserRecord, ToolheadAssessment, assessToolhead, getMcpLaserRecord, toolheadNote, toolheadOnRefusal } from './toolheadState';

export const MACHINES = [
    SnapmakerOriginalMachine,
    SnapmakerOriginalExtendedMachine,
    SnapmakerA150Machine,
    SnapmakerA250Machine,
    SnapmakerA350Machine,
    SnapmakerArtisanMachine,
    SnapmakerJ1Machine,
    SnapmakerRayMachine,
];

export function findMachine(identifier: string | null) {
    return identifier ? MACHINES.find((machine) => machine.identifier === identifier) || null : null;
}

/** The machineIdentifier the connection reports, or null (not connected, or a stub without the method). */
export function connectedMachineIdentifier(): string | null {
    const manager = connectionManager as unknown as { getConnectionStatus?: () => { machineIdentifier?: string | null } };
    if (typeof manager.getConnectionStatus !== 'function') {
        return null;
    }
    try {
        const status = manager.getConnectionStatus();
        return status && typeof status.machineIdentifier === 'string' && status.machineIdentifier ? status.machineIdentifier : null;
    } catch (err) {
        return null;
    }
}

/** Capability of the machine `identifier` names (unknown identifiers are "unknown, assumed to have Z"). */
export function machineCapabilityFor(identifier: string | null): MachineCapability {
    return deriveMachineCapability(findMachine(identifier) as MachineDefinitionLike | null, identifier);
}

/** Capability of the CONNECTED machine. */
export function connectedMachineCapability(): MachineCapability {
    return machineCapabilityFor(connectedMachineIdentifier());
}

/** `{identifier, type, hasZ}` for tool results, so an agent cannot miss which machine it is driving. */
export function describeConnectedMachine(): MachineSummary {
    return summariseMachine(connectedMachineCapability());
}

/** The parenthetical refusals carry: "(connected machine: Ray, Laser, no Z axis)". */
export function connectedMachineTag(): string {
    return machineTag(connectedMachineCapability());
}

/** The CONNECTED machine's G-code dialect row (gcodeDialect.ts); 'unknown' when nothing or an unlisted machine is connected. */
export function connectedDialect(): GcodeDialect {
    return connectedMachineCapability().dialect;
}

/**
 * Refuse `action` unless the connected machine supports `what`
 * (MachineCapability.supports). The McpToolError names the machine and the
 * dialect table's source: "Probing needs probing, which this MCP does not
 * support on Snapmaker J1 (connected machine: ...): ...". Returns the
 * capability it checked, so a caller can read the row without a second lookup.
 */
export function requireCapability(what: CapabilityKey, action: string): MachineCapability {
    const capability = connectedMachineCapability();
    const refusal = capabilityRefusal(capability, what, action);
    if (refusal) {
        throw new McpToolError(refusal);
    }
    return capability;
}

/**
 * The connection generation the MCP keys per-connection records on (the
 * failed-call modal ledger, the laser record); null when disconnected.
 * 'unversioned' for a channel without generations.
 */
export function connectedConnectionId(): string | null {
    try {
        if (!connectionManager.getConnectionStatus().connected) {
            return null;
        }
        const generation = (connectionManager as { getConnectionGeneration?: () => string }).getConnectionGeneration;
        return typeof generation === 'function' ? generation.call(connectionManager) : 'unversioned';
    } catch (err) {
        return null;
    }
}

/**
 * The toolhead as the CONNECTED machine reports it (toolheadState.ts): 'on',
 * 'off', or 'unknown' on a machine whose firmware never reports it (the Ray).
 * Every toolhead-on guard reads this one function. With no machine identifier
 * (the test harness) or an unlisted one, the row reports, as before.
 */
export function connectedToolhead(): ToolheadAssessment {
    const manager = connectionManager as unknown as { getLatestMachineState?: () => unknown };
    const state = typeof manager.getLatestMachineState === 'function' ? manager.getLatestMachineState() as HeadReadings | null : null;
    return assessToolhead(connectedDialect(), state);
}

/**
 * Throw `message` (each guard keeps its own wording) as an McpToolError when
 * the toolhead reads on; otherwise return the assessment, so a result can say
 * the state was unknown rather than off.
 */
export function assertToolheadNotOn(message: string): ToolheadAssessment {
    const assessment = connectedToolhead();
    const refusal = toolheadOnRefusal(assessment, message);
    if (refusal) {
        throw new McpToolError(refusal);
    }
    return assessment;
}

/** The MCP's own laser-word record for the current connection (advisory, MCP-sent only). */
export function connectedLaserRecord(): McpLaserRecord {
    return getMcpLaserRecord(connectedConnectionId());
}

/**
 * The `toolhead` block results, get_position and get_machine_profile carry on
 * a machine whose toolhead state is unknown (the Ray); null elsewhere, so the
 * A350's and the Original's results are unchanged. `laserOffSent` names the
 * laser-off line this call sent.
 */
export function connectedToolheadNote(assessment: ToolheadAssessment = connectedToolhead(), laserOffSent: string | null = null) {
    return toolheadNote(assessment, connectedLaserRecord(), laserOffSent);
}

/**
 * The CONNECTED machine's motor-power mode, read fresh (motorPower.ts,
 * tyeth/Luban#321): on a machine whose dialect row keeps one (the Ray), a
 * bounded SACP 0x01 0x48 GETCURRENTMODE read through the channel's read-only
 * getMotorPowerMode; null elsewhere, with nothing sent (the A350, the
 * Original). A Ray channel without the read (plain-text USB) reads 'unknown'.
 * Never throws.
 */
export async function connectedMotorPower(): Promise<MotorPowerReading | null> {
    if (connectedDialect().motorPower.read !== 'sacp-0x48') {
        return null;
    }
    const manager = connectionManager as unknown as { getCurrentChannel?: () => unknown };
    let channel: { getMotorPowerMode?: () => Promise<number> } | null = null;
    try {
        channel = typeof manager.getCurrentChannel === 'function'
            ? manager.getCurrentChannel() as { getMotorPowerMode?: () => Promise<number> } | null : null;
    } catch (err) {
        channel = null;
    }
    const read = channel && typeof channel.getMotorPowerMode === 'function' ? channel.getMotorPowerMode.bind(channel) : null;
    return readMotorPower(read);
}

/**
 * Read the motor-power mode and throw `action`'s refusal as an McpToolError
 * unless it is STAYPOWER (Control Mode); `after` says what the refusal left
 * untouched. Returns the reading for the result, or null where the machine
 * has no such mode (nothing read, nothing gated).
 */
export async function assertMotorPowered(action: string, after: string): Promise<MotorPowerReading | null> {
    const reading = await connectedMotorPower();
    if (!reading) {
        return null;
    }
    const refusal = motorPowerRefusal(reading, action, connectedMachineTag(), after);
    if (refusal) {
        throw new McpToolError(refusal);
    }
    return reading;
}

/** The `motor_power` block for results, get_position and get_machine_profile; null where the machine has no such mode. */
export function connectedMotorPowerNote(reading: MotorPowerReading | null) {
    return reading ? motorPowerNote(reading, connectedDialect().motorPower.basis) : null;
}
