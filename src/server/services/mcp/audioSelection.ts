// Which microphone records the spindle - parsed from what the host's audio
// stack reports, resolved strictly from a string the operator stored.
//
// A laptop has a built-in microphone that is nowhere near the spindle and
// hears its own fans; a USB camera on the toolhead may carry one that is.
// Both record perfectly good audio, and RPM tracked from the wrong one is
// simply the wrong RPM with no error anywhere. So the capture source is
// never guessed: the operator names one (configstore mcpAudioDevice or
// LUBAN_MCP_AUDIO_DEVICE) from the list this module produces, the match is
// exact or an unambiguous substring, and no fallback exists.
//
// Entries carry their backend as a prefix so the recorder knows how to open
// them with ffmpeg: `pulse:<node.name>` (PipeWire / PulseAudio, the normal
// desktop Linux case - `pw-dump` or `pactl list short sources`),
// `alsa:hw:CARD=<card>,DEV=<n>` (`arecord -l`, ALSA direct) and
// `dshow:<friendly name>` (Windows, `ffmpeg -list_devices true -f dshow`).
//
// Pure: no server imports, unit-tested in tests/audioSelection.test.ts.

export type AudioBackend = 'pulse' | 'alsa' | 'dshow';

export interface AudioSource {
    /** `<backend>:<device>` - what is stored and what a match resolves to. */
    entry: string;
    backend: AudioBackend;
    /** The ffmpeg `-i` argument. */
    device: string;
    description: string;
    /** Other strings that name this source (nick, card name, hw:N,M ...). */
    aliases: string[];
    /** Looks like the machine's own microphone (PCI / built-in / internal). */
    builtIn: boolean;
    /** Looks like a USB device (a camera or headset microphone). */
    usb: boolean;
}

export type AudioMatch = {
    ok: true;
    source: AudioSource;
    matchedOn: 'entry' | 'alias' | 'substring';
    reason: null;
} | {
    ok: false;
    source: null;
    matchedOn: null;
    reason: string;
};

const BUILT_IN = /built-?in|internal|pci-|hda intel|realtek high definition|analog(ue)? stereo|conexant|microphone array/i;
const USB = /usb|camera|webcam|headset/i;

function source(backend: AudioBackend, device: string, description: string, aliases: string[]): AudioSource {
    const text = `${device} ${description} ${aliases.join(' ')}`;
    return {
        entry: `${backend}:${device}`,
        backend,
        device,
        description,
        aliases: Array.from(new Set(aliases.filter((alias) => alias && alias !== device))),
        builtIn: BUILT_IN.test(text) && !USB.test(text),
        usb: USB.test(text),
    };
}

interface PwNode {
    type?: string;
    info?: { props?: { [key: string]: unknown } };
}

/** `pw-dump` (JSON array of objects): every Audio/Source node. */
export function parsePipewireDump(dump: unknown): AudioSource[] {
    if (!Array.isArray(dump)) {
        return [];
    }
    const out: AudioSource[] = [];
    for (const node of dump as PwNode[]) {
        const props = node && node.info && node.info.props;
        if (!props || props['media.class'] !== 'Audio/Source') {
            continue;
        }
        const name = String(props['node.name'] || '');
        if (!name) {
            continue;
        }
        const description = String(props['node.description'] || props['node.nick'] || name);
        const aliases = [props['node.nick'], props['node.description'], props['api.alsa.card.name'], props['alsa.card_name'], props['object.path']]
            .filter((value) => typeof value === 'string' && value) as string[];
        out.push(source('pulse', name, description, aliases));
    }
    return out;
}

/** `pactl list short sources`: `<id>\t<name>\t<driver>\t<format>\t<state>` per line. */
export function parsePactlSources(text: string): AudioSource[] {
    const out: AudioSource[] = [];
    for (const line of String(text || '').split(/\r?\n/)) {
        const fields = line.split('\t');
        if (fields.length < 2 || !/^\d+$/.test(fields[0].trim())) {
            continue;
        }
        const name = fields[1].trim();
        if (!name || /\.monitor$/.test(name)) {
            continue; // playback monitors are not microphones
        }
        out.push(source('pulse', name, name, [fields[0].trim()]));
    }
    return out;
}

/** `arecord -l`: `card N: ID [Name], device M: Dev [DevName]`. */
export function parseArecordList(text: string): AudioSource[] {
    const out: AudioSource[] = [];
    const re = /^card\s+(\d+):\s+(\S+)\s+\[([^\]]*)\],\s+device\s+(\d+):\s+([^[]*?)\s*\[([^\]]*)\]/;
    for (const line of String(text || '').split(/\r?\n/)) {
        const m = line.match(re);
        if (!m) {
            continue;
        }
        const [, cardIndex, cardId, cardName, devIndex, devId, devName] = m;
        const device = `hw:CARD=${cardId},DEV=${devIndex}`;
        out.push(source('alsa', device, `${cardName}, ${devName}`, [
            `hw:${cardIndex},${devIndex}`, `plughw:CARD=${cardId},DEV=${devIndex}`, `plughw:${cardIndex},${devIndex}`, cardName, devName, devId.trim(), cardId,
        ]));
    }
    return out;
}

/**
 * `ffmpeg -list_devices true -f dshow -i dummy` (stderr): either the newer
 * `"Name" (audio)` lines or the older `DirectShow audio devices` section.
 */
