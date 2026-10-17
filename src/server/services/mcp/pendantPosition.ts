import { AXES, judgeRecheck, nearMachine, PositionOfRecord, Xyz } from './positionOfRecord';
import type { PositionSnapshot } from './tools/machine';

/** Present the existing position tracker to the pendant; no second position cache. */
export function pendantPosition(p: PositionSnapshot, record: PositionOfRecord | null, trustedOffset: Xyz | null, now: number, staleMs: number) {
    const recheck = record?.source === 'echo' ? judgeRecheck([{ raw: p.work, offset: p.originOffset, reportTime: p.reportedAt }],
        record.machine, 0.02, record) : null;
    const ownEcho = record?.source === 'echo' && record.tool === 'usb_pendant'
        && now - record.at >= 0 && now - record.at <= staleMs
        && p.reportAgeMs >= 0 && p.reportAgeMs <= staleMs
        && p.reliability === 'verified' && p.originOffsetSource !== 'assumed-zero'
        && p.judged.rejectedReason !== 'no-offset-yet'
        && trustedOffset && nearMachine(p.originOffset, trustedOffset, 0.02)
        && nearMachine(p.machine, record.machine, 0.001)
        && (recheck?.verdict === 'pass' || (recheck?.verdict === 'undecided' && recheck.stale));
    // The engine already reconciles G53-window and lagging reports. A fresh,
    // verified pendant arrival can outrank one of those reports here too.
    // A report showing the tracker's previous position is also known to lag,
    // even when received after the echo. This is the existing recheck's stale
    // verdict, not permission to accept an arbitrary contradictory position.
    const warnings = ownEcho ? [] : p.warnings;
    const reliable = ['verified', 'heartbeat', 'cached-offset'].includes(p.reliability)
        && record?.source !== 'estimated' && warnings.length === 0;
    const work = reliable && p.originOffsetSource !== 'assumed-zero'
        ? Object.fromEntries(AXES.map((axis) => [axis,
            p.machine[axis] === null ? null : (p.machine[axis] as number) + p.originOffset[axis]])) : null;
    return { machine: p.machine,
        work,
        reliability: record?.source === 'estimated' ? 'estimated' : p.reliability,
        age_ms: p.reportAgeMs,
        position_age_ms: record?.source === 'echo' && (recheck?.verdict !== 'pass' || recheck.frame === 'record')
            ? Math.max(0, now - record.at) : p.reportAgeMs,
        stale_after_ms: staleMs,
        warnings,
        heartbeatWarnings: p.warnings,
        source: ownEcho ? 'pendant-controller-echo' : p.reliability };
}
