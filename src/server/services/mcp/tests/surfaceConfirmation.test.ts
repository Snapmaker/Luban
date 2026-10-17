/* eslint-disable import/no-dynamic-require */
import { strict as assert } from 'assert';
import Module from 'module';

import { surfaceFixture } from './probeInspection.test';

export const tests: Array<[string, () => void | Promise<void>]> = [];

for (const mode of ['adaptive', 'fixed'] as const) {
    for (const failure of ['release-failed', 'contact-lost'] as const) {
        tests.push([`${mode} surface preserves ${failure} evidence without adding recovery motion`, async () => {
            const f = surfaceFixture({ mode, stuckRetouch: failure === 'release-failed', lostRetouch: failure === 'contact-lost' });
            await assert.rejects(f.run(), (err: any) => {
                assert.match(err.message, failure === 'release-failed' ? /hysteresis exceeds/ : /lost the contact/);
                assert.equal(err.partial.contactCount, 0);
                assert.deepEqual(err.partial.uncertainStations, ['s1']);
                const station = err.partial.stations[0];
                assert.equal(station.status, 'uncertain');
                assert.equal(station.z, null);
                assert.equal(station.initialContactZ, 200);
                assert.equal(station.finalContactZ, undefined, 'do not invent a completed retouch');
                assert.equal(station.spreadMm, null);
                assert.equal(station.confirmationFailure, failure);
                assert.equal(station.confirmationPassesAttempted, 1);
                assert.equal(station.extraPassCount, 0);
                assert.deepEqual(station.confirmPassContacts, []);
                assert.equal(err.partial.summary, null);
                return true;
            });
            const backoff = f.moves.findIndex((m) => m.tag.includes(':backoff'));
            assert.ok(backoff >= 0);
            assert.ok(!f.moves.some((m) => /:retract|^link:|:final-raise/.test(m.tag)), 'failure goes straight to existing abort recovery');
            assert.equal(f.moves[f.moves.length - 1].tag, 'abort-recovery');
            if (failure === 'release-failed') {
                assert.deepEqual(f.moves.slice(backoff + 1).map((m) => m.tag), ['release-check', 'abort-recovery']);
            }
        }]);
    }
}

tests.push(['surface staging instructions describe the actual lift in both hop modes', async () => {
    const { plan } = surfaceFixture();
    const registrations: { [key: string]: any } = {};
    const target = require.resolve('../tools/probing');
    const loader = Module as unknown as { _load: (id: string, parent: { filename: string }, main: boolean) => unknown };
    const old = loader._load;
    const mocks: { [key: string]: unknown } = {
        '../registry': { McpToolError: Error },
        '../probeFeed': { probeFeedService: { assertNoOvertravel: () => undefined } },
        '../probeSurface': {
            planProbeSurfacePath: () => plan, planProbeSurfaceGrid: () => plan,
            describeProbeSurfacePlanAsGcode: () => '; mocked review envelope',
            runProbeSurfaceProcedure: () => { throw new Error('staging must not run motion'); },
        },
        '../jobs': { jobManager: { submit: () => ({ id: 'review' }), describe: () => ({ id: 'review' }) } },
        './staging': { validateStagedEnvelope: () => ({ valid: true }) },
    };
    // Mock every direct dependency: importing the registration module must not
    // load the server, settings, camera, connection manager or machine tools.
    loader._load = (id, parent, main) => (parent?.filename === target ? mocks[id] || {} : old(id, parent, main));
    delete require.cache[target];
    let register: any;
    try { register = require(target).registerProbingTools; } finally { loader._load = old; delete require.cache[target]; }
    register({ register: (tool: any) => { registrations[tool.name] = tool; } }, () => 'http://example.test');
    for (const mode of ['stepped', 'guarded']) {
        plan.hopMode = mode;
        for (const name of ['probe_surface_path', 'probe_surface_grid']) {
            const staged = await registrations[name].handler({ reason: 'Review only' });
            assert.ok(staged.next_step.includes(`${mode} hops at last contact + ${mode === 'stepped' ? 0.5 : 20} mm`));
            assert.equal(staged.confirm_url, 'http://example.test/confirm/review');
        }
    }
}]);
