/* eslint-disable camelcase */
// MCP tool arguments are snake_case by convention.
//
// Every bound a procedure planner applies to its arguments, named once and
// with its reason next to it. Until 2026-09-21 these lived inline as
// `Math.min(Math.max(Number(args.x) || 1, 0.2), 1)` in eight planners, and
// a reader could not tell a deliberate variation (probe_circle's 2 mm
// radial step, the surface scans' 0.5 mm floor, the GPIO transport's 30 ms
// sensor floor) from a copy-paste drift.
//
// A named constant is not a resolved one: these are caps on what an agent
// may ask for, not statements about the machine. Anything that describes
// where the toolhead can go belongs in machineTravel.ts; anything that
// describes where an obstacle is belongs in a landmark.
//
// Pure: no server imports. surfaceScan.ts and envelopeChecks.ts import it,
// so it must stay that way.

export interface Range {
    min: number;
    max: number;
}

export interface Bounded extends Range {
    /** Used when the argument is absent, not a number, or 0 - `Number(x) || default`, as every planner always read it. */
    default: number;
}

/** `Number(raw) || default`, then clamped into [min, max] - the one idiom every planner used, unchanged. */
export function clampTo(raw: unknown, limit: Bounded): number {
    return Math.min(Math.max(Number(raw) || limit.default, limit.min), limit.max);
}

/**
 * clampTo that also says what it did, so the caller can REPORT a clip (on the
 * confirm page and in the result) instead of silently planning the capped
 * value. `requested` is the finite, non-zero number the caller typed, or null
 * when the default was used (absent, non-numeric or 0 - clampTo's idiom).
 */
export interface ClampReport {
    value: number;
    requested: number | null;
    clipped: boolean;
}

export function clampReported(raw: unknown, limit: Bounded): ClampReport {
    const typed = Number(raw);
    const requested = raw === undefined || raw === null || raw === '' || !Number.isFinite(typed) || typed === 0 ? null : typed;
    const value = clampTo(raw, limit);
    return { value, requested, clipped: requested !== null && value !== requested };
}

/** clampTo for a count. */
export function clampCount(raw: unknown, limit: Bounded): number {
    return Math.min(Math.max(Math.round(Number(raw) || limit.default), limit.min), limit.max);
}

/** Is `value` inside [min, max]? For the refusal-style checks (a range the caller must meet, not one it is clamped into). */
export function within(value: number, range: Range): boolean {
    return Number.isFinite(value) && value >= range.min && value <= range.max;
}

// ---------------------------------------------------------------------------
// Feeds the procedure runners command (probing.ts moveMachineSettled and the
// marches). Named here, pure, so the confirm-page describers can render the
// runner's plan without importing the server.
// ---------------------------------------------------------------------------

/** mm/min for raises, hops and retreats; matches the move_z cap (MOVE_Z_FEED.max). */
export const TRAVEL_FEED = 600;
/** Coarse march steps and guarded descent steps. */
export const COARSE_FEED = 100;
/** Fine march steps after contact. */
export const FINE_FEED = 60;

// ---------------------------------------------------------------------------
// The sensor-gated march (march.ts): coarse steps to contact, retreat to
// release, fine steps, confirm cycles.
// ---------------------------------------------------------------------------

/**
 * The caller's LOGICAL advance between sensor verdicts. The operator law of
 * 2026-09-05 (job cdbc29371b97, "never 2 mm") is about the PHYSICAL move: no
 * single gcode move toward the work may press further into the probe than
 * one sensor-checked segment (MARCH_SEGMENT_MM, enforced by
 * probing.marchInSegments whatever the coarse step is). The 1 mm cap here is
 * the value the planners have carried since that day; probe_circle's 2 mm
 * is its own, below.
 */
export const COARSE_STEP_MM: Bounded = { default: 1, min: 0.2, max: 1 };
/**
 * The surface scans floor the coarse step at 0.5: their slow zone
 * (surfaceScan.slowZoneFor) takes the approach over near the expected
 * contact, so a finer coarse step only costs time. Value as found at
 * extraction.
 */
