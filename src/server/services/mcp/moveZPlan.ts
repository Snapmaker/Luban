/* eslint-disable camelcase */
// MCP tool arguments are snake_case by convention (move_z's are taken verbatim).
//
// The target list of a `move_z` job: one Z or an ordered series, each step
// with its own feed, every feed clamped to MOVE_Z_FEED and every clip
// REPORTED (issue #240, 2026-10-17: the operator asked for "F400 to 10 mm
// above the copper, then F60 for the last 10 mm" under ONE approval; the tool
// took one feed for the whole series, and the hand-written file was refused
// as pure transport - so there was no sanctioned path to the standard
// fast-then-creep approach).
//
// Pure: no server imports (unit-tested under ts-node). tools/gcode.ts turns
// the steps into one `G1 Z.. F..` per step and the confirm-page header.

import { ClampReport, MAX_Z_TARGETS, MOVE_Z_FEED, clampReported } from './procedureLimits';

export class MoveZPlanError extends Error {}

export interface ZStep {
    /** Absolute target Z in the caller's frame. */
    z: number;
    /** The feed this step runs at: the step's own feed_rate, else the call's, else the default - clamped. */
    feedRate: number;
    /** What the caller typed for THIS step (null when the step inherits the call's feed). */
    requestedFeedRate: number | null;
}

export interface FeedClamp {
    /** 1-based step number, or 0 for the call-level feed_rate. */
    step: number;
    requested: number;
    applied: number;
}

export interface ZTargetsPlan {
    steps: ZStep[];
    /** The call-level feed_rate after clamping; what a step without its own feed runs at. */
    defaultFeed: number;
    /** Every feed that was clipped into MOVE_Z_FEED, for the result and the page. Empty when nothing was. */
    clamps: FeedClamp[];
}

/** `{z, feed_rate?}` or a plain number - both accepted in z_targets. */
export type ZTargetInput = number | { z: unknown; feed_rate?: unknown };

function clampDescribed(step: number, raw: unknown, clamps: FeedClamp[]): ClampReport {
    const report = clampReported(raw, MOVE_Z_FEED);
    if (report.clipped && report.requested !== null) {
        clamps.push({ step, requested: report.requested, applied: report.value });
    }
    return report;
}

/**
 * Resolve `z` / `z_targets` / `feed_rate` into the steps the job will run.
 * Throws MoveZPlanError with the operator-facing text; the caller wraps it.
 */
export function resolveZTargets(args: { z?: unknown; z_targets?: unknown; feed_rate?: unknown }): ZTargetsPlan {
    if ((args.z === undefined) === (args.z_targets === undefined)) {
        throw new MoveZPlanError('Provide exactly one of z or z_targets.');
    }
    const clamps: FeedClamp[] = [];
    const defaultFeed = clampDescribed(0, args.feed_rate, clamps).value;
    let rawTargets: unknown[] = [args.z];
    if (args.z_targets !== undefined) {
        rawTargets = Array.isArray(args.z_targets) ? args.z_targets : [args.z_targets];
    }
    if (!rawTargets.length || rawTargets.length > MAX_Z_TARGETS) {
        throw new MoveZPlanError(`Targets must be 1-${MAX_Z_TARGETS} entries, each a finite Z or {z, feed_rate?}.`);
    }
    const steps: ZStep[] = rawTargets.map((raw, index) => {
        const where = `z_targets[${index}]`;
        if (raw !== null && typeof raw === 'object') {
            const entry = raw as { z?: unknown; feed_rate?: unknown };
            const unknown = Object.keys(entry).filter((k) => k !== 'z' && k !== 'feed_rate');
            if (unknown.length) {
                throw new MoveZPlanError(`${where}: unknown key(s) ${unknown.join(', ')} - a step is a number or {z, feed_rate?}.`);
            }
            const z = Number(entry.z);
            if (entry.z === undefined || entry.z === null || !Number.isFinite(z)) {
                throw new MoveZPlanError(`${where}: z must be a finite absolute Z.`);
            }
            if (entry.feed_rate === undefined || entry.feed_rate === null) {
                return { z, feedRate: defaultFeed, requestedFeedRate: null };
            }
            const typed = Number(entry.feed_rate);
            if (!Number.isFinite(typed) || typed <= 0) {
                throw new MoveZPlanError(`${where}: feed_rate must be a positive mm/min (${MOVE_Z_FEED.min}-${MOVE_Z_FEED.max}); omit it to use the call's feed_rate.`);
            }
            return { z, feedRate: clampDescribed(index + 1, typed, clamps).value, requestedFeedRate: typed };
        }
        const z = Number(raw);
        if (raw === null || raw === '' || typeof raw === 'boolean' || !Number.isFinite(z)) {
            throw new MoveZPlanError(`${where}: must be a finite Z or {z, feed_rate?}.`);
        }
        return { z, feedRate: defaultFeed, requestedFeedRate: null };
    });
    return { steps, defaultFeed, clamps };
}

/** One line per clip for the confirm-page header and the result note; empty when nothing was clipped. */
export function describeFeedClamps(clamps: FeedClamp[]): string[] {
    return clamps.map((c) => `${c.step === 0 ? 'feed_rate' : `step ${c.step} feed_rate`} ${c.requested} is outside `
        + `${MOVE_Z_FEED.min}-${MOVE_Z_FEED.max} mm/min (MOVE_Z_FEED) - clamped to F${c.applied}`);
}
