// A nested probe runner's HOLD is sticky for the remainder of the program.
// It must not be turned into an unconditional outer raise or on_fail:skip.
export function probeAbortHeld(partial: unknown): boolean {
    if (!partial || typeof partial !== 'object') { return false; }
    if ((partial as { holdPosition?: boolean }).holdPosition === true) { return true; }
    const phases = (partial as { phases?: { phase?: string }[] }).phases;
    return Array.isArray(phases) && phases.some((p) => p.phase === 'abort-held');
}

export async function finishProgramAbort(
    held: boolean,
    tripped: boolean,
    raise: () => Promise<{ action: string; note: string }>
): Promise<string> {
    if (tripped) { return 'A safety alarm is latched - no recovery motion issued.'; }
    if (held) { return 'Probe recovery held position; no outer raise issued.'; }
    try {
        const outcome = await raise();
        return outcome.action === 'raised' || outcome.action === 'skipped'
            ? 'Machine at the traverse height.' : `Machine recovery: ${outcome.note}.`;
    } catch (err) {
        return `Recovery raise not verified: ${(err as Error).message}`;
    }
}
