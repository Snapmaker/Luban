/*
 * The two Snapmaker engine packages, LunarTPP and LubanEngine, spawn a binary
 * that sits inside their own package directory. Loaded through the asar
 * archive their `__dirname` is a virtual path the OS cannot spawn from, so
 * they are required from the unpacked copy instead (see lib/paths.ts and
 * asarUnpack in electron-builder.yml).
 */
import { requireUnpacked } from '../lib/paths';

export const lunar = requireUnpacked('@snapmaker/snapmaker-lunar');

export const lubanEngine = requireUnpacked('snapmaker-luban-engine');