export function parseDshowDevices(text: string): AudioSource[] {
    const out: AudioSource[] = [];
    const seen = new Set<string>();
    let section: 'video' | 'audio' | null = null;
    for (const raw of String(text || '').split(/\r?\n/)) {
        const line = raw.replace(/^\[dshow @ [^\]]*\]\s*/, '').trim();
        if (/^DirectShow video devices/i.test(line)) {
            section = 'video';
            continue;
        }
        if (/^DirectShow audio devices/i.test(line)) {
            section = 'audio';
            continue;
        }
        const typed = line.match(/^"(.+)"\s+\((audio|video)\)$/);
        const plain = line.match(/^"(.+)"$/);
        let name: string | null = null;
        if (typed && typed[2] === 'audio') {
            name = typed[1];
        } else if (!typed && plain && section === 'audio') {
            name = plain[1];
        }
        if (name && !seen.has(name)) {
            seen.add(name);
            out.push(source('dshow', name, name, []));
        }
    }
    return out;
}

function names(candidate: AudioSource): string[] {
    return [candidate.entry, candidate.device, candidate.description, ...candidate.aliases].filter(Boolean);
}

function listFor(candidates: AudioSource[]): string {
    return candidates.length ? candidates.map((c) => `"${c.entry}" (${c.description})`).join(', ') : '(none found)';
}

/**
 * Resolve the operator's stored device string to exactly one source. Exact
 * match on the entry or any alias wins; a case-insensitive substring is
 * accepted only when it names ONE source. Empty, numeric and ambiguous
 * strings are refused: the whole point is that nothing is guessed.
 */
export function matchAudioDevice(query: string, candidates: AudioSource[]): AudioMatch {
    const q = String(query || '').trim();
    const refuse = (reason: string): AudioMatch => ({ ok: false, source: null, matchedOn: null, reason });
    if (!q) {
        return refuse(`No audio capture device is configured. Set mcpAudioDevice (or LUBAN_MCP_AUDIO_DEVICE) to one of: ${listFor(candidates)}.`);
    }
    if (/^\d+$/.test(q)) {
        return refuse(`"${q}" is a bare number; capture-device numbering changes with every replug. Name the device: ${listFor(candidates)}.`);
    }
    const exact = candidates.filter((c) => names(c).some((name) => name === q));
    if (exact.length === 1) {
        return { ok: true, source: exact[0], matchedOn: exact[0].entry === q ? 'entry' : 'alias', reason: null };
    }
    const lower = q.toLowerCase();
    const insensitive = candidates.filter((c) => names(c).some((name) => name.toLowerCase() === lower));
    if (insensitive.length === 1) {
        return { ok: true, source: insensitive[0], matchedOn: insensitive[0].entry.toLowerCase() === lower ? 'entry' : 'alias', reason: null };
    }
    if (insensitive.length > 1) {
        return refuse(`"${q}" names ${insensitive.length} capture sources (${listFor(insensitive)}). Store the full entry.`);
    }
    const partial = candidates.filter((c) => names(c).some((name) => name.toLowerCase().includes(lower)));
    if (partial.length === 1) {
        return { ok: true, source: partial[0], matchedOn: 'substring', reason: null };
    }
    if (partial.length > 1) {
        return refuse(`"${q}" matches ${partial.length} capture sources (${listFor(partial)}). Store the full entry so the choice is not left to matching order.`);
    }
    return refuse(`No capture source matches "${q}". Found: ${listFor(candidates)}. Run list_audio_devices and store one of its entries.`);
}

/** ffmpeg input arguments for a source (before the output options). */
export function ffmpegInputArgs(candidate: AudioSource): string[] {
    switch (candidate.backend) {
        case 'pulse': return ['-f', 'pulse', '-i', candidate.device];
        case 'alsa': return ['-f', 'alsa', '-i', candidate.device];
        case 'dshow': return ['-f', 'dshow', '-i', `audio=${candidate.device}`];
        default: throw new Error(`unsupported audio backend ${(candidate as AudioSource).backend}`);
    }
}

/** Guidance for the listing: which source to prefer and why nothing is chosen for the operator. */
export function describeSourceChoice(candidates: AudioSource[]): string {
    if (!candidates.length) {
        return 'No audio capture sources were found (no ALSA capture card, PipeWire/PulseAudio source or DirectShow audio device). Spindle audio cannot be recorded on this host.';
    }
    const usb = candidates.filter((c) => c.usb);
    const builtIn = candidates.filter((c) => c.builtIn);
    const parts: string[] = [];
    if (usb.length) {
        parts.push(`Prefer a microphone near the toolhead: ${usb.map((c) => `"${c.entry}"`).join(', ')} look like USB devices (a camera or headset microphone).`);
    } else {
        parts.push('No USB microphone was found; the only sources look like the host\'s own microphone, which is far from the spindle and hears the fans - place an external one near the head if RPM tracking does not lock.');
    }
    if (builtIn.length) {
        parts.push(`${builtIn.map((c) => `"${c.entry}"`).join(', ')} ${builtIn.length === 1 ? 'is' : 'are'} the host's built-in microphone.`);
    }
    parts.push('Nothing is selected automatically: store the chosen entry as mcpAudioDevice (Settings -> MCP Server) or LUBAN_MCP_AUDIO_DEVICE.');
    return parts.join(' ');
}
