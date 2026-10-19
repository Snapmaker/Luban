// Where a probe_program `capture` op puts its frame. The in-memory frame
// cache keeps the last 12 captures; a program can take more than that
// before anyone looks, so every program frame is also written here and the
// op result names the file - get_frame {file} reads it back (from this
// directory only).
import fs from 'fs';
import path from 'path';

import DataStorage from '../../DataStorage';

export function programFrameRoot(): string {
    return path.join(DataStorage.userDataDir, 'mcp-program-frames');
}

/** `<root>/<yyyymmdd-hhmmss>_<program>/<opId>.jpg`, directory created; the name is scrubbed to [A-Za-z0-9_-]. */
export function programFramePath(startedAt: number, programName: string, opId: string): string {
    const stamp = new Date(startedAt).toISOString()
        .replace(/[-:]/g, '')
        .replace(/\.\d+Z$/, '')
        .replace('T', '-');
    const safeName = programName.replace(/[^A-Za-z0-9_-]+/g, '_').slice(0, 40) || 'program';
    const dir = path.join(programFrameRoot(), `${stamp}_${safeName}`);
    fs.mkdirSync(dir, { recursive: true });
    return path.join(dir, `${opId.replace(/[^A-Za-z0-9_-]+/g, '_')}.jpg`);
}
