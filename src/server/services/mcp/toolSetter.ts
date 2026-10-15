/* eslint-disable camelcase */
// MCP tool arguments are snake_case by convention (planToolSetterRun takes
// the run_tool_setter arguments verbatim).
import logger from '../../lib/logger';
import { TRAVERSE_Z_TOLERANCE_MM, planToolSetterEnd } from './traversePlan';
import config from '../configstore';
import { mcpBroadcast } from './index';
import { ProbeChannel, probeFeedService } from './probeFeed';
import {
    COARSE_FEED,
    FINE_FEED,
    MAX_RETREAT_MM,
    ProcedureAbort,
    TRAVEL_FEED,
    assertChannelReady,
    assertMachineReadyForProcedure,
    descendInSegments,
    moveMachineSettled,
    marchInSegments,
    senseAfter,
    senseReleaseAfter,
    isProcedureAbort,
    abortRaiseToTop,
    raiseToTop,
    RaiseToTopPhases,
} from './probing';
import {
    MARCH_SEGMENT_MM,
    MAX_BIT_LENGTH_MM,
    TOOL_SETTER_BACKOFF_MM,
    TOOL_SETTER_CENTRE_TOLERANCE_MM,
    TOOL_SETTER_RELEASE_TIMEOUT_MIN_MS,
    TOOL_SETTER_SENSOR_DELAY_MS,
    TOOL_SETTER_SLOW_ZONE_MM,
    TOOL_SETTER_START_CLEARANCE_MM,
    clampTo,
    releaseTimeoutFor,
    resolveMarchParams,
} from './procedureLimits';
import { McpToolError } from './registry';
import { getActiveTool, setActiveTool } from './activeTool';
import { getPositionSnapshot, motionFloorZ, safeTraverseZ } from './tools/machine';

const log = logger('service:mcp:tool-setter');

// Tool height measurement against the fixed tool setter (the gold cylinder
// on the A350 bed; a normally-open switch that reports over the probe feed).
// The whole procedure is ONE operator approval: the confirm page shows the
// motion envelope (XY centre, start Z, hard floor Z, increments, feeds) and
// the server-side runner drives the steps deterministically against live
// sensor feedback - the model never chooses a Z during the run.
//
// Staged approach (operator-specified):
//   1. travel: XY to the centre at the current (post-home) Z, then Z down to
//      startZ = reference trigger Z + (longest bit - reference bit) + 50 mm
//   2. coarse: descend in 1 mm steps, checking the toolsetter feed after
//      each settled step, until contact
//   3. release: retreat in 1 mm steps until the feed reports released
//   4. fine: descend in 0.1 mm steps until contact
//   5. confirm: back off 0.3 mm, then descend 0.1 mm per >=2 s until contact
//   6. raise STRAIGHT UP to the traverse height (mcpSafeTraverseZ, machine
//      Z328 = home) and report - never back to startZ (issue #91; the head
//      ends where every following XY move must start, cnc-motion-rules law 2)
// A hard floor (expected trigger Z for the declared bit minus a margin)
// aborts the descent; the overtravel tripwire aborts everything at any time -
// and an abort raises to the same traverse height (abortRaiseToTop).

const CONFIG_KEY = 'mcpToolSetter';

// Motion/sensing engine shared with the CNC touch probe: probing.ts.

export interface ToolSetterConfig {
    centerX: number; // machine coords of the setter's centre
    centerY: number;
    triggerZ: number; // machine Z at trigger with the reference bit fitted
    referenceBitLengthMm: number;
    /**
     * Diameter of the setter's contact disc, when the operator has measured
     * it. Nothing in the tool setter needs it; the camera bootstrap does - a
     * circle of known size in a frame is an absolute scale constraint that
     * does not depend on the pose solution.
     */
    discDiameterMm?: number;
    longestBitLengthMm: number;
    floorMarginMm: number; // how far below the expected trigger Z to allow
    // Tool-change park position (machine coords), operator preference: on
    // this setup Z = the homing height and X = the far end; Y is free (null
    // = leave the current Y alone).
    changeX: number | null;
    changeY: number | null;
    changeZ: number | null;
    notes: string | null;
}

