import { execFile } from 'child_process';
import crypto from 'crypto';
import * as fs from 'fs-extra';
import http from 'http';
import https from 'https';
import path from 'path';

import DataStorage from '../../DataStorage';
import logger from '../../lib/logger';
import config from '../configstore';
import { CameraCandidate, describeCaptureFailure, isSnapshotUrl } from './cameraSelection';
import { McpToolError } from './registry';
import { readCameraSnapshot, saveCameraSnapshot } from './cameraArtifacts';

const log = logger('service:mcp:camera');

// Frame capture for the USB webcam near the toolhead (#10). The server is a
// plain forked Node process (no Electron media stack), so capture goes
// through one of two providers:
//   - mcpCameraUrl: HTTP(S) snapshot URL returning a JPEG/PNG per GET
//   - ffmpeg: mcpFfmpegPath (or ffmpeg on PATH) reading the device named by
//     mcpCameraDevice - DirectShow on Windows, v4l2 on Linux. macOS has no
//     ffmpeg input wired up; use mcpCameraUrl there.
export const CAPTURE_TIMEOUT_MS = 15000;

export const FFMPEG_PROVIDER = process.platform === 'win32' ? 'ffmpeg-dshow' : 'ffmpeg-v4l2';

export interface CapturedFrame {
    frameId: string;
    /** Persistent image path for requested captures; video frames alone are not archived. */
    file?: string;
    imageBase64: string;
    mimeType: string;
    provider: string;
    device: string | null;
    capturedAt: number;
    /** one-shot = this call opened the device; stream = served by the live MJPEG capture loop. */
    source: 'one-shot' | 'stream';
}

/**
 * The live MJPEG stream (cameraStream.ts) owns the camera device while it
 * has browser clients - v4l2/DirectShow devices open for one process only -
 * so every MCP capture is served from ITS latest frame for as long as it
 * runs, and goes back to opening the device itself the moment it stops.
 * Registered by the stream service at start; null = no stream feature.
 */
export interface LiveFrameSource {
    /** True while the capture loop holds (or is about to hold) the device. */
    isActive(): boolean;
    /** A frame no older than the loop's own frame interval, or the next one. */
    awaitFrame(): Promise<CapturedFrame>;
    /** The device string the loop currently holds, or null when it holds none. */
    activeDevice(): string | null;
}

let liveSource: LiveFrameSource | null = null;

export function setLiveFrameSource(source: LiveFrameSource | null): void {
    liveSource = source;
}

// A one-shot ffmpeg capture in flight; the stream loop waits for it before
// opening the device (two openers = one of them fails).
let oneShotInFlight: Promise<unknown> | null = null;

export async function oneShotCapturePending(): Promise<void> {
    if (oneShotInFlight) {
        await oneShotInFlight.catch(() => undefined);
    }
}

// Recent frames kept in memory so track_feature can template-match between
// them by id - the dominant field error source was hand-estimated pixel
// coordinates, so measurement between cached frames replaces eyeballing.
const FRAME_CACHE_LIMIT = 12;
// The device each cached frame came from rides with it: select_camera makes a
// caller point at a frame as its evidence for "this is the right camera", and
// that evidence is only worth anything if the frame provably came from the
// camera being selected.
const frameCache = new Map<string, { jpg: Buffer; device: string | null }>();

export function cacheFrame(jpg: Buffer, device: string | null = null): string {
    const frameId = crypto.randomBytes(16).toString('hex');
    frameCache.set(frameId, { jpg, device });
    while (frameCache.size > FRAME_CACHE_LIMIT) {
        frameCache.delete(frameCache.keys().next().value);
    }
    return frameId;
}

export function getCachedFrameIds(): string[] {
    return [...frameCache.keys()];
}

export function getCachedFrame(frameId: string): Buffer | null {
    const entry = frameCache.get(frameId);
    return entry ? entry.jpg : null;
}

/** Recent RAM cache with persistent snapshot fallback, including after restart. */
export function getCapturedFrame(frameId: string): Buffer | null {
    return getCachedFrame(frameId) || readCameraSnapshot(DataStorage.userDataDir, frameId)?.image || null;
}

