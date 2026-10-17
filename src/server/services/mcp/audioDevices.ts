// Enumerate the host's audio capture sources (server-bound: spawns the
// audio stack's own listing tools) for the operator to choose from. The
// parsing and the matching are pure (audioSelection.ts); this module only
// runs the commands and merges what they return.
//
// Linux (snapcnclaptop): `pw-dump` when PipeWire is running, `pactl list
// short sources` when a PulseAudio client exists, and `arecord -l` for the
// raw ALSA cards - a card shows up twice (as a pulse node and as hw:CARD=),
// which is right: they are two different ways to open it, and the pulse one
// is the one to prefer while PipeWire owns the hardware. Windows (dev box):
// ffmpeg's DirectShow listing.

import { execFile } from 'child_process';

import logger from '../../lib/logger';
import config from '../configstore';
import {
    AudioSource,
    parseArecordList,
    parseDshowDevices,
    parsePactlSources,
    parsePipewireDump,
} from './audioSelection';

const log = logger('service:mcp:audio-devices');
const LIST_TIMEOUT_MS = 5000;

export interface AudioSourceListing {
    sources: AudioSource[];
    /** Which listing commands answered (so an empty list can be explained). */
    backends: Array<{ command: string; ok: boolean; count: number; error?: string }>;
}

async function run(command: string, args: string[]): Promise<{ ok: boolean; stdout: string; stderr: string; error?: string }> {
    return new Promise((resolve) => {
        execFile(command, args, { timeout: LIST_TIMEOUT_MS, windowsHide: true, maxBuffer: 16 * 1024 * 1024 }, (err, stdout, stderr) => {
            if (err && !stdout && !stderr) {
                resolve({ ok: false, stdout: '', stderr: '', error: (err as Error).message });
                return;
            }
            resolve({ ok: true, stdout: String(stdout || ''), stderr: String(stderr || '') });
        });
    });
}

export function ffmpegBinary(): string {
    return String(config.get('mcpFfmpegPath') || 'ffmpeg');
}

export async function listAudioSources(): Promise<AudioSourceListing> {
    const backends: AudioSourceListing['backends'] = [];
    const sources: AudioSource[] = [];
    const seen = new Set<string>();
    const add = (command: string, result: { ok: boolean; error?: string }, parsed: AudioSource[]) => {
        backends.push({ command, ok: result.ok, count: parsed.length, error: result.error });
        for (const item of parsed) {
            if (!seen.has(item.entry)) {
                seen.add(item.entry);
                sources.push(item);
            }
        }
    };

    if (process.platform === 'win32') {
        const result = await run(ffmpegBinary(), ['-hide_banner', '-list_devices', 'true', '-f', 'dshow', '-i', 'dummy']);
        add('ffmpeg -list_devices true -f dshow', result, result.ok ? parseDshowDevices(`${result.stderr}\n${result.stdout}`) : []);
        return { sources, backends };
    }

    const pw = await run('pw-dump', []);
    let pwSources: AudioSource[] = [];
    if (pw.ok) {
        try {
            pwSources = parsePipewireDump(JSON.parse(pw.stdout));
        } catch (err) {
            pw.error = `pw-dump output was not JSON: ${(err as Error).message}`;
            pw.ok = false;
        }
    }
    add('pw-dump', pw, pwSources);
    if (!pwSources.length) {
        const pactl = await run('pactl', ['list', 'short', 'sources']);
        add('pactl list short sources', pactl, pactl.ok ? parsePactlSources(pactl.stdout) : []);
    }
    const arecord = await run('arecord', ['-l']);
    add('arecord -l', arecord, arecord.ok ? parseArecordList(arecord.stdout) : []);
    if (!sources.length) {
        log.warn(`no audio capture sources found: ${backends.map((b) => `${b.command}: ${b.ok ? `${b.count}` : b.error}`).join('; ')}`);
    }
    return { sources, backends };
}
