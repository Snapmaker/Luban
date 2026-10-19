/* eslint-disable camelcase */
// link_mode / top_z_machine are MCP tool arguments (snake_case by convention).
//
// Pure rules for the LINKS of a CAM probing program (run_probing_gcode): which
// behaviour a G0/G1 link between stations gets, which station it is heading
// for, what a contact on the way there means, and how it is recorded. No
// server imports - unit-tested in tests/camLinks.test.ts.
//
// Issue #167 (job f84f2a263333, 2026-09-21): stepped links inside a pocket
// retreated +Z on a wall touch (right over a top, wrong in a pocket), climbed
// onto the rim, and the descent at the destination met the top face and
// raised a CRASH alarm with the tip held on the wood. The rules here make a
// wall touch DATA (a `link_contact` entry), the station it was heading for a
// BLOCKED station (a normal outcome), and a descent contact at a link
// destination a blocked station too - never a crash.

import { POSITION_EPSILON_MM } from './envelopeChecks';
import { CamStep, Xyz } from './probeGcode';

export type LinkMode = 'raise' | 'stepped' | 'wall';
export const LINK_MODES: LinkMode[] = ['raise', 'stepped', 'wall'];

/**
 * How one XY link behaves:
 *  - 'raise': law 2 - XY at the traverse height, guarded segmented descent;
 *  - 'top': a stepped touch-probing traverse at the programmed height whose
 *    retreat is +Z (a lateral contact = the surface is higher here: a step up
 *    on a TOP surface), retrying the step after each lift;
 *  - 'wall': a stepped traverse whose retreat is the REVERSE travel vector
 *    (a lateral contact = a WALL; the path just travelled is the only proven
 *    clear direction), ending the link as BLOCKED on the first contact.
 */
export type LinkStyle = 'raise' | 'top' | 'wall';

/**
 * A G38.2/G38.3 whose direction is more horizontal than this |z| component is
 * a SIDE march (a wall station); above it a top-surface march. 0.5 = 30
 * degrees off the horizontal: every side march posted so far is exactly
 * horizontal (|z| = 0) and every top march exactly vertical (|z| = 1), so the
 * threshold only has to separate those two families with margin for a
 * tilted station on a rotated part.
 */
export const SIDE_MARCH_MAX_Z_COMPONENT = 0.5;

export interface CamLink {
    /** Index into the parsed step list of the move this link is. */
    stepIndex: number;
    style: LinkStyle;
    /** The probe cycle this link is heading for (the next probe in program order before any rotation), or null. */
    station: { stepIndex: number; probeIndex: number; id: string; name: string | null; line: number } | null;
    /** Why this style was chosen, for the confirm page. */
    reason: string;
}

function unitOf(from: Xyz, to: Xyz): Xyz {
    const d = { x: to.x - from.x, y: to.y - from.y, z: to.z - from.z };
    const len = Math.hypot(d.x, d.y, d.z) || 1;
    return { x: d.x / len, y: d.y / len, z: d.z / len };
}

/** Is this probe cycle a side march (a wall station)? */
export function isSideMarch(step: CamStep): boolean {
    if (step.kind !== 'probe') {
        return false;
    }
    const u = unitOf(step.from, step.target);
    return Math.abs(u.z) < SIDE_MARCH_MAX_Z_COMPONENT;
}

/** The next probe cycle after `fromIndex` in program order, stopping at a rotation (a new 3+2 station). */
export function destinationStation(steps: CamStep[], fromIndex: number): CamLink['station'] {
    for (let i = fromIndex + 1; i < steps.length; i++) {
        const s = steps[i];
        if (s.kind === 'rotate') {
            return null;
        }
        if (s.kind === 'probe') {
            return { stepIndex: i, probeIndex: s.index, id: s.meta.id || String(s.index), name: s.meta.name || null, line: s.line };
        }
    }
    return null;
}

/** Does this move step change X or Y (a link), as opposed to a pure Z move? */
export function isXyLink(step: CamStep): step is Extract<CamStep, { kind: 'move' }> {
    return step.kind === 'move' && (step.from.x !== step.target.x || step.from.y !== step.target.y);
}

/**
 * Classify every XY link of the program. `link_mode: "raise"` keeps every
 * link at the traverse height; `"wall"` makes every stepped link wall-aware;
 * `"stepped"` picks per link: wall-aware when the station it is heading for
 * is a side march, +Z (top) otherwise - a program that marches the walls of
 * a pocket gets the pocket behaviour without saying so.
 */
export function classifyCamLinks(steps: CamStep[], linkMode: LinkMode): CamLink[] {
    const out: CamLink[] = [];
    steps.forEach((step, index) => {
        if (!isXyLink(step)) {
            return;
        }
        const station = destinationStation(steps, index);
        if (linkMode === 'raise') {
            out.push({ stepIndex: index, style: 'raise', station, reason: 'link_mode raise' });
            return;
        }
        if (linkMode === 'wall') {
            out.push({ stepIndex: index, style: 'wall', station, reason: 'link_mode wall' });
            return;
        }
        const target = station ? steps[station.stepIndex] : null;
        if (target && isSideMarch(target)) {
            out.push({ stepIndex: index, style: 'wall', station, reason: `station "${station!.name || station!.id}" is a side march` });
        } else {
            out.push({ stepIndex: index, style: 'top', station, reason: station ? `station "${station.name || station.id}" is a top march` : 'no station follows' });
        }
    });
    return out;
}

