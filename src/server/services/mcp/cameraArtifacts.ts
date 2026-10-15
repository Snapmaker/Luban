// Read only camera-produced artifacts, including for remote MCP clients.
import fs from 'fs';
import path from 'path';

const ROOTS = ['mcp-program-frames', 'mcp-camera-bootstrap', 'mcp-surveys', 'mcp-camera-captures'];

export function cameraArtifactPath(userDataDir: string, requested: string, kind: 'image' | 'index'): string {
    const file = path.resolve(requested);
    const roots = ROOTS.map((name) => path.resolve(userDataDir, name));
    const inside = (candidate: string, root: string) => candidate.startsWith(root + path.sep);
    const root = roots.find((candidate) => inside(file, candidate));
    if (!root) throw new Error('Path must be inside an MCP camera capture, program-frame, bootstrap or survey directory.');
    if (kind === 'index' ? path.basename(file) !== 'index.json' : !/\.(jpg|jpeg|png)$/i.test(file)) {
        throw new Error('Only camera images or index.json can be read.');
    }
    // realpath defeats symlink escapes as well as ../ escapes. Missing files fail closed.
    const realRoot = fs.realpathSync(root);
    if (realRoot !== root) throw new Error('Camera artifact root must not be a symlink.');
    const realFile = fs.realpathSync(file);
    if (!inside(realFile, realRoot)) throw new Error('Camera artifact symlink leaves its allowed directory.');
    const stat = fs.statSync(realFile);
    if (!stat.isFile() || stat.size > 32 * 1024 * 1024) throw new Error('Camera artifact must be a file of at most 32 MiB.');
    return realFile;
}

export function cameraImageMime(image: Buffer): string {
    return image.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) ? 'image/png' : 'image/jpeg';
}

interface Snapshot {
    frameId: string;
    imageBase64: string;
    device: string | null;
}

function snapshotDirectory(userDataDir: string, frameId: string): string {
    if (!/^[a-f0-9]{8,32}$/.test(frameId)) throw new Error('Invalid camera frame id.');
    return path.join(userDataDir, 'mcp-camera-captures', frameId);
}

/** Archive requested snapshots only, never the continuous video stream. */
export function saveCameraSnapshot<T extends Snapshot>(userDataDir: string, frame: T): T & { file: string } {
    const dir = snapshotDirectory(userDataDir, frame.frameId);
    const { imageBase64, ...metadata } = frame;
    const image = Buffer.from(imageBase64, 'base64');
    const file = path.join(dir, cameraImageMime(image) === 'image/png' ? 'frame.png' : 'frame.jpg');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(file, image);
    fs.writeFileSync(path.join(dir, 'index.json'), JSON.stringify({ ...metadata, file }));
    return { ...frame, file };
}

export function readCameraSnapshot(userDataDir: string, frameId: string): { image: Buffer; file: string; device: string | null } | null {
    if (!/^[a-f0-9]{8,32}$/.test(frameId)) return null;
    const dir = snapshotDirectory(userDataDir, frameId);
    if (!fs.existsSync(path.join(dir, 'index.json'))) return null;
    const index = cameraArtifactPath(userDataDir, path.join(dir, 'index.json'), 'index');
    const metadata = JSON.parse(fs.readFileSync(index, 'utf8'));
    const file = cameraArtifactPath(userDataDir, metadata.file, 'image');
    return { image: fs.readFileSync(file), file, device: metadata.device ?? null };
}