/** One completed tool setter measurement, kept for tool-change offsets. */
export interface ToolMeasurement {
    measuredTriggerZ: number;
    /** The length DECLARED to plan the descent. */
    bitLengthMm: number;
    /**
     * What the tool actually protrudes, derived from the trigger against the
     * stored reference. Clearance checks read this (toolProtrusion.ts);
     * absent on measurements recorded before it was kept.
     */
    derivedBitLengthMm?: number;
    spreadMm: number;
    at: number;
}

function rawConfig(): { [key: string]: unknown } {
    const raw = config.get(CONFIG_KEY);
    return raw && typeof raw === 'object' ? (raw as { [key: string]: unknown }) : {};
}

function numberOrNull(value: unknown): number | null {
    return Number.isFinite(Number(value)) && value !== null && value !== '' && value !== undefined
        ? Number(value) : null;
}

function parseMeasurement(raw: unknown): ToolMeasurement | null {
    if (!raw || typeof raw !== 'object') {
        return null;
    }
    const m = raw as { [key: string]: unknown };
    if (!Number.isFinite(Number(m.measuredTriggerZ)) || !Number.isFinite(Number(m.at))) {
        return null;
    }
    return {
        measuredTriggerZ: Number(m.measuredTriggerZ),
        bitLengthMm: Number(m.bitLengthMm),
        derivedBitLengthMm: Number.isFinite(Number(m.derivedBitLengthMm)) ? Number(m.derivedBitLengthMm) : undefined,
        spreadMm: Number(m.spreadMm) || 0,
        at: Number(m.at),
    };
}

export function getToolSetterConfig(): ToolSetterConfig | null {
    const cfg = rawConfig();
    const numbers = ['centerX', 'centerY', 'triggerZ', 'referenceBitLengthMm', 'longestBitLengthMm'];
    if (numbers.some((key) => !Number.isFinite(Number(cfg[key])))) {
        return null;
    }
    return {
        centerX: Number(cfg.centerX),
        centerY: Number(cfg.centerY),
        triggerZ: Number(cfg.triggerZ),
        referenceBitLengthMm: Number(cfg.referenceBitLengthMm),
        discDiameterMm: Number.isFinite(Number(cfg.discDiameterMm)) && Number(cfg.discDiameterMm) > 0
            ? Number(cfg.discDiameterMm)
            : undefined,
        longestBitLengthMm: Number(cfg.longestBitLengthMm),
        floorMarginMm: Number.isFinite(Number(cfg.floorMarginMm)) ? Number(cfg.floorMarginMm) : 3,
        changeX: numberOrNull(cfg.changeX),
        changeY: numberOrNull(cfg.changeY),
        changeZ: numberOrNull(cfg.changeZ),
        notes: cfg.notes ? String(cfg.notes) : null,
    };
}

/** Merge-write: measurement history and unknown fields survive config edits. */
export function setToolSetterConfig(cfg: ToolSetterConfig): void {
    config.set(CONFIG_KEY, { ...rawConfig(), ...cfg });
    log.info(`Tool setter config stored: centre (${cfg.centerX}, ${cfg.centerY}), `
        + `trigger Z ${cfg.triggerZ} with ${cfg.referenceBitLengthMm} mm reference bit`);
}

export function getMeasurements(): { last: ToolMeasurement | null; previous: ToolMeasurement | null } {
    const cfg = rawConfig();
    return {
        last: parseMeasurement(cfg.lastMeasurement),
        previous: parseMeasurement(cfg.previousMeasurement),
    };
}

/** Record a completed measurement, shifting the old one down a slot. */
export function recordMeasurement(measurement: ToolMeasurement): void {
    const cfg = rawConfig();
    config.set(CONFIG_KEY, {
        ...cfg,
        previousMeasurement: cfg.lastMeasurement || null,
        lastMeasurement: measurement,
    });
}