/** Camera provenance from the cache or snapshot archive; null for unknown/unnamed sources. */
export function getCachedFrameDevice(frameId: string): string | null {
    const entry = frameCache.get(frameId);
    return entry ? entry.device : readCameraSnapshot(DataStorage.userDataDir, frameId)?.device || null;
}

export function ffmpegBinary(): string {
    return config.get('mcpFfmpegPath') || 'ffmpeg';
}

async function runFfmpeg(args: string[]): Promise<{ code: number; stderr: string }> {
    return new Promise((resolve, reject) => {
        execFile(ffmpegBinary(), args, { timeout: CAPTURE_TIMEOUT_MS, windowsHide: true }, (err, stdout, stderr) => {
            if (err && (err as { code?: string }).code === 'ENOENT') {
                reject(new McpToolError('ffmpeg not found. Set configstore key mcpFfmpegPath to an ffmpeg binary, '
                    + 'or set mcpCameraUrl to an HTTP snapshot URL instead.'));
                return;
            }
            resolve({ code: err ? 1 : 0, stderr: String(stderr || '') });
        });
    });
}

/**
 * Enumerate v4l2 capture devices from sysfs (ffmpeg cannot list them). Each
 * physical camera exposes several /dev/video* nodes; only `index` 0 is the
 * actual capture node (the rest are metadata companions), so only those are
 * listed. /dev/videoN numbering shuffles whenever cameras are (un)plugged
 * (seen on the Ubuntu box: the toolhead camera moved video0 -> video2 when
 * a second camera appeared), so entries prefer udev's stable per-device
 * symlink: "/dev/v4l/by-id/usb-...-video-index0 (Friendly Name)", falling
 * back to "/dev/videoN (Friendly Name)". The same string is stored as the
 * sticky device and the leading path is parsed back out at capture time.
 */
function listV4l2Devices(): string[] {
    const root = '/sys/class/video4linux';
    if (!fs.existsSync(root)) {
        return [];
    }
    const byIdDir = '/dev/v4l/by-id';
    const stablePath: { [node: string]: string } = {};
    if (fs.existsSync(byIdDir)) {
        for (const link of fs.readdirSync(byIdDir)) {
            try {
                const target = path.basename(fs.readlinkSync(path.join(byIdDir, link)));
                stablePath[target] = path.join(byIdDir, link);
            } catch (err) {
                // not a symlink; ignore
            }
        }
    }
    const nodes = fs.readdirSync(root)
        .filter((entry) => /^video\d+$/.test(entry))
        .sort((a, b) => Number(a.slice(5)) - Number(b.slice(5)));
    const devices: string[] = [];
    for (const node of nodes) {
        const devPath = stablePath[node] || `/dev/${node}`;
        try {
            const index = fs.readFileSync(path.join(root, node, 'index'), 'utf8').trim();
            if (index !== '0') {
                continue;
            }
            const name = fs.readFileSync(path.join(root, node, 'name'), 'utf8').trim();
            devices.push(name ? `${devPath} (${name})` : devPath);
        } catch (err) {
            devices.push(devPath);
        }
    }
    return devices;
}

/**
 * The cameras physically attached, whatever mcpCameraUrl says. listCameras()
 * reports the CONFIGURED source and so hides these behind a set snapshot URL;
 * choosing between cameras needs to see them all.
 */
export async function listLocalCameras(): Promise<{ provider: string; devices: string[]; note?: string }> {
    if (process.platform === 'linux') {
        return { provider: 'ffmpeg-v4l2', devices: listV4l2Devices() };
    }
    if (process.platform !== 'win32') {
        return {
            provider: 'ffmpeg',
            devices: [],
            note: `No ffmpeg camera input is wired up for ${process.platform}; set mcpCameraUrl to an `
                + 'HTTP snapshot URL instead.',
        };
    }

    const { stderr } = await runFfmpeg(['-hide_banner', '-list_devices', 'true', '-f', 'dshow', '-i', 'dummy']);
    // ffmpeg prints device lines as: [dshow @ ...] "Device Name" (video)
    const devices: string[] = [];
    for (const line of stderr.split(/\r?\n/)) {
        const match = line.match(/"([^"]+)"\s+\(video\)/);
        if (match) {
            devices.push(match[1]);
        }
    }
    return { provider: 'ffmpeg-dshow', devices };
}

