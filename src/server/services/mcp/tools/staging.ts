import { connectionManager } from '../../machine/ConnectionManager';
import { connectedMachineIdentifier, connectedMachineTag, machineCapabilityFor } from '../connectedMachine';
import { RulePhase } from '../dialectRules';
import { StagedMachine } from '../jobMachineBinding';
import { ResolvedTravel } from '../machineTravel';
import { McpToolError } from '../registry';
import { FrameResolutionContext, GcodeValidationReport, JobFrame, ValidationOptions, resolveJobFrame, validateGcode } from '../validator';
import { getMachineSizeByIdentifier, getPositionSnapshot, planningTravel, zTravelTop } from './machine';
import { currentLaserAcceleration } from './firmware';

/**
 * Live context for resolveJobFrame(): the work-origin Z offset the position
 * of record currently holds and whether it can be trusted for resolving a
 * work-frame job's extents to machine coordinates. With no machine or no
 * heartbeat a machine-frame job can still be staged; a work-frame one is
 * accepted with its machine extents marked unresolved.
 */
export function stagingFrameContext(frameArgument: JobFrame | null): FrameResolutionContext {
    let originOffsetZ: number | null = null;
    let offsetReliable = false;
    let machineZMax: number | null = null;
    // Recorded with a work-frame job (originOffsetAtStaging): laser_frame on
    // the Ray refuses once the live offset has moved away from it.
    let originOffset: { x: number; y: number; z: number } | null = null;
    let offsetReportedAt: number | null = null;
    try {
        const size = getMachineSizeByIdentifier(connectionManager.getConnectionStatus().machineIdentifier);
        // The definition's size.z (325 on the A350) is below the park / home
        // height (328) every procedure hops at, so every staged procedure was
        // warned "Z .. 328 is outside the 0 .. 325 travel" (issue #178). The
        // traverse height is a Z the toolhead demonstrably reaches - home is
        // there - so it is the least the Z travel extends to.
        machineZMax = size ? zTravelTop(size.z) : null;
        const position = getPositionSnapshot();
        originOffsetZ = position.originOffset.z;
        offsetReliable = position.originOffsetSource === 'heartbeat' && position.warnings.length === 0;
        originOffset = { ...position.originOffset };
        offsetReportedAt = position.reportedAt;
    } catch (err) {
        // Not connected / no heartbeat yet: resolution falls back to "unresolved".
    }
    return { frameArgument, originOffsetZ, offsetReliable, machineZMax, originOffset, offsetReportedAt };
}

/**
 * The validator options for the CONNECTED machine (#265 WP3): its dialect row,
 * Z axis, rotary support and, for a submitted file, its XY travel. undefined
 * when no machine is connected (or the harness stub names none): the file is
 * then judged by the legacy A350 rules, exactly as before - the 'unknown'
 * dialect row would refuse every G53 and is only for a machine that IS
 * connected but missing from the table.
 */
export function connectedValidationOptions(phase: RulePhase, headType: string | null = null): ValidationOptions | undefined {
    const identifier = connectedMachineIdentifier();
    if (!identifier) {
        return undefined;
    }
    const capability = machineCapabilityFor(identifier);
    let travel: ResolvedTravel | null = null;
    // Server-emitted bodies were planned inside the travel already
    // (requirePlanningTravel / assertWithinTravel); a submitted file was not.
    if (phase !== 'staged') {
        try {
            travel = planningTravel();
        } catch (err) {
            travel = null;
        }
    }
    return {
        dialect: capability.dialect,
        machineIdentifier: identifier,
        hasZ: capability.hasZ,
        supportsRotary: capability.supports.rotary,
        travel,
        headType,
        phase,
        laserAcceleration: currentLaserAcceleration(),
    };
}

/**
 * The connected machine as a staged job records it (jobMachineBinding.ts):
 * identifier, dialect and the connection's device serial when it reports one
 * (getConnectionStatus().deviceSerial - read defensively, absent on transports
 * and builds without it). null when nothing is connected.
 */
export function connectedStagingMachine(): StagedMachine | null {
    const identifier = connectedMachineIdentifier();
    if (!identifier) {
        return null;
    }
    let deviceSerial: string | null = null;
    try {
        const status = connectionManager.getConnectionStatus() as unknown as { deviceSerial?: unknown };
        if (status && typeof status.deviceSerial === 'string' && status.deviceSerial.trim()) {
            deviceSerial = status.deviceSerial.trim();
        }
    } catch (err) {
        deviceSerial = null;
    }
    return { identifier, dialect: machineCapabilityFor(identifier).dialect.id, deviceSerial };
}

/**
 * Validate a body the SERVER emitted - a procedure envelope or a direct
 * move's review text - and resolve its frame, so the confirm page's Frame row
 * and machine-resolved Z extents are filled for it exactly as for a submitted
 * file. Until 2026-09-21 these bodies went through validateGcode() alone, so
 * every procedure and direct job read "Z extents, MACHINE: UNRESOLVED - see
 * warnings" with no warning to see, and a body that declared no frame at all
 * (a capture-only probe_program) reached the page as "Frame: UNDECLARED".
 *
 * A refusal here means the emitter produced a body the doctrine would refuse
 * from an agent - no frame before the first move, or G53 never handed back.
 * That is a server bug, and it is thrown rather than shown: the page is the
 * only motion gate, and a page whose Frame row is wrong is not a gate.
 */
export function validateStagedEnvelope(gcode: string, what: string, options: { relativeTransport?: boolean } = {}): GcodeValidationReport {
    const report = validateGcode(gcode, connectedValidationOptions('staged'));
    // The connected machine's rules (dialectRules.ts) refuse this body - a
    // capability mismatch (a Z move on the Ray, G53 on a machine without
    // workspaces), not an emitter bug: say which machine, and why.
    if (report.machine && report.machine.refusals.length) {
        const refusals = report.machine.refusals.join(' ');
        throw new McpToolError(`The ${what} body cannot be sent ${connectedMachineTag()}: ${refusals}`);
    }
    const resolved = resolveJobFrame(report, { ...stagingFrameContext(null), relativeTransport: options.relativeTransport === true });
    if (resolved.refusal) {
        throw new McpToolError(`Internal error: the ${what} envelope the server emitted does not declare its coordinate frame `
            + 'cleanly, so it cannot reach the confirm page (the page is the only motion gate and its Frame row would be wrong). '
            + `This is a bug in the emitter, not in your call - report it with this text. Validator: ${resolved.refusal}`);
    }
    return resolved.report;
}
