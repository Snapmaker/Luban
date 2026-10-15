/* eslint-disable camelcase */
// MCP tool arguments and results are snake_case by convention.
import config from '../../configstore';
import { MAX_WAIT_MS } from '../procedureLimits';
import { McpToolError, ToolRegistry } from '../registry';
import { RotaryCalibrationError, fitRotaryCalibration } from '../rotaryGravity';
import { round } from '../vibrationAnalysis';
import {
    AnalyseArgs,
    ROTARY_CALIBRATION_KEY,
    VIBRATION_LIMITS,
    VibrationError,
    bounded,
    vibrationCaptureService,
} from '../vibrationCaptures';
import { streamRate, vibrationFeedService } from '../vibrationFeed';
import { TrackBuilder, buildReport } from '../vibrationReport';

// Accelerometers on the machine (vibrationFeed.ts): toolhead, tailstock,
// rotary chuck, axis carriages. Every tool here is READ-ONLY with respect to
// the machine - they record and analyse; none moves, pauses or stops
// anything. Motion that a diagnosis needs (an axis run, a B rotation) is
// staged through the ordinary tools on the operator's word, and recorded
// alongside.

/**
 * The rotary calibration needs this many still readings over at least this
 * spread of B: three points over 90 deg extrapolate to p95 0.35 deg with 1 mg
 * of noise, four over 270 deg to 0.09 deg (review simulation, 2026-10-04).
 */
const ROTARY_CAL_LIMITS = { minPoints: 4, minSpanDeg: 180 };
/** Captures up to this long are waited for by default; longer ones return at once. */
const WAIT_BY_DEFAULT_S = 60;

const ANALYSIS_PROPERTIES = {
    resolution_hz: { type: 'number', description: `Spectral resolution, Hz (default ${VIBRATION_LIMITS.resolutionHz.default}; finer needs longer windows).` },
    max_peaks: { type: 'number', description: `Tones to report per sensor (default ${VIBRATION_LIMITS.maxPeaks.default}).` },
    min_prominence_db: { type: 'number', description: 'A tone must stand this far above the local noise floor (default 10 dB).' },
    rpm_hint: { type: 'number', description: 'Commanded spindle S: fit the rotation comb over 0.80-1.05 x S (the microphone tracker\'s band).' },
    rpm_min: { type: 'number', description: 'Rotation search band, RPM (with rpm_max; overrides rpm_hint).' },
    rpm_max: { type: 'number' },
    flutes: { type: 'number', description: 'Cutter flutes: adds the tooth-passing harmonic to the comb.' },
    motion: {
        type: 'object',
        description: 'The axis motion during the window, as stated by whoever staged it: tones become spatial periods (mm per cycle; '
            + 'a tone tied to a screw, belt or bearing scales with feed, a resonance does not), and with `targets` the vibration is '
            + 'binned by POSITION along the axis per direction (where on the rail it is loud). Segments are detected from the vibration '
            + 'envelope and matched one-to-one to the legs; a count mismatch maps nothing.',
        properties: {
            axis: { type: 'string', description: 'x, y, z or b - recorded with the result.' },
            feed_mm_min: { type: 'number', description: 'Feed the axis moved at (traverse_xy feed_rate), mm/min.' },
            targets: { type: 'array', items: { type: 'number' }, description: 'Machine coordinates on that axis in the order visited, start first (e.g. [40, 300, 40, 300, 40]).' },
            bin_mm: { type: 'number', description: `Position bin, mm (default ${VIBRATION_LIMITS.binMm.default}).` },
            references_mm: {
                type: 'object',
                description: 'Named lengths to express each tone\'s period against, e.g. {"screw lead": 8, "belt pitch": 2}. The operator\'s or a datasheet\'s numbers - never guessed.',
                additionalProperties: { type: 'number' },
            },
        },
        additionalProperties: false,
    },
    baseline_capture_id: { type: 'string', description: 'An earlier capture of the same sensor(s): reports the tilt change (static deflection of the mount), its resolution, and the vibration level change.' },
    lever_mm: { type: 'number', description: 'With a baseline: distance from the tilting mount to the point of interest (tool tip), mm - converts tilt to lateral displacement.' },
    spectrum_points: { type: 'number', description: `Include a log-spaced spectrum with this many points (0 = none, max ${VIBRATION_LIMITS.spectrumPoints.max}).` },
};

