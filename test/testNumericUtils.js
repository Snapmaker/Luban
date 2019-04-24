import { test } from 'tap';
import { toFixed } from '../src/app/lib/numeric-utils';


test('toFixed', (t) => {
    t.equal(String(toFixed(3, 1)), '3');
    t.equal(String(toFixed(3.2, 2)), '3.2');
    t.equal(String(toFixed(3.23, 1)), '3.2');
    t.equal(String(toFixed(3.233, 2)), '3.23');

    t.end();
});
