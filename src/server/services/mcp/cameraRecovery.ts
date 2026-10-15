import * as fs from 'fs-extra';
import path from 'path';
import { abortRaiseToTop } from './probing';

export function savePartialCameraIndex(directory: string, partial: object): void {
    try {
        fs.writeJsonSync(path.join(directory, 'index.json'), { ...partial, incomplete: true }, { spaces: 2 });
    } catch (error) {
        Object.assign(partial, { indexWriteError: String(error) });
    }
}

/** Preserve camera evidence and apply the same straight-up/HOLD recovery as probing. */
export async function cameraFailure(tool: string, cause: unknown, partial: object): Promise<never> {
    const error = (cause instanceof Error ? cause : new Error(String(cause))) as Error & { partial?: object };
    const phases: object[] = [];
    try {
        const retreat = await abortRaiseToTop(tool, (phase, z, note) => phases.push({ phase, z, note }), { holdIfTriggered: 'probe' });
        error.partial = { ...partial, retreat, recoveryPhases: phases };
        if (retreat.action === 'held') error.message += ` HOLD: ${retreat.note}`;
    } catch (recoveryError) {
        error.partial = { ...partial, recoveryPhases: phases, recoveryError: String(recoveryError) };
    }
    throw error;
}
