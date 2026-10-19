import { strict as assert } from 'assert';

import {
    BACKOFF_MM,
    CIRCLE_COARSE_STEP_MM,
    COARSE_STEP_MM,
    CONFIRM_PASSES,
    DESCENT_SEGMENT_MM,
    FINE_STEP_MM,
    GPIO_SENSOR_DELAY_MS,
    MARCH_SEGMENT_MM,
    RELEASE_TIMEOUT_MIN_MS,
    SENSOR_DELAY_MS,
    SURVEY_PITCH_MM,
    TOOL_SETTER_BACKOFF_MM,
    TOOL_SETTER_RELEASE_TIMEOUT_MIN_MS,
    TRACE_COARSE_STEP_MM,
    clampCount,
    clampReported,
    clampTo,
    marchSegments,
    releaseTimeoutFor,
    resolveMarchParams,
    within,
} from '../procedureLimits';

export const tests: Array<[string, () => void]> = [
    ['clampTo keeps the planners\' idiom: absent, non-numeric and zero all mean the default, then min/max', () => {
        assert.equal(clampTo(undefined, SURVEY_PITCH_MM), 80);
        assert.equal(clampTo('abc', SURVEY_PITCH_MM), 80);
        assert.equal(clampTo(0, SURVEY_PITCH_MM), 80);
        assert.equal(clampTo(5, SURVEY_PITCH_MM), 20);
        assert.equal(clampTo(1000, SURVEY_PITCH_MM), 160);
        assert.equal(clampTo('40', SURVEY_PITCH_MM), 40);
    }],

    ['clampCount rounds before it clamps', () => {
        assert.equal(clampCount(2.6, CONFIRM_PASSES), 3);
        assert.equal(clampCount(99, CONFIRM_PASSES), 10);
        assert.equal(clampCount(undefined, CONFIRM_PASSES), 3);
    }],

    ['within is a refusal-style check, inclusive at both ends and false for NaN', () => {
        assert.equal(within(1, { min: 1, max: 150 }), true);
        assert.equal(within(150, { min: 1, max: 150 }), true);
        assert.equal(within(150.001, { min: 1, max: 150 }), false);
        assert.equal(within(Number.NaN, { min: 1, max: 150 }), false);
    }],

    ['issue #166: the descent segment is a named bound - default and cap 5, floor the march segment - and a clip is reported', () => {
        assert.deepEqual(DESCENT_SEGMENT_MM, { default: 5, min: MARCH_SEGMENT_MM, max: 5 });
        assert.equal(TRACE_COARSE_STEP_MM.max, DESCENT_SEGMENT_MM.max, 'the trace coarse step shares the cap');
        assert.deepEqual(clampReported(undefined, DESCENT_SEGMENT_MM), { value: 5, requested: null, clipped: false });
        assert.deepEqual(clampReported(2, DESCENT_SEGMENT_MM), { value: 2, requested: 2, clipped: false });
        assert.deepEqual(clampReported(10, DESCENT_SEGMENT_MM), { value: 5, requested: 10, clipped: true }, 'the cap never rises');
        assert.deepEqual(clampReported(0.5, DESCENT_SEGMENT_MM), { value: 1, requested: 0.5, clipped: true });
        // A 124 mm descent from home to 20 mm above a 184 top: 25 segments at the default, 124 at 1 mm.
        assert.equal(marchSegments(328, 204, DESCENT_SEGMENT_MM.default).length, 25);
        assert.equal(marchSegments(328, 204, DESCENT_SEGMENT_MM.min).length, 124);
    }],

    ['the shared march defaults are the ones every planner had inline', () => {
        assert.deepEqual(resolveMarchParams({}), {
            coarseStepMm: 1,
            fineStepMm: 0.1,
            backoffMm: 1,
            sensorDelayMs: 300,
            confirmPasses: 3,
        });
    }],

    ['the shared coarse cap is 1 mm; probe_circle keeps its own 0.5 default and 2 mm cap - a logical advance, segmented when executed', () => {
        assert.equal(resolveMarchParams({ coarse_step_mm: 2 }).coarseStepMm, 1);
        assert.equal(resolveMarchParams({ coarse_step_mm: 2 }, { coarse: CIRCLE_COARSE_STEP_MM }).coarseStepMm, 2);
        assert.equal(resolveMarchParams({ coarse_step_mm: 5 }, { coarse: CIRCLE_COARSE_STEP_MM }).coarseStepMm, 2);
        assert.equal(COARSE_STEP_MM.max, 1);
        assert.equal(resolveMarchParams({}, { coarse: CIRCLE_COARSE_STEP_MM }).coarseStepMm, 0.5, 'the circle keeps its own default');
    }],

    ['the backoff never drops below the fine step actually in use', () => {
        // fine asked at 0.4: the backoff floor follows it, whatever was asked.
        assert.equal(resolveMarchParams({ fine_step_mm: 0.4, backoff_mm: 0.1 }).backoffMm, 0.4);
        // fine asked at 5 is clamped to 0.5, and the backoff floors at the CLAMPED value.
        assert.equal(resolveMarchParams({ fine_step_mm: 5, backoff_mm: 0.1 }).backoffMm, FINE_STEP_MM.max);
        assert.equal(resolveMarchParams({ backoff_mm: 10 }).backoffMm, BACKOFF_MM.max);
        assert.equal(resolveMarchParams({}, { backoff: TOOL_SETTER_BACKOFF_MM }).backoffMm, 0.3);
    }],

    ['a planner\'s stated variation applies to that one parameter only', () => {
        const gpio = resolveMarchParams({ sensor_delay_ms: 30 }, { delay: GPIO_SENSOR_DELAY_MS });
        assert.equal(gpio.sensorDelayMs, 30, 'the GPIO transport may run at its 30 ms floor');
        assert.equal(resolveMarchParams({ sensor_delay_ms: 30 }).sensorDelayMs, SENSOR_DELAY_MS.min, 'the others keep the 100 ms floor');
        assert.equal(gpio.coarseStepMm, 1, 'everything else stays shared');
    }],

    ['the release timeout is four sensor delays, never shorter than the observed latency floor', () => {
        assert.equal(releaseTimeoutFor(300), RELEASE_TIMEOUT_MIN_MS);
        assert.equal(releaseTimeoutFor(2000), 8000);
        assert.equal(releaseTimeoutFor(200, TOOL_SETTER_RELEASE_TIMEOUT_MIN_MS), TOOL_SETTER_RELEASE_TIMEOUT_MIN_MS);
    }],

    ['a coarse step is a logical advance: the physical moves that make it up are <= MARCH_SEGMENT_MM, evenly divided, end included', () => {
        assert.equal(MARCH_SEGMENT_MM, 1);
        // probe_circle's 2 mm radial step from s=0.
        assert.deepEqual(marchSegments(0, 2), [1, 2]);
        // 2.5 mm is three even segments, not two and a stub.
        assert.deepEqual(marchSegments(0, 2.5), [0.833333, 1.666667, 2.5]);
        // A fine step is already below the segment and goes as one move.
        assert.deepEqual(marchSegments(3, 3.1), [3.1]);
        // Direction follows the sign: a tool-setter descent in Z.
        assert.deepEqual(marchSegments(250, 248), [249, 248]);
        // Nothing to cover, nothing sent.
        assert.deepEqual(marchSegments(5, 5), []);
        // The end is exact, never a float-noise short of the target.
        assert.equal(marchSegments(0.1, 1.1)[0], 1.1);
    }],
];
