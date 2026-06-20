import { test } from 'tape';
import { buildSetWorkOriginGcode } from '../src/server/services/machine/setWorkOriginGcode';

test('buildSetWorkOriginGcode includes zero-valued axes', (t) => {
    t.equal(buildSetWorkOriginGcode({ x: 0, y: 0, z: 0 }), 'G92 X0 Y0 Z0', 'all zeros included');
    t.equal(buildSetWorkOriginGcode({ x: 10, z: 0 }), 'G92 X10 Z0', 'zero Z included with nonzero X');
    t.equal(buildSetWorkOriginGcode({ b: 0 }), 'G92 B0', 'zero B axis included');
    t.equal(buildSetWorkOriginGcode({ x: 1, y: 2, z: 3, b: 4 }), 'G92 X1 Y2 Z3 B4', 'all axes');
    t.equal(buildSetWorkOriginGcode({}), 'G92', 'no axes => bare G92');
    t.equal(buildSetWorkOriginGcode({ x: undefined, y: null }), 'G92', 'undefined/null axes skipped');
    t.end();
});