/** Look up the link classification of a step, if it is one. */
export function linkAt(links: CamLink[], stepIndex: number): CamLink | null {
    return links.find((l) => l.stepIndex === stepIndex) || null;
}

/**
 * When a link is BLOCKED, the steps from the link to its destination station
 * (inclusive) are skipped: intervening moves are part of the approach to a
 * station nothing has proven reachable, and the probe itself records
 * `blocked`. Notes are still announced, so they are not listed here. With no
 * station (a rotation or the end follows) nothing is skipped.
 */
export function blockedStationSpan(steps: CamStep[], linkIndex: number): { stationIndex: number | null; skip: number[] } {
    const station = destinationStation(steps, linkIndex);
    if (!station) {
        return { stationIndex: null, skip: [] };
    }
    const skip: number[] = [];
    for (let i = linkIndex + 1; i < station.stepIndex; i++) {
        const k = steps[i].kind;
        if (k === 'move' || k === 'dwell') {
            skip.push(i);
        }
    }
    return { stationIndex: station.stepIndex, skip };
}

/**
 * What a contact during a link's guarded descent means. Stepped links (top
 * or wall) always make it a BLOCKED station: the descent is 1 mm sensor-
 * checked steps and the station is inside a surface the program is feeling
 * its way around. A raise-mode link descends from the traverse height into
 * space the program declares empty, so a contact there is a collision -
 * unless the operator stated the top and the contact is AT it (within one
 * guarded step below and the heartbeat's noise above), which is the pass-2
 * signature: a station placed over the rim.
 */
export function judgeLinkDescentContact(style: LinkStyle, topZMachine: number | null, contactZ: number, guardStepMm: number = 1): 'abort' | 'block' {
    if (style === 'top' || style === 'wall') {
        return 'block';
    }
    if (topZMachine !== null && contactZ <= topZMachine + POSITION_EPSILON_MM && contactZ >= topZMachine - guardStepMm - POSITION_EPSILON_MM) {
        return 'block';
    }
    return 'abort';
}

/** Can judgeLinkDescentContact answer 'block' for this link at all (decides whether the descent senses serially)? */
export function linkDescentMayBlock(style: LinkStyle, topZMachine: number | null): boolean {
    return style === 'top' || style === 'wall' || topZMachine !== null;
}

/**
 * The +Z retreat cap of a top-style stepped link: to the traverse height, or
 * - when the operator stated the top - no higher than the top, so a lift that
 * would leave the pocket ends the link as blocked instead (issue #167's
 * "would leave the pocket" guard). Never negative.
 */
export function topLinkLiftCap(linkZ: number, hopZ: number, topZMachine: number | null): { maxLiftTotalMm: number; onMax: 'plain-move' | 'block' } {
    if (topZMachine === null) {
        return { maxLiftTotalMm: Math.max(0, Number((hopZ - linkZ).toFixed(3))), onMax: 'plain-move' };
    }
    return { maxLiftTotalMm: Math.max(0, Number((Math.min(hopZ, topZMachine) - linkZ).toFixed(3))), onMax: 'block' };
}

/** A touch made by a LINK (not a probe cycle), recorded as data on the inspection report. */
export interface LinkContactRecord {
    /** Program line of the link move. */
    line: number;
    /** wall: lateral contact, retreat along the reverse travel vector; top: lateral contact, +Z lift; descent: contact on the way down at the destination. */
    kind: 'wall' | 'top' | 'descent';
    /** What followed: the station was skipped (blocked), or the link lifted and went on (lifted). */
    outcome: 'blocked' | 'lifted';
    contactMachine: Xyz;
    contactWork: Xyz;
    /** Unit travel vector at the contact (a descent: 0, 0, -1). The wall's outward normal is roughly its negative. */
    direction: Xyz;
    retreat: { unit: Xyz; mm: number };
    towardStation: { probeIndex: number; id: string; name: string | null; line: number } | null;
    bDeg: number | null;
}

/** Text for the confirm page describing what a link of this style does on contact. */
export function describeLinkStyle(style: LinkStyle, hopLiftMm: number, hopZ: number, topZMachine: number | null): string {
    if (style === 'raise') {
        return `XY at the traverse height Z${hopZ}, guarded segmented descent`;
    }
    if (style === 'wall') {
        return 'stepped WALL link at the programmed height (1 mm steps F300, probe expected): a contact is a wall - back off 1 mm, '
            + `retreat ${hopLiftMm} mm further along the path just travelled (never +Z), record it as link_contact, mark the station BLOCKED, continue`;
    }
    return `stepped touch-probing traverse at the programmed height (1 mm steps F300, probe expected): a contact lifts ${hopLiftMm} mm (+Z) and retries`
        + `${topZMachine === null ? `, up to Z${hopZ}` : `, never above the stated top Z${topZMachine} - a lift that would pass it marks the station BLOCKED instead`}`;
}