export interface ToolSetterPlan {
    config: ToolSetterConfig;
    bitLengthMm: number;
    expectedTriggerZ: number;
    startZ: number;
    /**
     * Where the head ends on success: the traverse height (mcpSafeTraverseZ),
     * a Z-only G53 raise from the trigger - never startZ (issue #91). Unused
     * when stayAtTrigger holds the tip for the touchscreen wizard.
     */
    endZ: number;
    floorZ: number;
    // Bottom of the coarse ladder: coarse steps stop this far ABOVE the
    // expected trigger and the descent continues in fine steps, so a
    // correctly-declared bit presses at most one fine step into the setter
    // (a full coarse step can overrun by up to its own size - observed
    // 0.5 mm on the first live run).
    coarseFloorZ: number;
    slowZoneMm: number;
    coarseStepMm: number;
    fineStepMm: number;
    backoffMm: number;
    sensorDelayMs: number;
    confirmPasses: number;
    storeAsReference: boolean;
    // Touchscreen manual-swap wizard support: hold at the measured trigger
    // (in contact) instead of retreating, and/or start the descent from the
    // current position (wizard returns the new tool over the setter).
    stayAtTrigger: boolean;
    startFromCurrent: boolean;
    // Measuring the spindle TOUCH PROBE on the setter: the probe's own
    // channel fires before the setter's switch, and pressing on would bend
    // the probe - accept EITHER channel as the height confirmation.
    acceptProbeContact: boolean;
}

/**
 * Derive the motion envelope for a declared bit length. Throws McpToolError
 * with operator guidance when configuration or physics rule the run out.
 */
export function planToolSetterRun(args: {
    bit_length_mm?: number;
    coarse_step_mm?: number;
    fine_step_mm?: number;
    backoff_mm?: number;
    sensor_delay_ms?: number;
    confirm_passes?: number;
    start_clearance_mm?: number;
    slow_zone_mm?: number;
    store_as_reference?: boolean;
    stay_at_trigger?: boolean;
    start_from_current?: boolean;
    accept_probe_contact?: boolean;
}): ToolSetterPlan {
    const cfg = getToolSetterConfig();
    if (!cfg) {
        throw new McpToolError('Tool setter is not configured. Ask the operator for the setter centre '
            + '(machine XY), the machine Z at trigger with a known bit, that bit\'s length, and the '
            + 'longest bit in use, then store them with set_tool_setter_config.');
    }
    const bitLengthMm = Number(args.bit_length_mm);
    if (!Number.isFinite(bitLengthMm) || bitLengthMm <= 0 || bitLengthMm > MAX_BIT_LENGTH_MM) {
        throw new McpToolError('bit_length_mm must be the approximate protrusion of the fitted bit in mm '
            + `(0-${MAX_BIT_LENGTH_MM}), as stated by the operator.`);
    }
    // The march parameters, with the setter's own backoff (a small disc) and
    // sensor delay (local-broker latency) - procedureLimits.ts has the reasons.
    const { coarseStepMm, fineStepMm, backoffMm, sensorDelayMs, confirmPasses } = resolveMarchParams(args, {
        backoff: TOOL_SETTER_BACKOFF_MM,
        delay: TOOL_SETTER_SENSOR_DELAY_MS,
    });
    const startClearanceMm = clampTo(args.start_clearance_mm, TOOL_SETTER_START_CLEARANCE_MM);
    const slowZoneMm = clampTo(args.slow_zone_mm, { ...TOOL_SETTER_SLOW_ZONE_MM, min: Math.max(TOOL_SETTER_SLOW_ZONE_MM.min, fineStepMm) });

    const expectedTriggerZ = cfg.triggerZ + (bitLengthMm - cfg.referenceBitLengthMm);
    const startZ = cfg.triggerZ + (cfg.longestBitLengthMm - cfg.referenceBitLengthMm) + startClearanceMm;
    const floorZ = expectedTriggerZ - cfg.floorMarginMm;
    if (floorZ < 0) {
        throw new McpToolError(`Computed floor Z ${floorZ.toFixed(1)} is below machine Z 0 - the declared `
            + 'bit length or stored trigger reference must be wrong. Re-check with the operator.');
    }
    if (startZ <= expectedTriggerZ) {
        throw new McpToolError('Computed start Z is at or below the expected trigger Z; check '
            + 'longestBitLengthMm and the clearance.');
    }

    return {
        config: cfg,
        bitLengthMm,
        expectedTriggerZ,
        startZ,
        endZ: safeTraverseZ(),
        floorZ,
        coarseFloorZ: Math.min(Math.max(expectedTriggerZ + slowZoneMm, floorZ), startZ),
        slowZoneMm,
        coarseStepMm,
        fineStepMm,
        backoffMm,
        sensorDelayMs,
        confirmPasses,
        storeAsReference: args.store_as_reference === true,
        stayAtTrigger: args.stay_at_trigger === true,
        startFromCurrent: args.start_from_current === true,
        acceptProbeContact: args.accept_probe_contact === true,
    };
}

