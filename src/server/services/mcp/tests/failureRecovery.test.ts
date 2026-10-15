/* eslint-disable camelcase */
import { strict as assert } from 'assert';

import {
    NotSentError,
    PositionReading,
    RecoveryDeps,
    RecoveryEvidence,
    assessExposure,
    classifyFailure,
    classifyReply,
    detachFromLedger,
    modalWords,
    recordModalSend,
} from '../failureRecovery';
import { McpToolError, ToolRegistry } from '../registry';

// Inert: no machine, no server. A "send" inside a handler goes through
// recordModalSend exactly as sendGcodeVisible does, and the cleanup's own
// sends land in `sent`, stamped with the connection generation at the time.

interface Harness {
    registry: ToolRegistry;
    sent: Array<{ connection: string | null; gcode: string }>;
    connA: string;
    state: {
        connection: string | null;
        reply: (gcode: string) => { result: number; text?: string };
        reading: PositionReading | null;
        jobRunning: boolean;
        authorityClosed: string | null;
        clock: number;
    };
}

function harness(): Harness {
    const connA = '3.1';
    const sent: Array<{ connection: string | null; gcode: string }> = [];
    const state: Harness['state'] = {
        connection: connA,
        reply: () => ({ result: 0, text: 'ok' }),
        reading: {
            reliability: 'heartbeat',
            frame: 'work-frame',
            reportedAt: 5000,
            originOffset: { x: 120, y: 80, z: -40 },
            machineStatus: 'idle',
            rawImpossibleAsMachine: true,
        },
        jobRunning: false,
        authorityClosed: null,
        clock: 1000,
    };
    const deps: RecoveryDeps = {
        connectionId: () => state.connection,
        send: async (_label, gcode) => {
            sent.push({ connection: state.connection, gcode });
            return state.reply(gcode);
        },
        settle: async () => undefined,
        readPosition: () => state.reading,
        reliableForMotion: (r) => r === 'verified' || r === 'heartbeat' || r === 'cached-offset',
        jobRunning: () => state.jobRunning,
        manualControl: () => false,
        authorityClosed: () => state.authorityClosed,
        now: () => state.clock,
    };
    const registry = new ToolRegistry();
    registry.setFailureRecovery(deps);
    return { registry, sent, connA, state };
}

type Outcome = 'accepted' | 'rejected' | 'indeterminate' | 'not-sent' | 'pending';

/** Simulate the direct send path: record, then settle with the given outcome. */
function fakeSend(connection: string, gcode: string, outcome: Outcome): void {
    const settle = recordModalSend(connection, gcode);
    if (outcome !== 'pending') {
        settle(outcome);
    }
}

type FailedError = Error & { failureRecovery?: RecoveryEvidence; partial?: object };

async function callExpectingError(h: Harness, name: string): Promise<FailedError> {
    try {
        await h.registry.call(name, {});
    } catch (err) {
        return err as FailedError;
    }
    throw new Error('expected the call to fail');
}

/** Register a mutating tool whose handler sends `payloads` then throws `message`. */
function failingTool(h: Harness, name: string, payloads: Array<[string, Outcome]>, message = 'Controller rejected the move: error:22'): void {
    h.registry.register({
        name,
        description: '',
        inputSchema: {},
        handler: async () => {
            for (const [gcode, outcome] of payloads) {
                fakeSend(h.connA, gcode, outcome);
            }
            throw new McpToolError(message);
        },
    });
}

const AXIS = /[XYZABCIJK]\s*-?\d/i;

