// Which of the attached cameras is THE camera, resolved from a string a
// caller typed or copied.
//
// Two cameras have been on the Ubuntu box since the second one appeared, and
// the whole hazard of this module is that both of them return perfectly good
// frames. A picture from the wrong camera is not an error anywhere: it is a
// frame, it decodes, it template-matches, and every millimetre measured
// through it is wrong. So selection resolves strictly - an exact name, or a
// substring that matches exactly ONE camera - and refuses anything ambiguous
// instead of picking the first.
//
// Pure: no server imports, unit-tested in tests/cameraSelection.test.ts.

/** One attachable camera and every string that unambiguously names it. */
export interface CameraCandidate {
    /**
     * The device string as `list_cameras` reports it and as it is stored:
     * a DirectShow friendly name on Windows, `"<path> (<Name>)"` on v4l2, or
     * a snapshot URL. This is what a match resolves TO.
     */
    entry: string;
    /**
     * Other strings that name the same camera - the `/dev/v4l/by-id/...`
     * symlink, the `/dev/videoN` it resolves to, the friendly name on its
     * own. Matching an alias is as good as matching the entry.
     */
    aliases: string[];
}

export type CameraMatch = {
    ok: true;
    /** The candidate entry the query resolved to. */
    entry: string;
    /** How it resolved, for a caller that wants to say so out loud. */
    matchedOn: 'entry' | 'alias' | 'substring';
    reason: null;
} | {
    ok: false;
    entry: null;
    matchedOn: null;
    /** Why it did not resolve - named cameras included, so the next try can be right. */
    reason: string;
};

function resolved(entry: string, matchedOn: 'entry' | 'alias' | 'substring'): CameraMatch {
    return { ok: true, entry, matchedOn, reason: null };
}

function unresolved(reason: string): CameraMatch {
    return { ok: false, entry: null, matchedOn: null, reason };
}

export function isSnapshotUrl(query: string): boolean {
    return /^https?:\/\//i.test(query.trim());
}

function names(candidate: CameraCandidate): string[] {
    return [candidate.entry, ...candidate.aliases].filter(Boolean);
}

function listFor(candidates: CameraCandidate[]): string {
    return candidates.length ? candidates.map((c) => `"${c.entry}"`).join(', ') : '(none attached)';
}

/**
 * Resolve `query` to exactly one candidate's entry.
 *
 * Exact match (the entry or any alias) wins; failing that a case-insensitive
 * substring is accepted ONLY when one camera matches. Two matches is a
 * refusal, not a coin toss - the caller is asking for a specific camera and
 * has not yet said which.
 */
export function matchCameraDevice(query: string, candidates: CameraCandidate[]): CameraMatch {
    const q = String(query || '').trim();
    if (!q) {
        return unresolved(`device must name a camera. Attached: ${listFor(candidates)}.`);
    }
    // A bare number is the one thing that must never be accepted: /dev/videoN
    // numbering shuffles whenever a camera is plugged or unplugged (the
    // toolhead camera moved video0 -> video2 when the second camera arrived),
    // and enumeration order is no more stable than the numbering.
    if (/^\d+$/.test(q)) {
        return unresolved(`"${q}" is an index or a bare number, and neither device numbering nor enumeration `
            + `order survives a replug. Name the camera: ${listFor(candidates)}.`);
    }

    const exact = candidates.filter((c) => names(c).some((name) => name === q));
    if (exact.length === 1) {
        return resolved(exact[0].entry, exact[0].entry === q ? 'entry' : 'alias');
    }
    const lower = q.toLowerCase();
    const insensitive = candidates.filter((c) => names(c).some((name) => name.toLowerCase() === lower));
    if (insensitive.length === 1) {
        return resolved(insensitive[0].entry, insensitive[0].entry.toLowerCase() === lower ? 'entry' : 'alias');
    }
    if (insensitive.length > 1) {
        return unresolved(`"${q}" names ${insensitive.length} cameras (${listFor(insensitive)}). Pass the full device string.`);
    }

    const partial = candidates.filter((c) => names(c).some((name) => name.toLowerCase().includes(lower)));
    if (partial.length === 1) {
        return resolved(partial[0].entry, 'substring');
    }
    if (partial.length > 1) {
        return unresolved(`"${q}" matches ${partial.length} cameras (${listFor(partial)}). Pass the full device `
            + 'string so the choice is not left to matching order.');
    }
    return unresolved(`No attached camera matches "${q}". Attached: ${listFor(candidates)}. `
        + 'Run list_cameras (or preview_cameras, which shows what each one sees) and pass an entry from it.');
}

/**
 * What changing the selection means for the solved camera model. A different
 * camera has a different geometry entirely, so its model cannot survive the
 * swap; the same camera re-pinned by a different name is not a change at all.
 */
export function selectionInvalidatesModel(previous: string | null, next: string): boolean {
    return !!previous && previous !== next;
}

/**
 * Why a capture from `device` failed, in words that name the cure.
 *
 * Live 2026-09-20: the box was pinned to a Sonix camera that had since been
 * swapped for two others, and every capture died with ffmpeg's own "No such
 * file or directory". True, and useless: it does not say which cameras ARE
 * attached, and it reads like a broken camera rather than a stale choice.
 * A pinned device is deliberately not checked against the device list on the
 * happy path - enumeration costs an ffmpeg spawn on Windows - so this runs
 * only once a capture has already failed.
 *
 * `attached` empty means enumeration itself failed or found nothing; that is
 * not evidence the camera vanished, so the plain failure stands.
 */
export function describeCaptureFailure(device: string, attached: string[], ffmpegTail: string): string {
    const detail = ffmpegTail ? ` (ffmpeg: ${ffmpegTail})` : '';
    if (attached.length && !attached.includes(device)) {
        return `The selected camera "${device}" is not attached any more. Attached now: ${listFor(attached.map((entry) => ({ entry, aliases: [] })))}. `
            + 'Run preview_cameras to see what each one is looking at, then select_camera to choose one - '
            + `refusing to silently substitute a different camera.${detail}`;
    }
    return `ffmpeg capture from "${device}" failed after retry:${detail || ' no output from ffmpeg.'}`;
}