/**
 * The gcode shown on the confirm page. Every line is sent INDIVIDUALLY: the
 * runner waits for each move to verifiably settle, then checks the sensor
 * feed, before issuing the next line - so the coarse descent is enumerated
 * step by step exactly as it would execute against a silent sensor. It stops
 * at the first contact, after which the fine/backoff/confirm steps repeat
 * the same one-command-per-check pattern in fine increments around the
 * contact Z (their exact targets depend on where contact happens, and all of
 * them lie between the contact Z plus backoff and the hard floor).
 */
export function describePlanAsGcode(plan: ToolSetterPlan): string {
    const c = plan.config;
    const lines = [
        '; TOOL SETTER MEASUREMENT PROCEDURE (server-driven, sensor-gated)',
        `; every move toward the setter is sent as sensor-checked segments of <= ${MARCH_SEGMENT_MM} mm (the coarse step is the logical advance)`,
        '; EVERY LINE IS SENT INDIVIDUALLY: after each move settles, the toolsetter',
        '; feed is checked before the next line is issued. Descent stops at first',
        '; contact - the full ladder below only executes if the sensor stays silent,',
        `; and then the run ABORTS at the hard floor Z ${plan.floorZ.toFixed(2)}.`,
        `; centre: machine X${c.centerX} Y${c.centerY}; declared bit ${plan.bitLengthMm} mm; expected trigger Z ${plan.expectedTriggerZ.toFixed(2)}`,
        '; overtravel feed trips -> job stop + connection close + latched alarm',
        'G90',
        'G53;',
    ];
    if (plan.startFromCurrent) {
        lines.push('; START FROM CURRENT POSITION (verified over the setter centre within 1.5 mm);',
            '; no travel moves - the descent below begins at the current Z (capped at the start height).');
    } else {
        lines.push(
            `G0 X${c.centerX.toFixed(3)} Y${c.centerY.toFixed(3)}; XY to setter centre at current (post-home) Z`,
            `G1 Z${plan.startZ.toFixed(3)} F${TRAVEL_FEED}; descend to start height in <= 5 mm segments under the crash guard (a hit before it aborts)`,
        );
    }
    let z = plan.startZ;
    let step = 0;
    while (z - plan.coarseStepMm >= plan.coarseFloorZ - 1e-9) {
        z = Math.max(z - plan.coarseStepMm, plan.coarseFloorZ);
        step += 1;
        lines.push(`G1 Z${z.toFixed(3)} F${COARSE_FEED}; coarse step ${step} - settle, check sensor, stop at contact`);
    }
    lines.push(
        `; coarse ladder ends ${plan.slowZoneMm} mm ABOVE the expected trigger; contact above this`,
        `; line means the bit is longer than declared (retreat ${plan.coarseStepMm} mm steps until released).`,
        `; SLOW ZONE - fine ${plan.fineStepMm} mm steps, max press into the setter = one step:`,
    );
    step = 0;
    while (z - plan.fineStepMm >= plan.floorZ - 1e-9) {
        z -= plan.fineStepMm;
        step += 1;
        lines.push(`G1 Z${z.toFixed(3)} F${FINE_FEED}; fine step ${step} - settle, check sensor, stop at contact`);
    }
    lines.push(
        `; ...on contact: ${plan.confirmPasses} quick confirm cycles, each = lift ${plan.backoffMm} mm, wait for the`,
        `; sensor to release, re-approach in ${plan.fineStepMm} mm steps to contact. Result = median of the`,
        '; cycle contacts (spread reported); a cycle never descends more than 0.5 mm below first contact.',
    );
    const end = planToolSetterEnd(plan.stayAtTrigger, plan.expectedTriggerZ, plan.endZ);
    if (end.action === 'hold') {
        lines.push('; HOLD AT TRIGGER when done: the tip stays in contact for the touchscreen manual-swap',
            '; wizard - NO final retreat. (Any ABORT raises straight up to the traverse height instead.)');
    } else {
        lines.push(`G1 Z${end.targetZ.toFixed(3)} F${TRAVEL_FEED}; when done: raise STRAIGHT UP to the traverse height (machine Z${end.targetZ}) - never the start height; nothing is sent if already there; an ABORT raises the same way`);
    }
    lines.push('G54;');
    return lines.join('\n');
}