function rethrow(err: unknown): never {
    if (err instanceof VibrationError || err instanceof RotaryCalibrationError) {
        throw new McpToolError(err.message);
    }
    throw err;
}

function rotarySensor(requested?: string): string {
    const cfg = vibrationFeedService.config();
    if (requested) {
        if (!cfg.sensors.some((s) => s.id === requested)) {
            throw new McpToolError(`unknown sensor ${requested}; configured: ${cfg.sensors.map((s) => s.id).join(', ') || 'none'}`);
        }
        return requested;
    }
    const chuck = cfg.sensors.filter((s) => s.location === 'rotary-chuck');
    if (chuck.length !== 1) {
        throw new McpToolError(chuck.length
            ? `several sensors are on the rotary chuck (${chuck.map((s) => s.id).join(', ')}): name one with sensor`
            : 'no sensor has location "rotary-chuck" (one that turns WITH the chuck); configure one in Settings -> MCP Server -> Accelerometers');
    }
    return chuck[0].id;
}

/** A quick look at the last `seconds` of each streaming sensor's ring. */
function liveLook(seconds: number): { [id: string]: unknown } {
    const out: { [id: string]: unknown } = {};
    const now = Date.now();
    for (const rt of vibrationFeedService.runtimes()) {
        if (rt.state !== 'ok') {
            continue;
        }
        if (!rt.ring) {
            out[rt.spec.id] = { note: 'no samples yet' };
            continue;
        }
        const slice = rt.ring.slice(now - seconds * 1000, now + 1);
        if (slice.times.length < 64) {
            out[rt.spec.id] = { note: 'not enough buffered samples yet' };
            continue;
        }
        const builder = new TrackBuilder(streamRate(rt), !!slice.gyro, 2);
        builder.push(slice.accel, slice.times.length, slice.gyro);
        const report = buildReport(builder.data(), { maxPeaks: 3 }) as { [key: string]: { [key: string]: unknown } };
        out[rt.spec.id] = {
            location: rt.spec.location,
            seconds: round(slice.times.length / streamRate(rt), 2),
            accel_rms_total_g: report.level.accel_rms_total_g,
            velocity_rms_mm_s: report.level.velocity_rms_mm_s,
            top_peaks: report.peaks,
            gravity_g: report.gravity.mean_g,
        };
    }
    return out;
}

