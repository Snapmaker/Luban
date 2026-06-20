import { test } from 'tape';
import { deriveHeadStatus } from '../src/server/services/machine/channels/laserState';

test('deriveHeadStatus', (t) => {
    t.equal(deriveHeadStatus(0), false, 'zero power => off');
    t.equal(deriveHeadStatus(5), true, 'positive power => on');
    t.equal(deriveHeadStatus(0.1), true, 'fractional positive power => on');
    t.equal(deriveHeadStatus(undefined), undefined, 'unknown power => undefined (do not assert)');
    t.equal(deriveHeadStatus(null), undefined, 'null power => undefined');
    t.end();
});
