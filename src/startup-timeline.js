/*
 * Startup timing marks, shared by the Electron main process, the forked server
 * child and the renderer.
 *
 * All three read the same epoch from LUBAN_START_T0 -- main sets it, the fork
 * inherits it, and the renderer sees it through nodeIntegration -- so marks
 * from every process land on one timeline and interleave in the log.
 *
 * No dependencies and no I/O until something asks for the table.
 */

const ENV_KEY = 'LUBAN_START_T0';

const readEpoch = () => {
    try {
        // In the renderer, webpack replaces bare `process` with a shim whose env
        // holds only what DefinePlugin injected. `window.process` is the real
        // Node process and is left alone, so read that first.
        if (typeof window !== 'undefined' && window.process && window.process.env) {
            return Number(window.process.env[ENV_KEY]);
        }
        return process && process.env && Number(process.env[ENV_KEY]);
    } catch (err) {
        return 0;
    }
};

// Set by whichever process starts first; main writes it back to the environment
// so children and the renderer share it.
const epoch = readEpoch() || Date.now();

const marks = [];

const elapsed = () => Date.now() - epoch;

/** Record a named point in startup. Returns ms since the shared epoch. */
const mark = (name) => {
    const at = elapsed();
    marks.push({ name, at });
    return at;
};

/** Record a point that already happened, given its absolute epoch time. */
const markAt = (name, absoluteMs) => {
    const at = Math.round(absoluteMs - epoch);
    marks.push({ name, at });
    marks.sort((a, b) => a.at - b.at);
    return at;
};

/** Render the marks recorded in this process as one ordered table. */
const formatTimeline = (title) => {
    const lines = [`${title} (ms since process start)`];
    let previous = 0;
    for (const entry of marks) {
        const step = entry.at - previous;
        lines.push(`  ${String(entry.at).padStart(7)}  +${String(step).padStart(6)}  ${entry.name}`);
        previous = entry.at;
    }
    return lines.join('\n');
};

export {
    ENV_KEY,
    epoch,
    elapsed,
    mark,
    markAt,
    marks,
    formatTimeline,
};