export const SURFACE_COARSE_STEP_MM: Bounded = { default: 1, min: 0.5, max: COARSE_STEP_MM.max };
/**
 * probe_circle's radial marches default to 0.5 mm (the feature's diameter is
 * bounded by the operator, so the ladder is short) and may be asked for up to
 * 2 mm: the coarse step is a logical advance, and the physical moves that
 * make it up are segmented and sensor-checked regardless (MARCH_SEGMENT_MM).
 */
export const CIRCLE_COARSE_STEP_MM: Bounded = { default: 0.5, min: COARSE_STEP_MM.min, max: 2 };
export const FINE_STEP_MM: Bounded = { default: 0.1, min: 0.02, max: 0.5 };
/** After contact the probe retreats this far before the fine approach; never less than a fine step. */
export const BACKOFF_MM: Bounded = { default: 1, min: FINE_STEP_MM.min, max: 3 };
/** The tool setter's disc is a small target: a short backoff keeps the bit over it. */
export const TOOL_SETTER_BACKOFF_MM: Bounded = { default: 0.3, min: FINE_STEP_MM.min, max: 2 };
/** How long after a move settles the probe feed is given to report a contact. */
export const SENSOR_DELAY_MS: Bounded = { default: 300, min: 100, max: 10000 };
/**
 * Floor 30 ms for the planners that run on the GPIO transport: there the
 * trigger led the controller reply on every contact of jobs 1db4/d8f6
 * (tightest lead 5 ms). The MQTT-era floor of 100 ms stays for the rest.
 */
export const GPIO_SENSOR_DELAY_MS: Bounded = { default: SENSOR_DELAY_MS.default, min: 30, max: SENSOR_DELAY_MS.max };
/** 200 ms default tuned to the operator's local-broker latency; the hard floor and the overtravel tripwire backstop a missed message. */
export const TOOL_SETTER_SENSOR_DELAY_MS: Bounded = { default: 200, min: SENSOR_DELAY_MS.min, max: SENSOR_DELAY_MS.max };
/** Lift-and-retest cycles after the fine contact; the median is the result. */
export const CONFIRM_PASSES: Bounded = { default: 3, min: 1, max: 10 };
/** probe_circle confirms every azimuth, so fewer passes per point. */
export const CIRCLE_CONFIRM_PASSES: Bounded = { default: 2, min: 1, max: 5 };
/**
 * Release-type checks wait out the feed's real-world latency (the release
 * message has been observed arriving ~1 s after the motion); a short window
 * caused a false "hysteresis" abort on tool-setter run 2.
 */
export const RELEASE_TIMEOUT_DELAY_FACTOR = 4;
export const RELEASE_TIMEOUT_MIN_MS = 3500;
export const TOOL_SETTER_RELEASE_TIMEOUT_MIN_MS = 2500;

export function releaseTimeoutFor(sensorDelayMs: number, minMs: number = RELEASE_TIMEOUT_MIN_MS): number {
    return Math.max(sensorDelayMs * RELEASE_TIMEOUT_DELAY_FACTOR, minMs);
}

/**
 * The perimeter crawl's standoff retreat (#183): after a fine retreat step
 * SHORT of the last point known free, a probe still reading contact is
 * answered by the next step back, so the release is awaited only this long.
 * T8 rerun (job d677bd88d31a, GPIO, sensor_delay 50): 830 releases all read
 * within 303 ms of the retreat settling (the feed polls at 100 ms); 30 waits
 * of the full 3.5 s timeout (105 s) were steps where the tip was still in the
 * wall and the next step released it at once. 500 ms covers the slowest
 * observed release with margin; a release read later only makes the standoff
 * one step longer. The step past the last point known free keeps the full
 * releaseTimeoutFor - that answer is a fault.
 */
export const STANDOFF_RELEASE_WINDOW_MIN_MS = 500;

export function standoffReleaseWindowFor(sensorDelayMs: number): number {
    return Math.min(releaseTimeoutFor(sensorDelayMs), Math.max(sensorDelayMs, STANDOFF_RELEASE_WINDOW_MIN_MS));
}