export async function listCameras(): Promise<{ provider: string; devices: string[]; note?: string }> {
    const cameraUrl = config.get('mcpCameraUrl');
    if (cameraUrl) {
        return { provider: 'http', devices: [String(cameraUrl)], note: 'mcpCameraUrl is set; it takes precedence.' };
    }
    return listLocalCameras();
}

/**
 * Every camera that could be selected, with the other strings that name it.
 * A v4l2 entry reads "<path> (<Name>)", so the path and the name are each an
 * alias; the path is resolved through its symlink as well, because
 * /dev/v4l/by-id/... and the /dev/videoN it points at are the same camera
 * under two names and a caller may have either.
 */
export async function listCameraCandidates(): Promise<{ provider: string; candidates: CameraCandidate[]; note?: string }> {
    const { provider, devices, note } = await listLocalCameras();
    const candidates: CameraCandidate[] = devices.map((entry) => {
        const aliases = new Set<string>();
        const parsed = entry.match(/^(\/dev\/\S+)\s+\((.+)\)$/);
        if (parsed) {
            aliases.add(parsed[1]);
            aliases.add(parsed[2]);
            try {
                // by-id symlink and the /dev/videoN it points at are the same
                // camera under two names, and a caller may hold either.
                aliases.add(fs.realpathSync(parsed[1]));
            } catch (err) {
                // the node vanished between listing and resolving; the
                // literal path stays an alias
            }
        }
        aliases.delete(entry);
        return { entry, aliases: [...aliases] };
    });
    const cameraUrl = config.get('mcpCameraUrl');
    if (cameraUrl) {
        candidates.unshift({ entry: String(cameraUrl), aliases: [] });
    }
    return { provider, candidates, note };
}

/** One GET of an HTTP snapshot source; shared by the one-shot capture and the stream's poller. */
export async function fetchHttpSnapshot(url: string): Promise<{ body: Buffer; mimeType: string }> {
    return new Promise((resolve, reject) => {
        const client = url.startsWith('https') ? https : http;
        const req = client.get(url, { timeout: CAPTURE_TIMEOUT_MS }, (res) => {
            if (res.statusCode !== 200) {
                res.resume();
                reject(new McpToolError(`Snapshot URL returned ${res.statusCode}.`));
                return;
            }
            const chunks: Buffer[] = [];
            res.on('data', (chunk: Buffer) => chunks.push(chunk));
            res.on('end', () => {
                const body = Buffer.concat(chunks);
                const contentType = String(res.headers['content-type'] || 'image/jpeg').split(';')[0];
                if (!contentType.startsWith('image/')) {
                    reject(new McpToolError(`Snapshot URL returned ${contentType}, not an image.`));
                    return;
                }
                resolve({ body, mimeType: contentType });
            });
        });
        req.on('timeout', () => {
            req.destroy();
            reject(new McpToolError('Snapshot request timed out.'));
        });
        req.on('error', (err) => {
            reject(new McpToolError(`Snapshot request failed: ${err.message}`));
        });
    });
}

async function captureViaHttp(url: string): Promise<CapturedFrame> {
    const { body, mimeType } = await fetchHttpSnapshot(url);
    return {
        frameId: cacheFrame(body, url),
        imageBase64: body.toString('base64'),
        mimeType,
        provider: 'http',
        device: url,
        capturedAt: Date.now(),
        source: 'one-shot',
    };
}

/**
 * Which ffmpeg input the configured camera is, as ffmpeg arguments. Device
 * choice is sticky: enumeration order is not stable across restarts, and a
 * capture that silently falls back to a different (possibly dead virtual)
 * camera is worse than an error. The last device that produced a frame is
 * remembered and preferred; a missing device is an error, never a
 * substitution. Shared by the one-shot capture and the live stream loop.
 */
