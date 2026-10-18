import { strict as assert } from 'assert';

import { McpJobKind, McpJobState, classifyProcedureEnding, countMeasured, planJobStop } from '../jobEnding';
import { ProcedureAbort, ProcedureStopped, isProcedureAbort, isProcedureStopped } from '../procedureAbort';

const T = 1_000;

export const tests: Array<[string, () => void]> = [
    ['a stop_gcode_job stop is stopped-by-agent and keeps the measured count', () => {
        const e = classifyProcedureEnding({
            message: 'Stopped on request (stop_gcode_job by the agent) at a step boundary, 27 ms after the request.',
            stopReason: 'stop_gcode_job by the agent',
            trip: null,
            at: T,
            measured: 52,
        });
        assert.equal(e.kind, 'stopped-by-agent');
        assert.equal(e.measured, 52);
        assert.ok(e.reason.startsWith('stop_gcode_job by the agent'));
    }],

    ['an operator-worded stop is stopped-by-operator', () => {
        assert.equal(classifyProcedureEnding({ message: 'x', stopReason: 'Workspace stop button (operator)', trip: null, at: T }).kind, 'stopped-by-operator');
    }],

    ['a latched trip wins over everything else', () => {
        assert.equal(classifyProcedureEnding({ message: 'UNEXPECTED CONTACT', stopReason: 'agent', trip: { kind: 'crash', channel: 'probe' }, at: T }).kind, 'crash-alarm');
        const o = classifyProcedureEnding({ message: 'x', stopReason: null, trip: { kind: 'overtravel', channel: 'overtravel' }, at: T });
        assert.equal(o.kind, 'overtravel-alarm');
        assert.equal(o.channel, 'overtravel');
    }],

    ['message signatures: unexpected contact, controller refusal, timeout, otherwise failure', () => {
        const k = (m: string) => classifyProcedureEnding({ message: m, stopReason: null, trip: null, at: T }).kind;
        assert.equal(k('UNEXPECTED CONTACT (probe) during the descent at Z200'), 'unexpected-contact');
        assert.equal(k('Controller rejected the move: error'), 'controller-rejected');
        assert.equal(k('Timed out waiting for the heartbeat to verify the move'), 'timeout');
        assert.equal(k('Rotation to B90 not confirmed within 120 s'), 'timeout');
        assert.equal(k('Station "s7": fine approach lost the contact.'), 'operation-failure');
    }],

    ['countMeasured understands stations, results, ops and contacts', () => {
        assert.equal(countMeasured({ stations: [{ status: 'contact' }, { status: 'no_contact' }, { status: 'contact' }] }), 2);
        assert.equal(countMeasured({ results: [{ z: 1 }, { z: 2 }] }), 2);
        assert.equal(countMeasured({ ops: [{ status: 'completed' }, { status: 'failed' }, { status: 'skipped' }] }), 1);
        assert.equal(countMeasured({ contacts: [{ contactMachine: {} }] }), 1);
        assert.equal(countMeasured(null), undefined);
        assert.equal(countMeasured({ note: 'x' }), undefined);
    }],

    ['ProcedureAbort / ProcedureStopped are recognised by marker even after the prototype chain is lost', () => {
        const stopped = new ProcedureStopped('stop', { stations: [1, 2] });
        const abort = new ProcedureAbort('boom');
        assert.ok(isProcedureAbort(stopped) && isProcedureStopped(stopped));
        assert.ok(isProcedureAbort(abort) && !isProcedureStopped(abort));
        assert.equal(stopped.name, 'ProcedureStopped');
        assert.deepEqual(stopped.partial, { stations: [1, 2] });
        // Simulate a down-levelled build: instanceof would now be false.
        Object.setPrototypeOf(stopped, Error.prototype);
        assert.equal(stopped instanceof ProcedureStopped, false);
        assert.ok(isProcedureStopped(stopped), 'the marker survives');
        assert.ok(!isProcedureAbort(new Error('plain')));
        assert.ok(!isProcedureAbort(null));
    }],

    // A2: stopping a job that never reached the machine. Live 2026-09-19 the
    // agent could not withdraw a staged direct job and had to tell its
    // operator in prose "do not approve job 245869890315".
    ['a job that never reached the machine is withdrawn, whatever its kind', () => {
        const kinds: McpJobKind[] = ['file', 'direct', 'procedure'];
        const states: McpJobState[] = ['awaiting_confirmation', 'approved'];
        for (const kind of kinds) {
            for (const state of states) {
                const plan = planJobStop(kind, state);
                assert.equal(plan.action, 'withdraw', `${kind}/${state}`);
                assert.ok(/confirm link is dead/.test(plan.note), `${kind}/${state} says the link is dead`);
            }
        }
    }],

    ['a running procedure is asked to stop at a step boundary, not withdrawn', () => {
        assert.equal(planJobStop('procedure', 'started').action, 'request-procedure-stop');
        // 'starting' keeps the pre-existing behaviour: the runner has not begun.
        assert.equal(planJobStop('procedure', 'starting').action, 'withdraw');
    }],

    ['a file or direct job already handed to the machine gets the firmware stop', () => {
        assert.equal(planJobStop('file', 'started').action, 'machine-stop');
        assert.equal(planJobStop('file', 'starting').action, 'machine-stop');
        assert.equal(planJobStop('file', 'start_unverified').action, 'machine-stop');
        assert.equal(planJobStop('direct', 'started').action, 'machine-stop');
    }],

    ['a terminal job is already ended, whatever its kind', () => {
        const kinds: McpJobKind[] = ['file', 'direct', 'procedure'];
        const terminal: McpJobState[] = ['rejected', 'start_failed', 'stopped', 'completed'];
        for (const kind of kinds) {
            for (const state of terminal) {
                assert.equal(planJobStop(kind, state).action, 'already-ended', `${kind}/${state}`);
            }
        }
    }],
];
