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
import {
    MachineCapability,
    MachineDefinitionLike,
    MachineSummary,
    deriveMachineCapability,
    machineTag,
    summariseMachine,
} from './machineCapability';

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
