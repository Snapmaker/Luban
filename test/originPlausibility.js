import { test } from 'tape';
import { originMoveNeedsConfirm } from '../src/app/lib/originPlausibility';

test('originMoveNeedsConfirm flags meaningful descent below current Z', (t) => {
    t.equal(originMoveNeedsConfirm({ currentZ: 5, targetZ: 0 }), true, 'descending 5mm to origin => confirm');
    t.equal(originMoveNeedsConfirm({ currentZ: 0.5, targetZ: 0 }), false, 'tiny descent within margin => ok');
    t.equal(originMoveNeedsConfirm({ currentZ: 0, targetZ: 0 }), false, 'same level => ok');
    t.equal(originMoveNeedsConfirm({ currentZ: 0, targetZ: 10 }), false, 'ascending => ok');
    t.equal(originMoveNeedsConfirm({ currentZ: 5, targetZ: 0, margin: 10 }), false, 'large margin suppresses confirm');
    t.equal(originMoveNeedsConfirm({ currentZ: NaN, targetZ: 0 }), false, 'unknown current => no confirm (do not block)');
    t.end();
});