/**
 * The PHYSICAL move: no single gcode move toward the work presses further
 * than this before the sensor is read again (operator law 2026-09-05, job
 * cdbc29371b97: "never 2 mm" - a move once sent cannot be stopped, so a
 * collision is driven to the end of it). The caller's coarse step is a
 * logical advance made of these; probing.marchInSegments enforces it for
 * every planner, and DESCENT_SEGMENT_MM below is the same rule for a descent
 * that expects NO contact.
 */
export const MARCH_SEGMENT_MM = 1;

/**
 * Longest single Z move toward the work a procedure may issue when NO
 * contact is expected (probing.descendInSegments; operator law 2026-09-05).
 *
 * Why 5 is the default and the cap: a descent expects nothing in its way,
 * so no segment waits on a serial sensor read - the controller's ok is the
 * gate and the probe feed's crash guard is ASYNCHRONOUS: a channel firing
 * while motion is in flight latches the CRASH alarm (job stop, connection
 * close) and the next segment is refused, so a hit ends the descent within
 * ONE segment. 5 mm is the operator's cap for that one segment (the same
 * number as TRACE_COARSE_STEP_MM.max); 1 mm would turn a 300 mm descent
 * from home into 300 settle-verified moves (~5 min) for no gain where the
 * column is known clear.
 *
 * Why it can be lowered per call (issue #166, "1 mm x/y traverse but 5 mm
 * lunge"): the operator found a 5 mm lunge risky where the column is not
 * proven clear - an unmeasured scene, a first approach near a fixture, a
 * capture descent beside a wall. `descent_segment_mm` on a probe_sequence /
 * probe_program descend step, a surface scan's first approach and a capture
 * at a stated Z shortens the segment to as little as the march segment
 * (1 mm); the page states the length it will use, and a request above the
 * cap is clamped and REPORTED, never silently planned. The cap never rises.
 */
export const DESCENT_SEGMENT_MM: Bounded = { default: 5, min: MARCH_SEGMENT_MM, max: 5 };

/**
 * The scalar positions a march visits on its way from `fromS` to `toS`:
 * evenly divided into steps no longer than `segmentMm`, the end always
 * included, nothing when there is no distance to cover. Pure, so the
 * segmenting is unit-tested apart from the machine.
 */
export function marchSegments(fromS: number, toS: number, segmentMm: number = MARCH_SEGMENT_MM): number[] {
    const distance = Math.abs(toS - fromS);
    if (distance < 1e-9) {
        return [];
    }
    const count = Math.max(1, Math.ceil(distance / segmentMm - 1e-9));
    const direction = toS > fromS ? 1 : -1;
    const step = distance / count;
    const out: number[] = [];
    for (let i = 1; i <= count; i++) {
        out.push(i === count ? toS : Number((fromS + direction * step * i).toFixed(6)));
    }
    return out;
}

/**
 * A guarded descent's final approach: fast segments stop this far above the
 * stated target and 1 mm sensor-checked steps take over (operator,
 * 2026-09-02). Shared by probe_sequence's descend step, the surface scans'
 * approach to station 1, the bounded procedures' station descents and a
 * probe_program capture at a stated Z (#177).
 */
export const DESCENT_GUARD_MM = 20;
/** How far a single march may run before it aborts with no contact. */
export const MARCH_TRAVEL_MM: Range = { min: 1, max: 150 };
/** start_z_machine - floor_z_machine: the deepest a -Z search may go. */
export const MAX_DESCENT_BAND_MM = 150;
/** A stepped traverse lifts this much on contact. */
export const HOP_LIFT_MM: Bounded = { default: 2, min: 0.5, max: 10 };

export interface MarchArgs {
    coarse_step_mm?: unknown;
    fine_step_mm?: unknown;
    backoff_mm?: unknown;
    sensor_delay_ms?: unknown;
    confirm_passes?: unknown;
}

export interface ResolvedMarchParams {
    coarseStepMm: number;
    fineStepMm: number;
    backoffMm: number;
    sensorDelayMs: number;
    confirmPasses: number;
}

