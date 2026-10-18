/*
 * Where the server's own files live, resolved once and explicitly.
 *
 * The packaged app ships inside an asar archive, so the server can no longer
 * `process.chdir()` into its own directory and resolve everything relative to
 * the working directory (there is no real directory to enter). Instead the
 * entry point (server-cli.js, or main.js in development) tells us where the
 * server directory is, and every path to bundled assets starts from here.
 *
 * Layout, in both the packaged app and the development output:
 *
 *   <app>/src/server/       SERVER_DIR  - server bundle, i18n, views, workers
 *   <app>/src/app/          APP_DIR     - built renderer
 *   <app>/resources/        RESOURCES   - print settings, fonts, scenes, cases
 *
 * where <app> is dist/Luban (packaged: resources/app.asar) or output.
 *
 * Note that webpack rewrites `__dirname` in the server bundle to a path
 * relative to src/server, so it cannot be trusted there; the fallback below
 * only matters for the unbundled code (tsc output, ts-node tests), where the
 * entry has not set the variable but `__dirname` is real.
 */
import fs from 'fs';
import { createRequire } from 'module';
import path from 'path';

export const SERVER_DIR_ENV = 'LUBAN_SERVER_DIR';

export const SERVER_DIR: string = process.env[SERVER_DIR_ENV]
    ? path.resolve(process.env[SERVER_DIR_ENV])
    : path.resolve(__dirname, '..');

export const SRC_DIR: string = path.resolve(SERVER_DIR, '..');

export const APP_DIR: string = path.join(SRC_DIR, 'app');

/**
 * Map a path inside an asar archive to the real file electron-builder left
 * beside it (asarUnpack). Paths outside an archive come back unchanged.
 *
 * Electron's patched fs reads unpacked files through the archive path
 * transparently, but anything that hands the path to the OS - spawning a
 * binary, opening a folder, a native copy - needs the real one.
 */
export function unpackedPath(p: string): string {
    return p.replace(/\.asar([\\/])/, '.asar.unpacked$1');
}

export const RESOURCES_DIR: string = unpackedPath(path.resolve(SRC_DIR, '..', 'resources'));

/* eslint-disable camelcase -- webpack's own identifier */
declare const __non_webpack_require__: NodeRequire | undefined;

// The real Node require: webpack leaves `__non_webpack_require__` alone, so
// resolution happens at runtime from the bundle's location on disk. Unbundled
// code (tsc output, ts-node) has a real `__filename` to build one from.
const nodeRequire: NodeRequire = typeof __non_webpack_require__ !== 'undefined'
    ? __non_webpack_require__
    : createRequire(__filename);
/* eslint-enable camelcase */

/**
 * Require a package from its unpacked copy when the app is inside an asar
 * archive, so that the package's own `__dirname` points at real files.
 *
 * For packages that spawn a sibling binary (LunarTPP, LubanEngine): Electron
 * only patches `execFile`, not `spawn`, so a binary path derived from an
 * archive `__dirname` fails with ENOENT. Such packages must be listed in
 * asarUnpack (electron-builder.yml) and have no dependencies of their own.
 */
export function requireUnpacked(name: string) {
    const resolved = nodeRequire.resolve(name);
    const unpacked = unpackedPath(resolved);
    if (unpacked !== resolved && fs.existsSync(unpacked)) {
        return nodeRequire(unpacked);
    }
    return nodeRequire(resolved);
}
