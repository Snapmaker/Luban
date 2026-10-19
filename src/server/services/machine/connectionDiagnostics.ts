import { randomBytes } from 'crypto';
import settings from '../../config/settings';
import logger from '../../lib/logger';
import { ConnectionDiagnosticState } from './connectionDiagnosticState';

// Replaced in production by webpack with a source revision and build timestamp.
declare const LUBAN_CONNECTION_BUILD: string;
const log = logger('machine:connection-diagnostics', 'connection-diagnostics');
export const diagnosticId = (): string => randomBytes(12).toString('hex');
export const connectionDiagnostics = new ConnectionDiagnosticState({
    instanceId: diagnosticId(),
    pid: process.pid,
    startedAt: Date.now(),
    version: settings.version,
    build: typeof LUBAN_CONNECTION_BUILD === 'undefined' ? 'development-unbundled' : LUBAN_CONNECTION_BUILD,
}, event => log.info(JSON.stringify(event)));

// Independent of machine responses and renderer presence. Evidence only: no recovery or motion.
const watchdog = setInterval(() => connectionDiagnostics.checkOverdue(), 1000);
watchdog.unref();
