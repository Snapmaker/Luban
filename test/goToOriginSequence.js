import { test } from 'tape';
import { sequenceGoToOrigin } from '../src/app/lib/goToOriginSequence';

test('sequenceGoToOrigin orders Z safely', (t) => {
    t.deepEqual(sequenceGoToOrigin({ z: 5 }, 1500),
        ['G0 X0 Y0 B0 F1500', 'G0 Z0 F1500'],
        'above origin: XY first, then descend Z last');
    t.deepEqual(sequenceGoToOrigin({ z: -2 }, 1500),
        ['G0 Z0 F1500', 'G0 X0 Y0 B0 F1500'],
        'below origin: raise Z first, then XY');
    t.deepEqual(sequenceGoToOrigin({ z: 0 }, 800),
        ['G0 Z0 F800', 'G0 X0 Y0 B0 F800'],
        'at origin: Z first (no diagonal), honors feed');
    t.deepEqual(sequenceGoToOrigin({ z: 5 }, 1500, true),
        ['G0 X0 Y0 B0 Z0 F1500'],
        'diagonal mode: single move, all axes at once');
    t.deepEqual(sequenceGoToOrigin({ z: -2 }, 1500, true),
        ['G0 X0 Y0 B0 Z0 F1500'],
        'diagonal mode ignores current Z (single combined move)');
    t.end();
});