export async function resolveFfmpegInput(deviceOverride?: string): Promise<{ device: string; inputArgs: string[] }> {
    if (process.platform !== 'win32' && process.platform !== 'linux') {
        throw new McpToolError(`No ffmpeg camera input is wired up for ${process.platform}. `
            + 'Set mcpCameraUrl to an HTTP snapshot URL instead.');
    }
    // An override names the device for THIS capture only (preview_cameras
    // looking at a camera that has not been chosen): it neither reads nor
    // writes the sticky choice.
    let device: unknown = deviceOverride || config.get('mcpCameraDevice');
    if (!device) {
        const { devices } = await listCameras();
        if (!devices.length) {
            const linuxHint = process.platform === 'linux'
                ? ' (v4l2 devices are read from /sys/class/video4linux; check the camera is attached '
                    + 'and the user can read /dev/video* - video group.)'
                : '';
            throw new McpToolError(`No ${process.platform === 'win32' ? 'DirectShow' : 'v4l2'} video devices `
                + 'found. Attach a camera and choose it with select_camera, or set mcpCameraUrl for an HTTP '
                + `snapshot source.${linuxHint}`);
        }
        const lastGood = config.get('mcpCameraLastGood');
        if (lastGood && devices.includes(String(lastGood))) {
            device = lastGood;
        } else if (lastGood) {
            throw new McpToolError(`The last working camera ("${lastGood}") is not in the current device list `
                + `(${devices.join(', ')}). Re-plug it and retry, or run preview_cameras and select_camera to `
                + 'choose one of these - refusing to silently substitute a different device.');
        } else {
            device = devices[0];
        }
    }

    // dshow addresses cameras by friendly name; v4l2 by device path. Linux
    // list entries read "<path> (Name)" where path is a /dev/v4l/by-id
    // symlink or /dev/videoN - parse the path back out, and accept a bare
    // path set directly in mcpCameraDevice.
    const inputArgs = process.platform === 'win32'
        ? ['-f', 'dshow', '-i', `video=${device}`]
        : ['-f', 'v4l2', '-i', (String(device).match(/^(\/dev\/\S+)/) || [])[1] || String(device)];
    return { device: String(device), inputArgs };
}

/** Remember the device that just produced a frame (the sticky choice). */
export function noteCameraLastGood(device: string): void {
    config.set('mcpCameraLastGood', device);
}

async function captureViaFfmpeg(deviceOverride?: string): Promise<CapturedFrame> {
    const { device, inputArgs } = await resolveFfmpegInput(deviceOverride);

    const outPath = path.join(DataStorage.tmpDir, `mcp-frame-${crypto.randomBytes(4).toString('hex')}.jpg`);
    try {
        const ffmpegArgs = [
            '-hide_banner', '-loglevel', 'error',
            ...inputArgs,
            '-frames:v', '1', '-f', 'image2', '-y', outPath,
        ];
        let { code, stderr } = await runFfmpeg(ffmpegArgs);
        if (code !== 0 || !fs.existsSync(outPath)) {
            // One retry after a beat: first-open flakiness on USB cameras is
            // real and transient; a different device is never substituted.
            await new Promise((resolve) => {
                setTimeout(resolve, 1200);
            });
            ({ code, stderr } = await runFfmpeg(ffmpegArgs));
        }
        if (code !== 0 || !fs.existsSync(outPath)) {
            // Only now is the device list worth the enumeration: a pinned
            // camera that has been unplugged reads exactly like a broken one
            // until someone says which cameras are actually there.
            let attached: string[] = [];
            try {
                ({ devices: attached } = await listLocalCameras());
            } catch (err) {
                // enumeration is a courtesy; the capture failure is the message
            }
            throw new McpToolError(describeCaptureFailure(
                device,
                attached,
                stderr.split(/\r?\n/).filter(Boolean).slice(-2).join(' ')
            ));
        }
        if (!deviceOverride) {
            // A preview of an unchosen camera must not become the fallback
            // the next capture silently lands on.
            noteCameraLastGood(device);
        }
        const body = await fs.readFile(outPath);
        return {
            frameId: cacheFrame(body, device),
            imageBase64: body.toString('base64'),
            mimeType: 'image/jpeg',
            provider: FFMPEG_PROVIDER,
            device,
            capturedAt: Date.now(),
            source: 'one-shot',
        };
    } finally {
        fs.remove(outPath).catch(() => undefined);
    }
}

/** True when some capture source is configured (URL, pinned device, or a remembered one). */
export function isCameraConfigured(): boolean {
    return !!(config.get('mcpCameraUrl') || config.get('mcpCameraDevice') || config.get('mcpCameraLastGood'));
}