export interface ToolSetterResult {
    measuredTriggerZ: number;
    confirmPassContacts: number[];
    spreadMm: number;
    expectedTriggerZ: number;
    deltaMm: number;
    derivedBitLengthMm: number;
    phases: { phase: string; z: number; note?: string }[];
    storedAsReference: boolean;
    /** Machine Z the head was left at: the traverse height on a normal run, the trigger Z when holding. */
    finalZ: number | null;
    note: string;
    active_tool?: object;
    active_tool_replaced?: object;
    warning?: string;
}

/** Phase names the success-path raise announces (the abort path uses abort-*). */
const SUCCESS_RETREAT_PHASES: RaiseToTopPhases = {
    noRetreat: 'retreat-skipped',
    held: 'retreat-skipped',
    skipped: 'retreat-skipped',
    raised: 'retreated',
    moveTag: 'retreat',
};

/**
 * The operator-approved run. Every motion re-checks the overtravel latch;
 * success and abort alike end with a raise STRAIGHT UP to the traverse height
 * (raiseToTop / abortRaiseToTop) when the machine still answers.
 */
export async function runToolSetterProcedure(plan: ToolSetterPlan, measurementJobId?: string): Promise<object> {
    const contactChannels: ProbeChannel[] = plan.acceptProbeContact ? ['toolsetter', 'probe'] : ['toolsetter'];
    for (const channel of contactChannels) {
        assertChannelReady(channel, 'tool setter');
    }
    // This procedure EXPECTS these channels to touch; anything else firing
    // mid-motion is a collision (crash guard). Cleared in the finally.
    probeFeedService.setExpectedContact(contactChannels);
    assertMachineReadyForProcedure();
    const position = getPositionSnapshot();

    const phases: { phase: string; z: number; note?: string }[] = [];
    const c = plan.config;
    const announce = (phase: string, z: number, note?: string) => {
        phases.push({ phase, z: Number(z.toFixed(3)), note });
        mcpBroadcast('mcp:activity', { tool: 'run_tool_setter', phase, z: Number(z.toFixed(3)), note });
    };

    let currentZ = plan.startZ;
    try {
        if (plan.startFromCurrent) {
            // Touchscreen-wizard flow: the machine is already positioned over
            // the setter (the wizard returns it there after the swap). Verify
            // rather than trust, then descend from where we are.
            const { x, y, z } = position.machine;
            if (x === null || y === null || z === null) {
                throw new ProcedureAbort('start_from_current: current machine position unknown.');
            }
            if (Math.abs(x - c.centerX) > TOOL_SETTER_CENTRE_TOLERANCE_MM || Math.abs(y - c.centerY) > TOOL_SETTER_CENTRE_TOLERANCE_MM) {
                throw new ProcedureAbort(`start_from_current: machine XY (${x.toFixed(1)}, ${y.toFixed(1)}) `
                    + `is not over the setter centre (${c.centerX}, ${c.centerY}) within ${TOOL_SETTER_CENTRE_TOLERANCE_MM} mm.`);
            }
            if (z <= plan.floorZ) {
                throw new ProcedureAbort(`start_from_current: machine Z ${z.toFixed(2)} is at or below the `
                    + `hard floor ${plan.floorZ.toFixed(2)}.`);
            }
            currentZ = Math.min(z, plan.startZ);
            announce('start-from-current', currentZ, 'skipping travel; descending from the current position');
        } else {
            // Phase 1: position over the centre, then travel down to start
            // height. XY first, and ONLY at top gantry height (operator law
            // after the 2026-09-01 probe crash) - the bit never sweeps across
            // the bed below the safe traverse Z.
            const z = position.machine.z;
            if (z === null || z < motionFloorZ() - TRAVERSE_Z_TOLERANCE_MM) {
                throw new ProcedureAbort(`XY travel to the setter refused at machine Z ${z === null ? 'unknown' : z.toFixed(1)} - `
                    + `below the motion floor ${motionFloorZ()}. Raise Z first (move_z, operator-confirmed).`);
            }
            announce('travel-xy', z, `XY to (${c.centerX}, ${c.centerY})`);
            await moveMachineSettled('toolsetter:travel', { x: c.centerX, y: c.centerY }, TRAVEL_FEED);
            announce('travel-z', plan.startZ, 'in <= 5 mm segments under the crash guard (operator law 2026-09-05)');
            // A long single move toward the setter cannot be stopped once sent;
            // segments of <= 5 mm. Contact ABOVE the start height means the bit
            // is longer than declared - a collision, not a measurement - so the
            // setter channels are NOT expected during the travel: the crash
            // guard latches asynchronously and the next segment is refused.
            probeFeedService.clearExpectedContact();
            try {
                await descendInSegments('toolsetter:travel', z, plan.startZ, contactChannels, plan.sensorDelayMs);
            } finally {
                probeFeedService.setExpectedContact(contactChannels);
            }
        }

        // Phase 2: coarse descent, sensor-checked after every settled step,
        // ONLY down to the slow zone above the expected trigger. Contact in
        // this phase means the bit is longer than declared (a coarse step can
        // press up to its own size into the setter - the slow zone keeps a
        // correctly-declared bit out of that regime).
        let coarseContactZ: number | null = null;
        while (currentZ - plan.coarseStepMm >= plan.coarseFloorZ - 1e-9) {
            // The coarse step is the logical advance; the physical moves are
            // <= MARCH_SEGMENT_MM, each sensor-checked (probing.ts).
            const advance = await marchInSegments(
                async (v) => moveMachineSettled('toolsetter:coarse', { z: v }, COARSE_FEED),
                currentZ, Math.max(currentZ - plan.coarseStepMm, plan.coarseFloorZ), contactChannels, plan.sensorDelayMs
            );
            currentZ = advance.s;
            if (advance.sensed.contact) {
                coarseContactZ = currentZ;
                announce('coarse-contact', currentZ,
                    `sensor "${advance.sensed.reading?.value}" ABOVE the slow zone - bit longer than declared`);
                break;
            }
        }

        // Release-type checks wait out the feed's real-world latency (the
        // release message has been observed arriving ~1s after the motion);
        // a short window here caused a false "hysteresis" abort on run 2.
        const releaseTimeoutMs = releaseTimeoutFor(plan.sensorDelayMs, TOOL_SETTER_RELEASE_TIMEOUT_MIN_MS);

        // Phase 3: only after a coarse contact - retreat until released, so
        // the fine approach starts from a clear sensor.
        if (coarseContactZ !== null) {
            let releasedZ: number | null = null;
            while (currentZ < coarseContactZ + MAX_RETREAT_MM) {
                const stepStart = Date.now();
                currentZ += plan.coarseStepMm;
                await moveMachineSettled('toolsetter:release', { z: currentZ }, COARSE_FEED);
                const sensed = await senseReleaseAfter(contactChannels, stepStart, releaseTimeoutMs);
                if (!sensed.contact) {
                    releasedZ = currentZ;
                    announce('released', currentZ);
                    break;
                }
            }
            if (releasedZ === null) {
                throw new ProcedureAbort(`Sensor still reads triggered ${MAX_RETREAT_MM} mm above first contact - `
                    + 'stuck switch or feed fault.');
            }
        } else {
            announce('slow-zone', currentZ, 'coarse ladder done, no contact; continuing in fine steps');
        }

        // Phase 4: fine approach - the primary contact phase when the
        // declared bit length is right (max press = one fine step).
        let fineContactZ: number | null = null;
        while (currentZ - plan.fineStepMm >= plan.floorZ - 1e-9) {
            const stepStart = Date.now();
            currentZ -= plan.fineStepMm;
            await moveMachineSettled('toolsetter:fine', { z: currentZ }, FINE_FEED);
            const sensed = await senseAfter(contactChannels, stepStart, plan.sensorDelayMs);
            if (sensed.contact) {
                fineContactZ = currentZ;
                announce('fine-contact', currentZ, `${sensed.channel} sensor "${sensed.reading?.value}"`);
                break;
            }
        }
        if (fineContactZ === null) {
            throw new ProcedureAbort(`Reached the hard floor Z ${plan.floorZ.toFixed(2)} without contact. `
                + 'The declared bit length, the stored trigger reference, or the sensor is wrong.');
        }

        // Phase 5: repeated quick lift-and-retest cycles (operator-specified
        // protocol): each pass lifts by the backoff, waits for the sensor to
        // actually release (patient - correctness gates on it), then
        // re-approaches in fine steps with the SHORT contact window. A pass
        // risks only a couple of fine steps, so a feed timing aberration
        // shows up as spread between passes instead of biasing the result;
        // the reported trigger Z is the median.
        const passContacts: number[] = [];
        const cycleFloor = Math.max(plan.floorZ, fineContactZ - 0.5);
        let referenceContactZ = fineContactZ;
        for (let pass = 1; pass <= plan.confirmPasses; pass++) {
            const liftIssuedAt = Date.now();
            currentZ = referenceContactZ + plan.backoffMm;
            await moveMachineSettled('toolsetter:backoff', { z: currentZ }, FINE_FEED);
            const liftSense = await senseReleaseAfter(contactChannels, liftIssuedAt, releaseTimeoutMs);
            if (liftSense.contact) {
                throw new ProcedureAbort(`Sensor still triggered ${releaseTimeoutMs} ms after backing off `
                    + `${plan.backoffMm} mm - trigger hysteresis exceeds the backoff. Rerun with a larger backoff_mm.`);
            }
            let passContact: number | null = null;
            while (currentZ - plan.fineStepMm >= cycleFloor - 1e-9) {
                const stepStart = Date.now();
                currentZ -= plan.fineStepMm;
                await moveMachineSettled('toolsetter:confirm', { z: currentZ }, FINE_FEED);
                const sensed = await senseAfter(contactChannels, stepStart, plan.sensorDelayMs);
                if (sensed.contact) {
                    passContact = currentZ;
                    break;
                }
            }
            if (passContact === null) {
                throw new ProcedureAbort(`Confirm pass ${pass} descended to ${cycleFloor.toFixed(2)} `
                    + '(0.5 mm below the first fine contact) without re-contact - inconsistent sensor.');
            }
            passContacts.push(Number(passContact.toFixed(3)));
            announce(`confirm-${pass}`, passContact, `of ${plan.confirmPasses}`);
            referenceContactZ = passContact;
        }
        const sorted = [...passContacts].sort((a, b) => a - b);
        const measuredZ = sorted[Math.floor((sorted.length - 1) / 2)];
        const spreadMm = Number((sorted[sorted.length - 1] - sorted[0]).toFixed(3));
        announce('measured', measuredZ, `median of [${passContacts.join(', ')}], spread ${spreadMm} mm`);

        // Phase 6: raise STRAIGHT UP to the traverse height (issue #91) -
        // the same Z-only G53 move an abort makes, never back to the start
        // height - unless the touchscreen manual-swap wizard needs the tip
        // HELD at the trigger so the operator can confirm the matched
        // position there. The setter channels stay expected during the lift:
        // it starts in contact.
        let finalZ: number | null;
        let endNote: string;
        if (plan.stayAtTrigger) {
            const holdIssuedAt = Date.now();
            currentZ = measuredZ;
            await moveMachineSettled('toolsetter:hold', { z: currentZ }, FINE_FEED);
            await senseAfter(contactChannels, holdIssuedAt, plan.sensorDelayMs);
            announce('holding-at-trigger', measuredZ, 'NOT retreating - touchscreen wizard takes over');
            finalZ = measuredZ;
            endNote = ' HOLDING AT THE TRIGGER (in contact, no retreat): the operator confirms on the '
                + 'touchscreen wizard from here - send no other motion until they say the swap flow is done.';
        } else {
            const raised = await raiseToTop('toolsetter',
                (phase, z, note) => announce(phase, z ?? currentZ, note),
                { phases: SUCCESS_RETREAT_PHASES });
            finalZ = raised.z;
            if (raised.z !== null) {
                currentZ = raised.z;
            }
            endNote = raised.action === 'raised' || raised.action === 'skipped'
                ? ` Head left at the traverse height (machine Z ${raised.z}) - ${raised.note}.`
                : ` Head NOT raised (${raised.note}) - machine Z ${raised.z === null ? 'unknown' : raised.z.toFixed(3)}.`;
        }

        const derivedBitLengthMm = c.referenceBitLengthMm + (measuredZ - c.triggerZ);
        recordMeasurement({
            measuredTriggerZ: measuredZ,
            bitLengthMm: plan.bitLengthMm,
            // What the tool ACTUALLY protrudes, as opposed to the length that
            // was declared to plan the descent. Clearance checks read this.
            derivedBitLengthMm: Number(derivedBitLengthMm.toFixed(3)),
            spreadMm,
            at: Date.now(),
        });
        const previousActiveTool = getActiveTool();
        const activeTool = setActiveTool({
            protrusionMm: derivedBitLengthMm,
            source: plan.acceptProbeContact ? 'spindle_probe' : 'tool_setter',
            measurementJobId: measurementJobId || null,
            note: `Successful run_tool_setter measurement; spread ${spreadMm} mm.`,
        });
        let storedAsReference = false;
        if (plan.storeAsReference) {
            setToolSetterConfig({
                ...c,
                triggerZ: measuredZ,
                referenceBitLengthMm: plan.bitLengthMm,
            });
            storedAsReference = true;
        }

        const result: ToolSetterResult = {
            measuredTriggerZ: measuredZ,
            confirmPassContacts: passContacts,
            spreadMm,
            expectedTriggerZ: plan.expectedTriggerZ,
            deltaMm: Number((measuredZ - plan.expectedTriggerZ).toFixed(3)),
            derivedBitLengthMm: Number(derivedBitLengthMm.toFixed(3)),
            phases,
            storedAsReference,
            finalZ,
            note: `Trigger at machine Z ${measuredZ.toFixed(3)} - median of ${plan.confirmPasses} confirm `
                + `passes [${passContacts.join(', ')}], spread ${spreadMm} mm (+/- ${plan.fineStepMm} mm step `
                + 'resolution). The derived bit length assumes the stored reference is exact; report it '
                + `with that uncertainty.${endNote}`,
            active_tool: activeTool,
            active_tool_replaced: { previous: previousActiveTool, current: activeTool },
            warning: spreadMm > plan.fineStepMm + 1e-9
                ? `Confirm passes spread ${spreadMm} mm exceeds one fine step - feed timing was unstable; `
                    + 'consider more confirm_passes or a longer sensor_delay_ms.'
                : undefined,
        };
        return result as unknown as object;
    } catch (err) {
        // Best-effort retreat STRAIGHT UP to the traverse height - never to the
        // start height: job fd7fa6cb6396 aborted before its travel (at home) and
        // "retreat to start height" plunged 122 mm at the home XY. The helper
        // skips the move when the overtravel latch is closing the connection or
        // the head is already at the top.
        try {
            await abortRaiseToTop('toolsetter', (phase, z, note) => announce(phase, z ?? currentZ, note));
        } catch (retreatErr) {
            log.error(`Tool setter abort retreat failed: ${(retreatErr as Error).message}`);
        }
        if (isProcedureAbort(err)) {
            throw new McpToolError(`Tool setter run aborted: ${err.message} `
                + `Phases completed: ${JSON.stringify(phases)}`);
        }
        throw err;
    } finally {
        probeFeedService.clearExpectedContact();
    }
}