/**
 * The five march parameters from a tool's arguments, clamped to the named
 * limits. A planner with a reason to differ passes its own Bounded for that
 * one parameter and leaves the rest shared.
 */
export function resolveMarchParams(
    args: MarchArgs,
    over: Partial<{ coarse: Bounded; backoff: Bounded; delay: Bounded; passes: Bounded }> = {}
): ResolvedMarchParams {
    const fineStepMm = clampTo(args.fine_step_mm, FINE_STEP_MM);
    const backoff = over.backoff || BACKOFF_MM;
    return {
        coarseStepMm: clampTo(args.coarse_step_mm, over.coarse || COARSE_STEP_MM),
        fineStepMm,
        // Never less than the fine step actually in use: the retreat has to clear the release.
        backoffMm: clampTo(args.backoff_mm, { ...backoff, min: Math.max(backoff.min, fineStepMm) }),
        sensorDelayMs: clampTo(args.sensor_delay_ms, over.delay || SENSOR_DELAY_MS),
        confirmPasses: clampCount(args.confirm_passes, over.passes || CONFIRM_PASSES),
    };
}

// ---------------------------------------------------------------------------
// Operator-stated machine quantities: sanity ranges on what may be TYPED,
// not statements about the machine.
// ---------------------------------------------------------------------------

/** No Snapmaker's Z travel reaches this; a stated machine Z above it is a typo or a frame mix-up. */
export const MAX_STATED_MACHINE_Z_MM = 400;
/** A program's transient keep_out list. */
export const MAX_KEEP_OUT_BOXES = 20;
/** run_probing_gcode known_walls: measured walls the agent declares for the planning clearance check (wallClearance.ts). */
export const MAX_KNOWN_WALLS = 40;
/**
 * wall_margin_mm: how much air beyond the tip radius a station start or a link
 * path must keep from a known wall. Required whenever known_walls is given -
 * there is no default because the right margin is the wall's measurement
 * uncertainty, which only the agent that measured it knows. The cap keeps a
 * typo from refusing every station of a pocket narrower than 2 x 20 mm.
 */
export const WALL_MARGIN_MM: Range = { min: 0, max: 20 };
/** radial_tolerance_deg: how far off the radial a corner-arc approach may be before the page warns. Optional; no default (reported only). */
export const RADIAL_TOLERANCE_DEG: Range = { min: 0, max: 90 };
export const B_AXIS_DEG: Range = { min: -360, max: 360 };
/** Largest reach of stock and clamping about the rotary axis anyone should state (the A350 bed is 350 wide). */
export const MAX_SWEPT_RADIUS_MM = 200;
/**
 * rotary_axis_points (set_probe_geometry): two stations fix the axis line;
 * a few more tighten the fit. More than this is a pasted survey, not axis
 * points - the A350 rotary holds under 300 mm of stock, so eight stations
 * are already closer than the side-pair method can resolve.
 */
export const MAX_ROTARY_AXIS_POINTS = 8;

/**
 * probe_program `capture` op: how long to let the platform and rotary stop
 * ringing after the previous op before the frame is taken. rotate_b returns
 * on the M114 echo or an idle heartbeat, so the default is a short damping
 * wait, not a synchronisation. Not a clearance: nothing moves.
 */
export const CAPTURE_SETTLE_MS: Bounded = { default: 500, min: 0, max: 5000 };
/** A dwell in a probing program is capped so a mistyped P cannot park the job. */
export const MAX_DWELL_S = 60;
/** A stated bit protrusion above this is not a bit. */
export const MAX_BIT_LENGTH_MM = 300;

// ---------------------------------------------------------------------------
// Surface scans (surfaceScan.ts / probeSurface.ts)
// ---------------------------------------------------------------------------