async function captureOneShot(): Promise<CapturedFrame> {
    const cameraUrl = config.get('mcpCameraUrl');
    if (cameraUrl) {
        log.debug(`Capturing frame via HTTP snapshot: ${cameraUrl}`);
        return captureViaHttp(String(cameraUrl));
    }
    log.debug(`Capturing frame via ${FFMPEG_PROVIDER}`);
    return captureViaFfmpeg();
}

/** Run a capture as THE one-shot in flight, so the stream loop waits for the device. */
async function asOneShot(capture: () => Promise<CapturedFrame>): Promise<CapturedFrame> {
    const pending = capture();
    oneShotInFlight = pending;
    try {
        return await pending;
    } finally {
        if (oneShotInFlight === pending) {
            oneShotInFlight = null;
        }
    }
}

export async function captureFrame(): Promise<CapturedFrame> {
    if (liveSource && liveSource.isActive()) {
        // The stream loop holds the device: its next fresh frame IS the capture.
        log.debug('Capturing frame from the live stream loop');
        return saveCameraSnapshot(DataStorage.userDataDir, await liveSource.awaitFrame());
    }
    return saveCameraSnapshot(DataStorage.userDataDir, await asOneShot(captureOneShot));
}

/**
 * One frame from a NAMED camera, chosen or not - what preview_cameras shows
 * of each candidate before one is selected, and what select_camera takes to
 * prove the camera it just pinned is the one that was looked at.
 *
 * No sticky selection is read or written: the configured source is bypassed
 * entirely. When the live stream loop already holds this very device its
 * frame is used (one process per device), and any other device is opened
 * here - which is safe alongside the loop precisely because it is a
 * different device. The requested snapshot is archived like captureFrame.
 */
export async function captureFromDevice(device: string): Promise<CapturedFrame> {
    if (liveSource && liveSource.isActive() && liveSource.activeDevice() === device) {
        log.debug(`Capturing frame for "${device}" from the live stream loop that holds it`);
        return saveCameraSnapshot(DataStorage.userDataDir, await liveSource.awaitFrame());
    }
    if (isSnapshotUrl(device)) {
        return saveCameraSnapshot(DataStorage.userDataDir, await asOneShot(async () => captureViaHttp(device)));
    }
    return saveCameraSnapshot(DataStorage.userDataDir, await asOneShot(async () => captureViaFfmpeg(device)));
}

export interface CameraSelection {
    /** The snapshot URL, which takes precedence over any device when set. */
    url: string | null;
    /** The pinned ffmpeg device, or null when the choice is left to the sticky fallback. */
    device: string | null;
    /** The last device that actually produced a frame; the fallback when nothing is pinned. */
    lastGood: string | null;
}

export function cameraSelection(): CameraSelection {
    return {
        url: (config.get('mcpCameraUrl') as string) || null,
        device: (config.get('mcpCameraDevice') as string) || null,
        lastGood: (config.get('mcpCameraLastGood') as string) || null,
    };
}

/**
 * Pin the camera every capture uses from now on. A URL and a device are the
 * same choice made two ways and the URL wins wherever both are set, so
 * choosing one CLEARS the other - a selection that leaves a stale URL in
 * place would be a selection that did nothing.
 */
export function selectCamera(entry: string): CameraSelection {
    const before = cameraSelection();
    if (isSnapshotUrl(entry)) {
        config.set('mcpCameraUrl', entry);
        config.unset('mcpCameraDevice');
    } else {
        config.set('mcpCameraDevice', entry);
        config.unset('mcpCameraUrl');
    }
    config.set('mcpCameraLastGood', entry);
    log.info(`Camera selected: "${entry}" (was ${before.url || before.device || 'unpinned'})`);
    return before;
}

/** Unpin: the next capture falls back to the last-good device, then to the only one attached. */
export function clearCameraSelection(): CameraSelection {
    const before = cameraSelection();
    config.unset('mcpCameraDevice');
    config.unset('mcpCameraUrl');
    log.info(`Camera selection cleared (was ${before.url || before.device || 'unpinned'})`);
    return before;
}