export function registerVibrationTools(registry: ToolRegistry): void {
    registry.register({
        name: 'get_vibration_status',
        description: 'The accelerometer feed: whether it runs, over which bridge (Blinka on the host, or a CircuitPython board over serial), '
            + 'each configured sensor (id, where it is stuck - toolhead, tailstock, rotary-chuck, rotary-body, x/y/z-axis, bed, frame - chip, '
            + 'address, mux channel, rate, orientation) with its streaming state, measured sample rate, FIFO overruns and errors, the I2C bus '
            + 'load, what stops it starting, the stored rotary calibration and the captures recording now. With live_s, a quick level / tone / '
            + 'gravity look at the last seconds of every sensor. Read-only, no motion.',
        inputSchema: {
            type: 'object',
            properties: {
                live_s: { type: 'number', description: 'Also analyse the last N seconds of each stream (1-30).' },
            },
            additionalProperties: false,
        },
        handler: async (args: { live_s?: number }) => {
            const status = vibrationFeedService.status();
            const calibration = vibrationCaptureService.rotaryCalibration();
            const result: { [key: string]: unknown } = {
                ...status,
                rotary_calibration: calibration ? {
                    sensor_id: calibration.sensor_id,
                    created_at: calibration.created_at,
                    reason: calibration.reason,
                    residual_rms_deg: calibration.calibration ? round((calibration.calibration as { residualRmsDeg: number }).residualRmsDeg, 4) : null,
                    readings: Array.isArray(calibration.readings) ? calibration.readings.length : 0,
                } : null,
                recording: vibrationCaptureService.active().map((c) => vibrationCaptureService.describe(c.meta)),
                guidance: status.enabled
                    ? null
                    : 'Accelerometers are off. Operator: Settings -> MCP Server -> Accelerometers (or the mcpVibration* configstore keys). '
                        + 'The README section "Accelerometers" lists supported boards and wiring.',
            };
            if (args.live_s !== undefined) {
                result.live = liveLook(Math.min(Math.max(Number(args.live_s) || 2, 1), 30));
            }
            return result;
        },
    });

    registry.register({
        name: 'capture_vibration',
        description: 'Record the accelerometers for a window and analyse it, per sensor: acceleration RMS per axis and in octave bands, velocity '
            + 'RMS (ISO 10816 band, mm/s), displacement RMS (um, band stated), the strongest tones with their direction (power share per axis, '
            + 'machine axes when the sensor\'s orientation is configured) and their velocity / displacement amplitude, the gravity vector (tilt) '
            + 'with its resolution; optionally the spindle RPM from a harmonic comb (rpm_hint or rpm_min/max) and the tones it does NOT '
            + 'explain (chatter candidates); spatial periods and a position profile for a stated axis motion; tilt and level change against a '
            + 'baseline capture. lookback_s reaches into the buffered stream ("that noise just happened"). Raw samples are kept on disk for '
            + 're-analysis. READ-ONLY: records only, never moves anything. For an axis survey, start a capture (wait: false) and have the '
            + 'operator approve the motion staged with traverse_xy; then read it with get_vibration_capture and the same targets.',
        inputSchema: {
            type: 'object',
            properties: {
                sensors: { type: 'array', items: { type: 'string' }, description: 'Sensor ids (default: every streaming sensor).' },
                duration_s: { type: 'number', description: `Seconds to record from now (default ${VIBRATION_LIMITS.captureS.default}, max ${VIBRATION_LIMITS.captureS.max}).` },
                lookback_s: { type: 'number', description: 'Seconds of already-buffered stream to include before now (default 0; up to the buffer, mcpVibrationBufferS).' },
                label: { type: 'string', description: 'What was happening (kept with the capture).' },
                wait: { type: 'boolean', description: `Wait for the capture to finish and return the analysis (default: true up to ${WAIT_BY_DEFAULT_S} s).` },
                ...ANALYSIS_PROPERTIES,
            },
            additionalProperties: false,
        },
        handler: async (args: AnalyseArgs & { sensors?: string[]; duration_s?: number; lookback_s?: number; label?: string; wait?: boolean }) => {
            const durationS = bounded(args.duration_s, VIBRATION_LIMITS.captureS);
            let capture;
            try {
                capture = vibrationCaptureService.start({
                    sensors: args.sensors,
                    durationS,
                    lookbackS: args.lookback_s,
                    label: args.label,
                    resolutionHz: args.resolution_hz,
                });
            } catch (err) {
                rethrow(err);
            }
            const wait = args.wait ?? durationS <= WAIT_BY_DEFAULT_S;
            if (!wait || durationS * 1000 > MAX_WAIT_MS - 5000) {
                return {
                    ...vibrationCaptureService.describe(capture.meta),
                    note: `recording for ${durationS} s; read it with get_vibration_capture {capture_id, wait_ms} (analysis arguments go there).`,
                };
            }
            await capture.wait(durationS * 1000 + 3000);
            try {
                // Recorded at resolution_hz already: analyse the in-memory track, not the raw file again.
                const report = await vibrationCaptureService.analyse(capture.id, { ...args, resolution_hz: undefined });
                return { ...vibrationCaptureService.describe(capture.meta), report };
            } catch (err) {
                return rethrow(err);
            }
        },
    });

    registry.register({
        name: 'get_vibration_capture',
        description: 'Analyse a capture (recording now, finished, or from an earlier session - they are kept on disk): the same per-sensor report '
            + 'as capture_vibration, optionally over a sub-window (from_s / to_s, seconds from the capture\'s start) or at another resolution '
            + '(both re-read the raw samples), with a rotation band, an axis motion (spatial periods, position profile), or a baseline capture '
            + '(tilt = static deflection of the mount, level change). wait_ms long-polls a recording capture until it ends. Read-only.',
        inputSchema: {
            type: 'object',
            properties: {
                capture_id: { type: 'string' },
                wait_ms: { type: 'number', description: `Wait up to this long for a recording capture to end (max ${MAX_WAIT_MS}).` },
                sensor: { type: 'string', description: 'One sensor (default: all in the capture).' },
                from_s: { type: 'number' },
                to_s: { type: 'number' },
                ...ANALYSIS_PROPERTIES,
            },
            required: ['capture_id'],
            additionalProperties: false,
        },
        handler: async (args: AnalyseArgs & { capture_id: string; wait_ms?: number }) => {
            const capture = vibrationCaptureService.get(String(args.capture_id));
            if (capture && capture.recording && args.wait_ms) {
                await capture.wait(Math.min(Math.max(Number(args.wait_ms) || 0, 0), MAX_WAIT_MS));
            }
            if (capture && capture.recording) {
                return { ...vibrationCaptureService.describe(capture.meta), note: 'still recording - call again with wait_ms, or stop_vibration_capture' };
            }
            try {
                const meta = vibrationCaptureService.meta(String(args.capture_id));
                return { ...vibrationCaptureService.describe(meta), report: await vibrationCaptureService.analyse(meta.id, args) };
            } catch (err) {
                return rethrow(err);
            }
        },
    });

    registry.register({
        name: 'stop_vibration_capture',
        description: 'End a recording capture now (its samples so far are kept and analysed). Stops the RECORDING only - nothing on the machine. Read-only.',
        inputSchema: {
            type: 'object',
            properties: { capture_id: { type: 'string' }, reason: { type: 'string' } },
            required: ['capture_id'],
            additionalProperties: false,
        },
        handler: async (args: { capture_id: string; reason?: string }) => {
            try {
                const capture = vibrationCaptureService.stop(String(args.capture_id), args.reason || 'stopped by agent');
                return vibrationCaptureService.describe(capture.meta);
            } catch (err) {
                return rethrow(err);
            }
        },
    });

    registry.register({
        name: 'list_vibration_captures',
        description: 'Captures newest first (this session and earlier ones on disk), with label, window, job, sensors, the controller B at start and end, '
            + 'and the directory holding the raw float32 samples. Read-only.',
        inputSchema: {
            type: 'object',
            properties: { limit: { type: 'number', description: 'Default 20, max 200.' } },
            additionalProperties: false,
        },
        handler: async (args: { limit?: number }) => ({ captures: vibrationCaptureService.list(Math.min(Math.max(Number(args.limit) || 20, 1), 200)) }),
    });

    registry.register({
        name: 'measure_rotary_angle',
        description: 'The rotary chuck\'s ABSOLUTE angle from gravity, read by the accelerometer that turns with it (location rotary-chuck): a still '
            + 'reading over duration_s, the gravity vector, stillness, the controller\'s B at start and end, and - once a calibration exists - '
            + 'absolute_b_deg (the calibration session\'s B0 = 0), its uncertainty, trust checks (the mount or jig moved), and controller B minus '
            + 'absolute B: what a power cycle lost. B has no home switch on the A350, so this is the reference that survives power-off. '
            + 'Take it with B stopped and the spindle off. Each reading is a capture whose id calibrate_rotary_accelerometer accepts. '
            + 'READ-ONLY: it never rotates B or writes the controller\'s count - a correction is a rotation staged through the normal tools.',
        inputSchema: {
            type: 'object',
            properties: {
                sensor: { type: 'string', description: 'Default: the one sensor with location rotary-chuck.' },
                duration_s: { type: 'number', description: `Default ${VIBRATION_LIMITS.rotaryS.default}, max ${VIBRATION_LIMITS.rotaryS.max}.` },
                label: { type: 'string' },
            },
            additionalProperties: false,
        },
        handler: async (args: { sensor?: string; duration_s?: number; label?: string }) => {
            const sensor = rotarySensor(args.sensor);
            const durationS = bounded(args.duration_s, VIBRATION_LIMITS.rotaryS);
            try {
                const capture = vibrationCaptureService.start({ sensors: [sensor], durationS, label: args.label || 'rotary angle reading' });
                await capture.wait(durationS * 1000 + 3000);
                return await vibrationCaptureService.rotaryReading(capture.id, sensor);
            } catch (err) {
                return rethrow(err);
            }
        },
    });

    registry.register({
        name: 'calibrate_rotary_accelerometer',
        description: 'Fit and store the rotary chuck accelerometer\'s calibration from still readings (measure_rotary_angle capture ids) taken at '
            + 'four or more controller B angles spread over at least 180 deg, ALL IN ONE POWER SESSION (the controller\'s B count must be '
            + 'consistent between them; 0/90/180/270 is ideal). Nothing about the mounting is assumed: the fit finds the axis in the sensor '
            + 'frame, the accelerometer\'s offset, the rotation sense and the angle at B0, and reports its residual. The B0 of that session '
            + 'becomes the absolute zero from then on. Each reading\'s B is the controller\'s B recorded with it (it must not have moved during '
            + 'the reading); pass b_deg only when the operator states a different value. clear: true removes the stored calibration. '
            + 'Writes only this calibration (stored state, like set_probe_geometry), with the reason; no motion.',
        inputSchema: {
            type: 'object',
            properties: {
                readings: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: { capture_id: { type: 'string' }, b_deg: { type: 'number' } },
                        required: ['capture_id'],
                        additionalProperties: false,
                    },
                },
                sensor: { type: 'string', description: 'Default: the one sensor with location rotary-chuck.' },
                reason: { type: 'string', description: 'Who/what established the readings (operator, date, session).' },
                clear: { type: 'boolean' },
            },
            required: ['reason'],
            additionalProperties: false,
        },
        handler: async (args: { readings?: Array<{ capture_id: string; b_deg?: number }>; sensor?: string; reason: string; clear?: boolean }) => {
            if (!String(args.reason || '').trim()) {
                throw new McpToolError('reason is required: who established these readings, and when.');
            }
            if (args.clear) {
                const previous = vibrationCaptureService.rotaryCalibration();
                config.unset(ROTARY_CALIBRATION_KEY);
                return { cleared: true, previous, reason: args.reason };
            }
            const sensor = rotarySensor(args.sensor);
            const readings = args.readings || [];
            const points: Array<{ bDeg: number; g: [number, number, number] }> = [];
            const used: Array<{ [key: string]: unknown }> = [];
            for (const reading of readings) {
                let gravity;
                let meta;
                try {
                    meta = vibrationCaptureService.meta(String(reading.capture_id));
                    gravity = await vibrationCaptureService.gravityReading(String(reading.capture_id), sensor);
                } catch (err) {
                    return rethrow(err);
                }
                const startB = meta.controller_at_start ? meta.controller_at_start.b : null;
                const endB = meta.controller_at_end ? meta.controller_at_end.b : null;
                const bDeg = reading.b_deg !== undefined ? Number(reading.b_deg) : startB;
                if (bDeg === null || !Number.isFinite(bDeg)) {
                    throw new McpToolError(`capture ${reading.capture_id} has no controller B recorded (machine not connected?); pass b_deg with the operator's value`);
                }
                if (reading.b_deg === undefined && startB !== null && endB !== null && Math.abs(startB - endB) > 0.01) {
                    throw new McpToolError(`B moved during capture ${reading.capture_id} (${startB} -> ${endB}): take the reading again with B stopped`);
                }
                if (!gravity.still) {
                    throw new McpToolError(`capture ${reading.capture_id} was not still (${gravity.notStill.join('; ')}): retake it with B stopped and the spindle off`);
                }
                points.push({ bDeg, g: gravity.g });
                used.push({ capture_id: reading.capture_id, b_deg: bDeg, b_source: reading.b_deg !== undefined ? 'operator' : 'controller', gravity_g: gravity.g.map((v) => round(v, 5)) });
            }
            let calibration;
            try {
                calibration = fitRotaryCalibration(points, ROTARY_CAL_LIMITS);
            } catch (err) {
                return rethrow(err);
            }
            if (calibration.senseMarginDeg < 1) {
                throw new McpToolError(`the rotation sense is not determined by these readings (margin ${round(calibration.senseMarginDeg, 3)} deg): add readings at unevenly spaced B`);
            }
            const record = {
                sensor_id: sensor,
                created_at: new Date().toISOString(),
                reason: args.reason,
                readings: used,
                calibration,
            };
            config.set(ROTARY_CALIBRATION_KEY, record);
            return {
                stored: true,
                sensor_id: sensor,
                residual_rms_deg: round(calibration.residualRmsDeg, 4),
                residual_max_deg: round(calibration.residualMaxDeg, 4),
                rotation_sense_margin_deg: round(calibration.senseMarginDeg, 2),
                span_deg: round(calibration.spanDeg, 1),
                circle_radius_g: round(calibration.radiusG, 5),
                axis_in_sensor_frame: calibration.axis.map((v) => round(v, 4)),
                note: 'Absolute zero = the physical chuck angle at controller B0 in the readings\' session. A radius far from 1 g means the axis is '
                    + 'tilted or the sensor\'s scale is off; residuals above ~0.2 deg mean a reading was not still or B was misreported.',
                readings: used,
            };
        },
    });
}