/** expected_profile.circle: the cylinder's radius and the probe tip's. */
export const MAX_PROFILE_RADIUS_MM = 200;
export const MAX_TIP_RADIUS_MM = 15;
/** A path longer than the bed is a coordinate mistake. */
export const MAX_PATH_LENGTH_MM = 400;
export const MIN_PATH_LENGTH_MM = 1;
/** Station count is a time / event budget, not a safety line. */
export const MAX_GRID_LINES_PER_AXIS = 40;
export const MAX_GRID_STATIONS = 400;
/** A hop or a drop allowance under a millimetre plans a scan that cannot move. */
export const MIN_HOP_MM = 1;
export const MIN_DROP_MM = 1;
/** Coarse steps stop this far above the expected contact; the cap is the scan's own z_safe_delta. */
export const SURFACE_SLOW_ZONE_MM: { default: number; min: number } = { default: 1, min: 0.3 };

// ---------------------------------------------------------------------------
// probe_stock_outline
// ---------------------------------------------------------------------------

/**
 * Side marches are generous by default (25 mm): the on-box agent's first
 * outline lost a whole side to an 11 mm march when the estimate's centre was
 * 3.85 mm off - a short march silently turns estimate error into a missed
 * face, a generous one only costs time. Never less than what reaches the
 * estimate itself plus SIDE_TRAVEL_BEYOND_ESTIMATE_MM.
 */
export const SIDE_MAX_TRAVEL_MM: Range = { min: 5, max: MARCH_TRAVEL_MM.max };
export const SIDE_DEFAULT_TRAVEL_MM = 25;
export const SIDE_TRAVEL_BEYOND_ESTIMATE_MM = 10;
/** A side march must at least reach the estimated face with this to spare, or it cannot find it. */
export const SIDE_MIN_REACH_MARGIN_MM = 5;

// ---------------------------------------------------------------------------
// probe_wall_follow
// ---------------------------------------------------------------------------

/**
 * Distance along the wall between stations. Default 5: the operator's own
 * pocket passes went 1 mm in corners and 10 mm on straight walls, and the
 * result names where the wall curves so a second, denser pass can follow. The
 * cap is the surface scans' max_hop_mm (operator law 2026-09-05: the low
 * traverse between consecutive stations stays within 60 mm).
 */
export const WALL_FOLLOW_STEP_MM: Bounded = { default: 5, min: 0.5, max: 60 };
/** Stations per wall follow: a time / event budget like the grid's, not a safety line. */
export const WALL_FOLLOW_STATIONS: Bounded = { default: 5, min: 1, max: MAX_GRID_STATIONS };
/**
 * Back-off from the last contact before stepping along the wall (operator,
 * 2026-09-21: "back off ~2 mm"). Same range as HOP_LIFT_MM: it is the same
 * kind of number - the room a stepped traverse keeps from the surface.
 */
export const WALL_STANDOFF_MM: Bounded = { default: 2, min: HOP_LIFT_MM.min, max: HOP_LIFT_MM.max };

/**
 * probe_wall_follow line_tolerance_mm: the largest residual a contact may
 * have and still count as "on the wall" when the run is split into straight
 * runs and a corner (cornerFit.splitWallRun). Optional - without it the
 * result carries the fit and its residuals and nothing is classified. The
 * floor is the fine step at its smallest; above 5 mm nothing is a corner.
 */
export const WALL_LINE_TOLERANCE_MM: Range = { min: FINE_STEP_MM.min, max: 5 };

// ---------------------------------------------------------------------------
// probe_trace_perimeter (operator spec 2026-09-22)
// ---------------------------------------------------------------------------

/** The crawl's step along the wall and its bump toward it: the operator's 0.1 mm; a step under the smallest fine step is noise, above 1 mm is not a crawl. */
export const TRACE_FINE_STEP_MM: Bounded = { default: 0.1, min: 0.05, max: 1 };
/**
 * The step used only on a run already proven straight (the running line's
 * residuals under line_tolerance). Capped at the descent segment cap - a
 * coarse step is a plain sensor-checked move, and the operator's cap for a
 * move that expects no contact is DESCENT_SEGMENT_MM.max; the whole segment
 * is sensed.
 */
