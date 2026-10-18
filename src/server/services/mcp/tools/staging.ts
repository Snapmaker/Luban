import { connectionManager } from '../../machine/ConnectionManager';
import { McpToolError } from '../registry';
import { FrameResolutionContext, GcodeValidationReport, JobFrame, resolveJobFrame, validateGcode } from '../validator';
import { getMachineSizeByIdentifier, getPositionSnapshot, zTravelTop } from './machine';

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
    } catch (err) {
        // Not connected / no heartbeat yet: resolution falls back to "unresolved".
    }
    return { frameArgument, originOffsetZ, offsetReliable, machineZMax };
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
    const resolved = resolveJobFrame(validateGcode(gcode), { ...stagingFrameContext(null), relativeTransport: options.relativeTransport === true });
    if (resolved.refusal) {
        throw new McpToolError(`Internal error: the ${what} envelope the server emitted does not declare its coordinate frame `
            + 'cleanly, so it cannot reach the confirm page (the page is the only motion gate and its Frame row would be wrong). '
            + `This is a bug in the emitter, not in your call - report it with this text. Validator: ${resolved.refusal}`);
    }
    return resolved.report;
}
