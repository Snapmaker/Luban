import { v4 as uuid } from 'uuid';
import log from '../../lib/log';

// Survives renderer reloads, including attempts that never reach the server. Never store tokens or errors.
const STORAGE_KEY = 'luban.connectionAttempts.v1';
type Attempt = { attemptId: string; clientAt: number; clientConnected: boolean };
type Entry = Attempt & { event: string; at: number; responseCode?: number | string; serverInstanceId?: string; serverBuild?: string };

export function recordConnectionAttempt(attempt: Attempt, event: string, responseCode?: number | string, server?: { instanceId: string; build: string }): void {
    const entry: Entry = { attemptId: attempt.attemptId,
        clientAt: attempt.clientAt,
        clientConnected: attempt.clientConnected,
        event,
        at: Date.now(),
        responseCode,
        serverInstanceId: server?.instanceId,
        serverBuild: server?.build };
    log.info('connection-diagnostics', entry);
    try {
        const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '[]');
        const recent = Array.isArray(stored) ? stored.slice(-49) : [];
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...recent, entry]));
    } catch {
        // Diagnostics must not prevent connecting when browser storage is unavailable.
    }
}

export function beginConnectionAttempt(clientConnected: boolean): Attempt {
    const attempt = { attemptId: uuid(), clientAt: Date.now(), clientConnected };
    recordConnectionAttempt(attempt, 'connect_action');
    return attempt;
}