export const TRACE_COARSE_STEP_MM: Bounded = { default: 1, min: TRACE_FINE_STEP_MM.min, max: DESCENT_SEGMENT_MM.max };
/** How far the tangent turns per failed step / per fallen-away wall. 2 deg resolves a large radius; 45 is a corner in one turn. */
export const TRACE_TURN_STEP_DEG: Bounded = { default: 10, min: 2, max: 45 };
/** Fine steps toward the wall before it counts as fallen away (an outward curve): the operator's "a few". */
export const TRACE_BUMP_CAP_STEPS: Bounded = { default: 3, min: 1, max: 10 };
/** Contacts the straightness line is fitted over before a coarse step is allowed. */
export const TRACE_STRAIGHT_POINTS: Bounded = { default: 6, min: 3, max: 20 };
/** Accumulated turn since the last confirm cycle that counts as a major direction change (a quarter turn = an internal corner). */
export const TRACE_MAJOR_TURN_DEG: Bounded = { default: 45, min: 5, max: 180 };
/** Crawl steps per approval: a time / event budget, not a safety line (a 330 mm pocket at 0.1 is ~7000 steps). */
export const TRACE_MAX_STEPS: Bounded = { default: 20000, min: 10, max: 100000 };
/** max_perimeter_mm is REQUIRED (law 3); the A350 bed's own perimeter bounds it. */
export const TRACE_MAX_PERIMETER_MM: Range = { min: 1, max: 1400 };
/** accuracy_every_mm: how often an accuracy confirm cycle is inserted. */
export const TRACE_ACCURACY_EVERY_MM: Range = { min: 1, max: 1400 };

// ---------------------------------------------------------------------------
// probe_corner
// ---------------------------------------------------------------------------

/** Radial stations across the corner arc, tangent point to tangent point. Fewer than 3 cannot fit a circle. */
export const CORNER_POINTS: Bounded = { default: 5, min: 3, max: 16 };

// ---------------------------------------------------------------------------
// probe_circle
// ---------------------------------------------------------------------------

export const CIRCLE_POINTS: Bounded = { default: 8, min: 4, max: 16 };
export const CIRCLE_APPROACH_CLEARANCE_MM: Bounded = { default: 5, min: 1, max: 20 };
export const CIRCLE_PROBE_DEPTH_MM: Bounded = { default: 3, min: 0.5, max: 20 };
/** The operator's diameter bounds: a post or hole wider than this is not what this tool measures. */
export const MAX_CIRCLE_DIAMETER_MM = 100;
/** Outside mode needs room between the approach start radius and the min-diameter abort floor. */
export const MIN_RADIAL_APPROACH_MM = 1;
/** A fit residual above this means an out-of-round tip or feature, or a bad contact. */
export const CIRCLE_RESIDUAL_WARN_MM = 0.2;

// ---------------------------------------------------------------------------
// Tool setter
// ---------------------------------------------------------------------------

export const TOOL_SETTER_START_CLEARANCE_MM: Bounded = { default: 30, min: 10, max: 150 };
/** Coarse steps stop this far above the expected trigger and fine steps take over. */
export const TOOL_SETTER_SLOW_ZONE_MM: Bounded = { default: 1, min: FINE_STEP_MM.min, max: 10 };
/** start_from_current: how far off the setter centre the head may sit and still be "over" it. */
export const TOOL_SETTER_CENTRE_TOLERANCE_MM = 1.5;
/** Below the expected trigger the search may continue this far before it aborts as "no setter". */
export const TOOL_SETTER_FLOOR_MARGIN_MM: Bounded = { default: 3, min: 0.5, max: 20 };
/** An old/new tool length difference above this is not a pair of measurements of the same setup. */
export const MAX_TOOL_LENGTH_DELTA_MM = 50;

// ---------------------------------------------------------------------------
// Camera: survey_bed and camera_bootstrap
// ---------------------------------------------------------------------------

