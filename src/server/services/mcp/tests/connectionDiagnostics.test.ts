import assert from 'assert';
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import ts from 'typescript';
import { ConnectionDiagnosticState, httpEvidence, safeIdentifier, safeTarget } from '../../machine/connectionDiagnosticState';

function fixture() {
    let at = 1000;
    const written: object[] = [];
    const state = new ConnectionDiagnosticState({ instanceId: 'server-A', pid: 1, startedAt: at, version: 'test', build: 'revision' },
        event => written.push(event), () => at);
    return { state, written, advance: (ms: number) => { at += ms; } };
}

export const tests: Array<[string, () => void | Promise<void>]> = [
    ['renderer retains attempts when disconnected and correlates server receipts without storing credentials', () => {
        const source = fs.readFileSync(path.join(__dirname, '../../../../app/flux/workspace/connectionDiagnostics.ts'), 'utf8');
        const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText;
        const storage = new Map<string, string>();
        const exports = {} as typeof import('../../../../app/flux/workspace/connectionDiagnostics');
        let unavailable = false;
        vm.runInNewContext(code, {
            exports,
            Date,
            window: { localStorage: {
                getItem: (key: string) => { if (unavailable) { throw new Error('disabled'); } return storage.get(key); },
                setItem: (key: string, value: string) => storage.set(key, value),
            } },
            require: (name: string) => (name === 'uuid' ? { v4: () => 'attempt-id' } : { info: () => undefined }),
        });
        const attempt = exports.beginConnectionAttempt(false);
        const attemptWithExtraFields = { ...attempt, token: 'secret' };
        exports.recordConnectionAttempt(attemptWithExtraFields, 'server_received', undefined, { instanceId: 'server-A', build: 'revision' });
        const entries = JSON.parse(storage.get('luban.connectionAttempts.v1') || '[]');
        assert.strictEqual(entries[0].clientConnected, false);
        assert.strictEqual(entries[1].attemptId, entries[0].attemptId);
        assert.strictEqual(entries[1].serverInstanceId, 'server-A');
        assert(!JSON.stringify(entries).includes('secret'));
        for (let i = 0; i < 100; i++) { exports.beginConnectionAttempt(false); }
        assert.strictEqual(JSON.parse(storage.get('luban.connectionAttempts.v1') || '[]').length, 50);
        unavailable = true;
        assert.doesNotThrow(() => exports.beginConnectionAttempt(false));
    }],
    ['missing first heartbeat raises one overdue event without a later response, then resumes', () => {
        const { state, advance } = fixture();
        state.beginAttempt('attempt-A', {});
        state.beginSession('session-A', 'attempt-A');
        state.startWorker(1);
        advance(10001);
        state.checkOverdue();
        state.checkOverdue();
        assert.strictEqual(state.snapshot().recent.filter(e => e.event === 'heartbeat_overdue').length, 1);
        state.poll({ httpStatus: 204 }, false);
        assert.strictEqual(state.snapshot().heartbeat.lastReportAt, null);
        state.poll({ httpStatus: 200 }, true);
        assert.strictEqual(state.snapshot().heartbeat.overdue, false);
        assert(state.snapshot().recent.some(e => e.event === 'heartbeat_resumed' && e.attemptId === 'attempt-A' && e.sessionId === 'session-A'));
    }],
    ['stopped workers are not overdue; silent active workers are, even after a valid connection', () => {
        const { state, advance } = fixture();
        state.startWorker(1);
        state.poll({ httpStatus: 200 }, true);
        advance(10001);
        state.checkOverdue();
        assert.strictEqual(state.snapshot().heartbeat.overdue, true);
        state.stopWorker('connection_close');
        const count = state.snapshot().recent.length;
        advance(60000);
        state.checkOverdue();
        assert.strictEqual(state.snapshot().recent.length, count);
    }],
    ['pre-recovery evidence survives subsequent session changes and bounded history eviction', () => {
        const { state } = fixture();
        state.beginSession('original', 'original-attempt');
        state.startWorker(1);
        state.poll({ httpStatus: 401 }, false);
        state.capture('before_existing_session_recovery', 'capture-A');
        const before = JSON.stringify(state.snapshot().captures[0]);
        state.beginSession('replacement', 'replacement-attempt');
        for (let i = 0; i < 200; i++) { state.record('renderer_connected'); }
        assert.strictEqual(JSON.stringify(state.snapshot().captures[0]), before);
        assert.strictEqual(state.snapshot().recent.length, 160);
        for (let i = 0; i < 10; i++) { state.capture('test', `capture-${i}`); }
        assert.strictEqual(state.snapshot().captures.length, 5);
    }],
    ['HTTP evidence never contains request URLs, response bodies, tokens or raw error messages', () => {
        const evidence = httpEvidence({ code: 'ETIMEDOUT', timeout: 3000, message: 'http://machine?token=secret' },
            { status: 401, text: '{"token":"secret"}' });
        assert.strictEqual(evidence.errorCode, 'ETIMEDOUT');
        assert.strictEqual(evidence.httpStatus, 401);
        assert.strictEqual(evidence.timedOut, true);
        assert(!JSON.stringify(evidence).includes('secret'));
        assert.strictEqual(httpEvidence({ code: 'secret' }).errorCode, 'REQUEST_ERROR');
        assert.strictEqual(safeTarget('http://user:secret@machine:8080/api?token=secret'), 'machine:8080');
        assert.strictEqual(safeIdentifier('id\nforged log'), undefined);
    }],
    ['healthy poll samples are bounded but response changes are recorded immediately', () => {
        const { state, advance } = fixture();
        state.startWorker(1);
        for (let i = 0; i < 10; i++) { state.poll({ httpStatus: 200 }, true); advance(2000); }
        assert.strictEqual(state.snapshot().recent.filter(e => e.event === 'heartbeat_response').length, 1);
        state.poll({ httpStatus: 200 }, true);
        state.poll({ httpStatus: 204 }, false);
        state.poll({ httpStatus: 401 }, false);
        assert.strictEqual(state.snapshot().recent.filter(e => e.event === 'heartbeat_response').length, 4);
    }],
];