export const tests: Array<[string, () => void | Promise<void>]> = [
    ['modal words ignore comments and arc-mode subcodes', () => {
        assert.deepEqual(modalWords('G53 ; then G54\n(G91 in a comment) G0 X1\nG90.1\nG91 G0 Z2'), ['G53', 'G91']);
        assert.deepEqual(modalWords('g54\nG090'), ['G54', 'G90']);
    }],

    ['executeGcode replies are classified, never assumed', () => {
        assert.equal(classifyReply({ result: 0 }), 'accepted');
        assert.equal(classifyReply({ result: -1, text: 'error:22' }), 'rejected');
        assert.equal(classifyReply({ result: -1, text: 'transport_error: ECONNRESET' }), 'indeterminate');
        assert.equal(classifyReply({ result: -1, text: 'Machine connection changed during command execution.' }), 'indeterminate');
        assert.equal(classifyReply({ result: -1, text: 'Cancelled after an earlier command failed.' }), 'not-sent');
        // The real SSTP format (SstpHttpChannel: "Controller request failed (<code>): <msg>").
        for (const code of ['ECONNABORTED', 'ETIMEDOUT', 'ECONNRESET', 'REQUEST_ERROR', 'transport error', 'EHOSTUNREACH']) {
            assert.equal(classifyReply({ result: -1, text: `Controller request failed (${code}): socket hang up` }), 'indeterminate', code);
        }
        assert.equal(classifyReply({ result: -1, text: 'Controller request failed (500): busy' }), 'rejected', 'a controller HTTP status is a rejection');
        assert.equal(classifyReply({ result: -1, text: 'Machine connection ended before command execution.' }), 'not-sent');
    }],

    ['accepted payloads that restore their own modes, deliberate G55 and not-sent items are not exposure', () => {
        const exposure = assessExposure([
            { gcode: 'G53\nG0 Z0\nG54', modal: ['G53', 'G54'], connection: 'c', outcome: 'accepted' },
            { gcode: 'G91\nG0 X1\nG90', modal: ['G91', 'G90'], connection: 'c', outcome: 'accepted' },
            { gcode: 'G55', modal: ['G55'], connection: 'c', outcome: 'accepted' },
            { gcode: 'G91\nG0 X1', modal: ['G91'], connection: 'c', outcome: 'not-sent' },
        ]);
        assert.equal(exposure.exposed, false);
    }],

    ['a successful call that left G53 is reported, never followed by commands', async () => {
        const h = harness();
        h.registry.register({
            name: 'ok_tool',
            description: '',
            inputSchema: {},
            handler: async () => { fakeSend(h.connA, 'G53', 'accepted'); return { ok: true }; },
        });
        const result = await h.registry.call('ok_tool', {}) as { ok: boolean; failure_recovery?: RecoveryEvidence };
        assert.equal(h.sent.length, 0, 'a success is never followed by commands');
        assert.equal(result.ok, true);
        assert.equal(result.failure_recovery?.status, 'skipped');
        assert.equal(result.failure_recovery?.skip_reason, 'call-succeeded-with-modal-exposure');
        assert.equal(result.failure_recovery?.recovery_action, 'restore_work_frame');
        assert.ok(result.failure_recovery?.warnings[0].includes('restore_work_frame'));
    }],

    ['a success that handed the modes back carries no evidence', async () => {
        const h = harness();
        h.registry.register({
            name: 'ok_tool',
            description: '',
            inputSchema: {},
            handler: async () => { fakeSend(h.connA, 'G53;\nG28;\nG54;', 'accepted'); return { ok: true }; },
        });
        const result = await h.registry.call('ok_tool', {}) as { failure_recovery?: unknown };
        assert.equal(h.sent.length, 0);
        assert.equal(result.failure_recovery, undefined);
    }],

    ['a failure that sent nothing keeps its error text unchanged', async () => {
        const h = harness();
        failingTool(h, 'stage_tool', [], 'Refused: envelope.');
        const err = await callExpectingError(h, 'stage_tool');
        assert.equal(err.message, 'Refused: envelope.');
        assert.equal(h.sent.length, 0);
    }],

    ['read-only tools never trigger cleanup', async () => {
        const h = harness();
        failingTool(h, 'get_thing', [['G53', 'accepted']], 'read failed');
        const err = await callExpectingError(h, 'get_thing');
        assert.equal(err.message, 'read failed');
        assert.equal(h.sent.length, 0);
    }],

    ['rejected G1 after an accepted G53: G90 and G54 sent separately, no retry, original error first', async () => {
        const h = harness();
        failingTool(h, 'move_tool', [['G53', 'accepted'], ['G1 X10 F500', 'rejected']]);
        const err = await callExpectingError(h, 'move_tool');
        assert.ok(err instanceof McpToolError, 'the original error object is rethrown');
        assert.ok(err.message.startsWith('Controller rejected the move: error:22\nfailure_recovery: '), 'original message first');
        assert.deepEqual(h.sent.map((s) => s.gcode), ['G90', 'G54'], 'two separate commands, nothing else, no retry');
        assert.ok(h.sent.every((s) => s.connection === h.connA), 'same connection the operation used');
        assert.ok(h.sent.every((s) => !AXIS.test(s.gcode)), 'no axis words');
        const ev = err.failureRecovery as RecoveryEvidence;
        assert.equal(ev.status, 'attempted');
        assert.equal(ev.failure_kind, 'thrown');
        assert.deepEqual(ev.commands.map((c) => c.outcome), ['accepted', 'accepted']);
        assert.equal(ev.resulting_modes?.workspace_verified, true);
        assert.equal(ev.resulting_modes?.distance_verified, false, 'distance mode is never claimed verified');
        assert.equal(ev.resulting_modes?.distance, 'G90 accepted, distance mode unverified');
        assert.equal(ev.position.trustworthy, true);
        assert.ok(ev.warnings.some((w) => /declare G90 or G91/.test(w)), 'explicit distance-mode warning');
    }],

    ['incomplete G91 batch in a structured error result: cleanup attempted, failure stays a failure', async () => {
        const h = harness();
        h.registry.register({
            name: 'batch_tool',
            description: '',
            inputSchema: {},
            handler: async () => {
                fakeSend(h.connA, 'G91\nG0 X5\nG0 X5\nG90', 'rejected');
                return { ok: false, error: 'step 2 of 3 rejected', completed_steps: 1 };
            },
        });
        const result = await h.registry.call('batch_tool', {}) as { ok: boolean; error: string; failure_recovery: RecoveryEvidence };
        assert.equal(result.ok, false, 'never turned into a success');
        assert.equal(result.error, 'step 2 of 3 rejected');
        assert.equal(result.failure_recovery.failure_kind, 'error-result');
        assert.equal(result.failure_recovery.exposure.state.distance, 'unknown');
        assert.deepEqual(h.sent.map((s) => s.gcode), ['G90'], 'workspace untouched by the batch: only G90');
    }],

    ['timeout with a queued command: cleanup skipped, restore_work_frame named', async () => {
        const h = harness();
        failingTool(h, 'slow_tool', [['G53', 'accepted'], ['G0 X100', 'pending']], 'Move timed out after 30 s.');
        const err = await callExpectingError(h, 'slow_tool');
        const ev = err.failureRecovery as RecoveryEvidence;
        assert.equal(h.sent.length, 0, 'nothing sent behind a queued command');
        assert.ok(err.message.startsWith('Move timed out after 30 s.\nfailure_recovery: '));
        assert.equal(ev.failure_kind, 'timeout');
        assert.equal(ev.status, 'skipped');
        assert.equal(ev.skip_reason, 'commands-in-flight');
        assert.equal(ev.recovery_action, 'restore_work_frame');
        assert.equal(ev.position.trustworthy, false);
        assert.ok(ev.warnings[0].includes('SKIPPED'));
    }],

    ['cancellation / stop / probe trip: nothing sent, error class data and .partial kept', async () => {
        const h = harness();
        h.registry.register({
            name: 'probe_tool',
            description: '',
            inputSchema: {},
            handler: async () => {
                fakeSend(h.connA, 'G91\nG38.2 Z-5 F100', 'accepted');
                const err = new Error('Procedure stopped by stop_gcode_job.') as Error & { partial?: object; procedureStopped?: boolean };
                err.partial = { stations: 3 };
                err.procedureStopped = true;
                throw err;
            },
        });
        const err = await callExpectingError(h, 'probe_tool');
        assert.equal(h.sent.length, 0);
        assert.deepEqual(err.partial, { stations: 3 }, '.partial survives');
        assert.ok(!(err instanceof McpToolError), 'not converted to McpToolError (keeps its "Tool failed:" prefix)');
        assert.equal(err.failureRecovery?.skip_reason, 'stopped-or-tripped');
        assert.equal(err.failureRecovery?.recovery_action, 'restore_work_frame');
    }],

    ['a stale beat does not verify the frame, but a verified position survives a delayed heartbeat', async () => {
        const h = harness();
        // A real `verified` reading is an echo labelled machine-frame
        // (machinePosition.ts); the only beat predates the cleanup reply.
        h.state.reading = {
            reliability: 'verified', frame: 'machine-frame', reportedAt: 500, originOffset: { x: 120, y: 0, z: 0 }, machineStatus: 'idle', rawImpossibleAsMachine: true,
        };
        failingTool(h, 'g53_tool', [['G53', 'accepted']]);
        const ev = (await callExpectingError(h, 'g53_tool')).failureRecovery as RecoveryEvidence;
        assert.deepEqual(h.sent.map((s) => s.gcode), ['G90', 'G54']);
        assert.equal(ev.resulting_modes?.workspace_verified, false, 'a stale beat is not verification');
        assert.equal(ev.position.trustworthy, true, 'a verified position is not invalidated by a delayed heartbeat');
        assert.ok(/voided that echo record/.test(ev.position.note), 'says the cleanup sends voided the echo record');
        assert.ok(/get_position/.test(ev.position.note));
        assert.equal(ev.recovery_action, 'restore_work_frame');
    }],

    ['G53 restore with a ~zero work offset is unverifiable, not verified', async () => {
        const h = harness();
        h.state.reading = {
            reliability: 'heartbeat', frame: 'work-frame', reportedAt: 5000, originOffset: { x: 0.2, y: 0, z: 0 }, machineStatus: 'idle', rawImpossibleAsMachine: false,
        };
        failingTool(h, 'g53_tool', [['G53\nG0 Z-5', 'rejected']]);
        const ev = (await callExpectingError(h, 'g53_tool')).failureRecovery as RecoveryEvidence;
        assert.deepEqual(h.sent.map((s) => s.gcode), ['G90', 'G54']);
        assert.equal(ev.resulting_modes?.workspace_verified, false);
        assert.ok(/unverifiable/.test(ev.resulting_modes?.workspace || ''));
        assert.equal(ev.recovery_action, 'restore_work_frame');
    }],

    ['G53 still active can look like a work-frame beat: consistent, never verified', async () => {
        const h = harness();
        // Offset (100,100,-50), machine (200,200,100): raw (100,100,150) is a plausible
        // machine position too, so the work-frame judgement is ambiguous.
        h.state.reading = {
            reliability: 'heartbeat', frame: 'work-frame', reportedAt: 5000, originOffset: { x: 100, y: 100, z: -50 }, machineStatus: 'idle', rawImpossibleAsMachine: false,
        };
        failingTool(h, 'g53_tool', [['G53', 'accepted']]);
        const ev = (await callExpectingError(h, 'g53_tool')).failureRecovery as RecoveryEvidence;
        assert.equal(ev.resulting_modes?.workspace_verified, false);
        assert.ok(/consistent with work frame, unverified/.test(ev.resulting_modes?.workspace || ''));
        assert.equal(ev.position.trustworthy, false, 'an ambiguous frame is not a trustworthy position');
        assert.equal(ev.recovery_action, 'restore_work_frame');
    }],

    ['a beat less than one poll period after the cleanup reply does not verify', async () => {
        const h = harness();
        (h.state.reading as PositionReading).reportedAt = 2500; // reply at 1000, needs >= 3000
        failingTool(h, 'g53_tool', [['G53', 'accepted']]);
        const ev = (await callExpectingError(h, 'g53_tool')).failureRecovery as RecoveryEvidence;
        assert.equal(ev.resulting_modes?.workspace_verified, false);
    }],

    ['crash/overtravel latch or unexpected contact: nothing sent even when the message says nothing of a stop', async () => {
        const h = harness();
        h.state.authorityClosed = 'crash alarm latched (probe)';
        failingTool(h, 'probe_tool', [['G91\nG38.2 Z-5 F100', 'accepted']], 'Descent ended early at Z 12.3.');
        const ev = (await callExpectingError(h, 'probe_tool')).failureRecovery as RecoveryEvidence;
        assert.equal(h.sent.length, 0);
        assert.equal(ev.failure_kind, 'thrown', 'the message alone would not have caught it');
        assert.equal(ev.skip_reason, 'authority-closed');
        assert.equal(ev.recovery_action, 'restore_work_frame');
    }],

    ['the real crash and contact messages are classified as stops', async () => {
        for (const message of ['CRASH ALARM latched at 2026-10-05T10:00:00.000Z (probe sensor value "1").',
            'UNEXPECTED CONTACT (probe) during the descent at Z 3.2.']) {
            const h = harness();
            failingTool(h, 'probe_tool', [['G53', 'accepted']], message);
            // eslint-disable-next-line no-await-in-loop
            const ev = (await callExpectingError(h, 'probe_tool')).failureRecovery as RecoveryEvidence;
            assert.equal(h.sent.length, 0, message);
            assert.equal(ev.skip_reason, 'stopped-or-tripped', message);
        }
    }],

    ['a latch that closes between G90 and G54 stops the second command', async () => {
        const h = harness();
        h.state.reply = (gcode) => {
            if (gcode === 'G90') {
                h.state.authorityClosed = 'overtravel alarm latched (overtravel)';
            }
            return { result: 0 };
        };
        failingTool(h, 'move_tool', [['G53', 'accepted']]);
        const ev = (await callExpectingError(h, 'move_tool')).failureRecovery as RecoveryEvidence;
        assert.deepEqual(h.sent.map((s) => s.gcode), ['G90']);
        assert.equal(ev.commands[1].reply, 'blocked: authority-closed');
    }],

    ['a cleanup send with no channel is not-sent, not indeterminate', async () => {
        const h = harness();
        h.state.reply = () => { throw new NotSentError('no machine channel with a direct command path'); };
        failingTool(h, 'move_tool', [['G91', 'accepted']]);
        const ev = (await callExpectingError(h, 'move_tool')).failureRecovery as RecoveryEvidence;
        assert.equal(ev.status, 'failed');
        assert.equal(ev.commands[0].outcome, 'not-sent');
    }],

    ['a hook that throws still reports evidence: failed, modes and position unknown', async () => {
        const h = harness();
        // Everything the hook calls is guarded except the injected judge: make it
        // throw AFTER the cleanup commands went out.
        const registry = new ToolRegistry();
        registry.setFailureRecovery({
            connectionId: () => '3.1',
            send: async () => ({ result: 0 }),
            settle: async () => undefined,
            readPosition: () => h.state.reading,
            reliableForMotion: () => { throw new Error('judge exploded'); },
            jobRunning: () => false,
            manualControl: () => false,
            authorityClosed: () => null,
            now: () => 1000,
        });
        registry.register({
            name: 'move_tool',
            description: '',
            inputSchema: {},
            handler: async () => { fakeSend('3.1', 'G53', 'accepted'); throw new McpToolError('original'); },
        });
        let err: FailedError | null = null;
        try {
            await registry.call('move_tool', {});
        } catch (e) {
            err = e as FailedError;
        }
        assert.ok(err && err.message.startsWith('original\n'));
        const ev = err?.failureRecovery as RecoveryEvidence;
        assert.equal(ev.status, 'failed');
        assert.equal(ev.hook_error, 'judge exploded');
        assert.equal(ev.recovery_action, 'restore_work_frame');
        assert.ok(/UNKNOWN/.test(ev.warnings[0]));
    }],

    ['awaiting-resync after the restore stays untrustworthy and is named', async () => {
        const h = harness();
        h.state.reading = {
            reliability: 'awaiting-resync', frame: 'machine-frame', reportedAt: 5000, originOffset: { x: 120, y: 0, z: 0 }, machineStatus: 'idle', rawImpossibleAsMachine: false,
        };
        failingTool(h, 'g53_tool', [['G53', 'accepted']]);
        const ev = (await callExpectingError(h, 'g53_tool')).failureRecovery as RecoveryEvidence;
        assert.equal(ev.position.trustworthy, false);
        assert.equal(ev.position.reliability, 'awaiting-resync');
        assert.equal(ev.resulting_modes?.workspace_verified, false);
    }],

    ['connection replaced during the call: no cleanup sent to the new connection', async () => {
        const h = harness();
        h.registry.register({
            name: 'move_tool',
            description: '',
            inputSchema: {},
            handler: async () => {
                fakeSend(h.connA, 'G53', 'accepted');
                h.state.connection = '4.1';
                throw new McpToolError('Connection lost.');
            },
        });
        const ev = (await callExpectingError(h, 'move_tool')).failureRecovery as RecoveryEvidence;
        assert.equal(h.sent.length, 0);
        assert.equal(ev.skip_reason, 'connection-replaced');
        assert.equal(ev.connection.at_start, '3.1');
        assert.equal(ev.connection.at_cleanup, '4.1');
    }],

    ['connection replaced between the two cleanup commands: the second is not sent', async () => {
        const h = harness();
        h.state.reply = (gcode) => {
            if (gcode === 'G90') {
                h.state.connection = '4.1';
            }
            return { result: 0 };
        };
        failingTool(h, 'move_tool', [['G53', 'accepted']]);
        const ev = (await callExpectingError(h, 'move_tool')).failureRecovery as RecoveryEvidence;
        assert.deepEqual(h.sent.map((s) => s.gcode), ['G90']);
        assert.equal(ev.status, 'failed');
        assert.equal(ev.commands[1].reply, 'blocked: connection-replaced');
    }],

    ['disconnected: no cleanup, command authority closed', async () => {
        const h = harness();
        h.registry.register({
            name: 'move_tool',
            description: '',
            inputSchema: {},
            handler: async () => {
                fakeSend(h.connA, 'G91', 'accepted');
                h.state.connection = null;
                throw new McpToolError('Disconnected.');
            },
        });
        const ev = (await callExpectingError(h, 'move_tool')).failureRecovery as RecoveryEvidence;
        assert.equal(h.sent.length, 0);
        assert.equal(ev.skip_reason, 'disconnected');
    }],

    ['another MCP operation in flight: cleanup is not injected into it', async () => {
        const h = harness();
        let release: () => void = () => undefined;
        h.registry.register({
            name: 'long_tool',
            description: '',
            inputSchema: {},
            handler: async () => new Promise((resolve) => { release = () => resolve({ ok: true }); }),
        });
        failingTool(h, 'move_tool', [['G53', 'accepted']]);
        const longCall = h.registry.call('long_tool', {});
        const ev = (await callExpectingError(h, 'move_tool')).failureRecovery as RecoveryEvidence;
        release();
        await longCall;
        assert.equal(h.sent.length, 0);
        assert.equal(ev.skip_reason, 'another-operation-active');
        assert.ok(ev.explanation.includes('long_tool'));
    }],

    ['a running job blocks cleanup', async () => {
        const h = harness();
        h.state.jobRunning = true;
        failingTool(h, 'move_tool', [['G53', 'accepted']]);
        const ev = (await callExpectingError(h, 'move_tool')).failureRecovery as RecoveryEvidence;
        assert.equal(h.sent.length, 0);
        assert.equal(ev.skip_reason, 'another-operation-active');
    }],

    ['a machine that is not idle gets no cleanup', async () => {
        const h = harness();
        (h.state.reading as PositionReading).machineStatus = 'running';
        failingTool(h, 'move_tool', [['G53', 'accepted']]);
        const ev = (await callExpectingError(h, 'move_tool')).failureRecovery as RecoveryEvidence;
        assert.equal(h.sent.length, 0);
        assert.equal(ev.skip_reason, 'machine-not-idle');
    }],

    ['cleanup failure: G90 rejected, G54 not sent, status failed, warned', async () => {
        const h = harness();
        h.state.reply = (gcode) => (gcode === 'G90' ? { result: -1, text: 'error:busy' } : { result: 0 });
        failingTool(h, 'move_tool', [['G53', 'accepted']]);
        const ev = (await callExpectingError(h, 'move_tool')).failureRecovery as RecoveryEvidence;
        assert.deepEqual(h.sent.map((s) => s.gcode), ['G90'], 'stops at the first failed cleanup command');
        assert.equal(ev.status, 'failed');
        assert.deepEqual(ev.commands.map((c) => `${c.gcode}=${c.outcome}`), ['G90=rejected', 'G54=not-sent']);
        assert.equal(ev.resulting_modes, null);
        assert.ok(ev.warnings[0].includes('INCOMPLETE'));
    }],

    ['cleanup send that throws is reported, not propagated over the original error', async () => {
        const h = harness();
        h.state.reply = () => { throw new Error('socket closed'); };
        failingTool(h, 'move_tool', [['G91', 'accepted']], 'original');
        const err = await callExpectingError(h, 'move_tool');
        assert.ok(err.message.startsWith('original\n'));
        assert.equal(err.failureRecovery?.status, 'failed');
        assert.equal(err.failureRecovery?.commands[0].outcome, 'indeterminate');
        assert.equal(err.failureRecovery?.commands[0].reply, 'socket closed');
    }],

    ['sends outside a tool call are not attributed to any ledger', () => {
        // No throw, no state: the pendant and background pollers use the same send path.
        const settle = recordModalSend('1.0', 'G53');
        settle('accepted');
    }],

    ['a detached background send still pending does not make a successful start look exposed', async () => {
        const h = harness();
        h.registry.register({
            name: 'start_tool',
            description: '',
            inputSchema: {},
            handler: async () => {
                // A runner launched off the call and never settling within it.
                detachFromLedger(async () => { fakeSend(h.connA, 'G53', 'pending'); }).catch(() => undefined);
                return { running: true };
            },
        });
        const result = await h.registry.call('start_tool', {}) as { running: boolean; failure_recovery?: unknown };
        assert.equal(result.running, true);
        assert.equal(result.failure_recovery, undefined);
        assert.equal(h.sent.length, 0);
    }],

    ['a payload still pending when a call succeeds is not reported as that call\'s exposure', async () => {
        const h = harness();
        h.registry.register({
            name: 'start_tool',
            description: '',
            inputSchema: {},
            handler: async () => { fakeSend(h.connA, 'G53', 'pending'); return { running: true }; },
        });
        const result = await h.registry.call('start_tool', {}) as { failure_recovery?: unknown };
        assert.equal(result.failure_recovery, undefined);
    }],

    ['a success under a running job is not reported', async () => {
        const h = harness();
        h.state.jobRunning = true;
        h.registry.register({
            name: 'ok_tool',
            description: '',
            inputSchema: {},
            handler: async () => { fakeSend(h.connA, 'G53', 'accepted'); return { ok: true }; },
        });
        const result = await h.registry.call('ok_tool', {}) as { failure_recovery?: unknown };
        assert.equal(result.failure_recovery, undefined);
    }],

    ['two concurrent calls record their sends on their own ledgers', async () => {
        const h = harness();
        const tick = async () => new Promise<void>((resolve) => { setTimeout(resolve, 5); });
        h.registry.register({
            name: 'g53_ok',
            description: '',
            inputSchema: {},
            handler: async () => { await tick(); fakeSend(h.connA, 'G53', 'accepted'); await tick(); return { ok: true }; },
        });
        h.registry.register({
            name: 'g91_ok',
            description: '',
            inputSchema: {},
            handler: async () => { fakeSend(h.connA, 'G91', 'accepted'); await tick(); await tick(); return { ok: true }; },
        });
        const [a, b] = await Promise.all([h.registry.call('g53_ok', {}), h.registry.call('g91_ok', {})]) as Array<{ failure_recovery: RecoveryEvidence }>;
        assert.deepEqual(a.failure_recovery.exposure.state, { workspace: 'G53', distance: 'G90' });
        assert.deepEqual(b.failure_recovery.exposure.state, { workspace: 'G54', distance: 'G91' });
    }],

    ['restore_work_frame failing is reported, never retried by the hook', async () => {
        const h = harness();
        failingTool(h, 'restore_work_frame', [['G90', 'rejected']], 'G90 rejected: error:busy');
        const err = await callExpectingError(h, 'restore_work_frame');
        assert.equal(h.sent.length, 0, 'the recovery tool is not retried');
        assert.equal(err.failureRecovery?.skip_reason, 'restore-tool-itself');
        assert.ok(err.failureRecovery?.warnings[0].includes('SKIPPED'));
    }],

    ['a timeout that quotes a stopped machine status is a timeout, not a stop', async () => {
        const h = harness();
        failingTool(h, 'home', [['G53', 'accepted']], 'Homing timed out after 60 s (machineStatus stopped, cancel pending).');
        const ev = (await callExpectingError(h, 'home')).failureRecovery as RecoveryEvidence;
        assert.equal(ev.failure_kind, 'timeout');
        assert.deepEqual(h.sent.map((s) => s.gcode), ['G90', 'G54']);
        assert.equal(classifyFailure(true, new Error('Stopped on request (agent) at a step boundary'), undefined), 'stopped');
        assert.equal(classifyFailure(true, new Error('Probe failed: UNEXPECTED CONTACT at Z3'), undefined), 'stopped');
        assert.equal(classifyFailure(true, new Error('OVERTRAVEL ALARM latched at 10:00'), undefined), 'stopped');
        assert.equal(classifyFailure(true, new Error('the job was stopped'), undefined), 'thrown');
    }],

    ['an unknown G55-G59 selection is warned about, never reset to G54', async () => {
        const h = harness();
        failingTool(h, 'ws_tool', [['G55', 'rejected']]);
        const ev = (await callExpectingError(h, 'ws_tool')).failureRecovery as RecoveryEvidence;
        assert.equal(h.sent.length, 0, 'distance known G90 and no G53: nothing to restore');
        assert.equal(ev.skip_reason, 'workspace-selection-unknown');
        assert.ok(ev.warnings.some((w) => /G55-G59/.test(w)));

        const h2 = harness();
        failingTool(h2, 'ws_tool', [['G55\nG91', 'rejected']]);
        const ev2 = (await callExpectingError(h2, 'ws_tool')).failureRecovery as RecoveryEvidence;
        assert.deepEqual(h2.sent.map((s) => s.gcode), ['G90'], 'G90 for the distance, no G54');
        assert.ok(ev2.warnings.some((w) => /G55-G59/.test(w)));

        const h3 = harness();
        failingTool(h3, 'ws_tool', [['G53', 'accepted'], ['G55', 'rejected']]);
        await callExpectingError(h3, 'ws_tool');
        assert.deepEqual(h3.sent.map((s) => s.gcode), ['G90', 'G54'], 'G53 may still be active behind the unknown selection');
    }],

    ['the machine leaving idle between G90 and G54 stops the second command', async () => {
        const h = harness();
        h.state.reply = (gcode) => {
            if (gcode === 'G90') {
                (h.state.reading as PositionReading).machineStatus = 'running';
            }
            return { result: 0 };
        };
        failingTool(h, 'move_tool', [['G53', 'accepted']]);
        const ev = (await callExpectingError(h, 'move_tool')).failureRecovery as RecoveryEvidence;
        assert.deepEqual(h.sent.map((s) => s.gcode), ['G90']);
        assert.equal(ev.commands[1].reply, 'blocked: machine-not-idle');
    }],

    ['an error whose message cannot be rewritten is rethrown untouched', async () => {
        const h = harness();
        const frozen = new McpToolError('original');
        Object.defineProperty(frozen, 'message', { value: 'original', writable: false });
        h.registry.register({
            name: 'move_tool',
            description: '',
            inputSchema: {},
            handler: async () => { fakeSend(h.connA, 'G53', 'accepted'); throw frozen; },
        });
        const err = await callExpectingError(h, 'move_tool');
        assert.equal(err, frozen);
        assert.equal(err.message, 'original');
    }],
];