/** MAXIMUM grid spacing; each axis is divided evenly into steps no larger than it. */
export const SURVEY_PITCH_MM: Bounded = { default: 80, min: 20, max: 160 };
/** Inset of the default bounds from the toolhead travel. */
export const SURVEY_MARGIN_MM: Bounded = { default: 10, min: 0, max: 50 };
/** Each level is a full pass of the grid. */
export const MAX_SURVEY_LEVELS = 6;
export const MAX_OVERLAP_FRACTION = 0.9;
/** Links between waypoints run faster than a procedure's travel feed: nothing is expected to be in the way. */
export const SURVEY_LINK_FEED_FACTOR = 4;
/** The search stage's band either side of the tool setter, before the travel clips it. */
export const BOOTSTRAP_REACH_MM: Bounded = { default: 200, min: 40, max: 400 };
export const BOOTSTRAP_SEARCH_PITCH_MM: Bounded = { default: 40, min: 10, max: 120 };
export const BOOTSTRAP_Y_SPAN_MM: Bounded = { default: 0, min: 0, max: 300 };
export const MAX_BOOTSTRAP_POSES = 12;
/** Z step of the pose sweep's parallax baseline. */
export const BOOTSTRAP_SWEEP_STEP_MM = 2;

// ---------------------------------------------------------------------------
// Direct moves and job waits (tools/gcode.ts, tools/camera.ts)
// ---------------------------------------------------------------------------

export const MOVE_Z_FEED: Bounded = { default: 300, min: 50, max: 600 };
export const TRAVERSE_FEED: Bounded = { default: 1500, min: 50, max: 3000 };
export const DIRECT_MOVE_FEED: Bounded = { default: 1500, min: 100, max: 3000 };
/** move_z z_targets: one approval, this many steps at most. */
export const MAX_Z_TARGETS = 20;
/** The longest any tool call blocks waiting on an approval, a settle or an event. */
export const MAX_WAIT_MS = 120000;
export const EVENT_POLL_MS = 250;
export const STOP_WAIT_DEFAULT_MS = 20000;
/** "At the target": the controller's position echo against the commanded one. */
export const SETTLE_MATCH_MM = 0.15;

// ---------------------------------------------------------------------------
// G-code job intake (gcodeIntake.ts, tools/gcode.ts): how big a program the
// MCP will stage, however it arrives - inline text, a file in the jobs inbox,
// or a chunked upload (#237).
// ---------------------------------------------------------------------------

/**
 * The largest program submit_gcode_job / validate_gcode accept, in UTF-8
 * bytes, whatever the intake. 4 MiB is McpServer's request-body cap
 * (MAX_BODY_BYTES): the most an inline `gcode` argument could ever have
 * carried, so a file or an upload is never allowed to exceed what a single
 * call already could. It is NOT a controller limit - Luban's own file
 * transfer has none this low - it bounds what staging reads into memory to
 * validate, hash and render on the confirm page. The 2026-10-17 panel
 * (46 720 lines, 870 KB) is a fifth of it.
 */
export const MAX_GCODE_PROGRAM_BYTES = 4 * 1024 * 1024;
/**
 * One append_gcode_chunk's text, in UTF-8 bytes. Well under the body cap so
 * the JSON envelope around it never trips 413, and small enough that an
 * agent can emit a chunk as one tool argument reliably (the failure mode
 * the upload exists to avoid). 256 KiB = about 13 000 CAM lines.
 */
export const MAX_GCODE_UPLOAD_CHUNK_BYTES = 256 * 1024;
/**
 * An upload nobody has touched for this long is dropped, finished or not:
 * long enough for an agent to emit 4 MiB in 256 KiB chunks with a model
 * turn between each, short enough that an abandoned upload does not hold
 * its bytes in memory for the rest of the session.
 */
export const GCODE_UPLOAD_IDLE_EXPIRY_MS = 30 * 60 * 1000;
/** Uploads in flight at once; a single agent needs one, and each may hold MAX_GCODE_PROGRAM_BYTES. */
export const MAX_OPEN_GCODE_UPLOADS = 8;

// ---------------------------------------------------------------------------
// Feature tracking (track_feature)
// ---------------------------------------------------------------------------

/** Odd, so the patch has a centre pixel. */
export const TRACK_PATCH_PX: Bounded = { default: 41, min: 11, max: 101 };
export const TRACK_SEARCH_RADIUS_PX: Bounded = { default: 120, min: 20, max: 250 };
