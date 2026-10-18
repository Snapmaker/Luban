const test = require('tape');
const getWindowBounds = require('../src/electron-app/window-bounds').default;

const laptop = { id: 33, workArea: { x: 0, y: 28, width: 1366, height: 700 } };

test('oversized saved Ubuntu window fits the same display without adding another frame', (t) => {
    const result = getWindowBounds(laptop, { id: 33, x: 127, y: 75, width: 1024, height: 1008 });
    t.equal(result.height, 700);
    t.equal(result.y, 28);
    t.equal(result.x, 127);
    t.equal(result.width, 1024);
    t.equal(result.useContentSize, false, 'saved outer bounds remain outer bounds');
    t.ok(result.minHeight <= laptop.workArea.height, 'minimum does not block maximizing');
    t.deepEqual(getWindowBounds(laptop, result), result, 'repeated restores do not grow');
    t.end();
});

test('first launch and display changes fit the usable work area', (t) => {
    const fresh = getWindowBounds(laptop);
    t.equal(fresh.width, 1366);
    t.equal(fresh.height, 700);
    t.equal(fresh.x, 0);
    t.equal(fresh.y, 28);
    const monitor = { id: 42, workArea: { x: -1920, y: 0, width: 1920, height: 1080 } };
    const moved = getWindowBounds(monitor, { id: 33, x: 127, y: 75, width: 1024, height: 708 });
    t.equal(moved.x, -1472);
    t.equal(moved.y, 186);
    t.end();
});

test('changed scaling and offscreen positions cannot hide window controls', (t) => {
    const small = { id: 33, workArea: { x: 40, y: 30, width: 800, height: 600 } };
    const result = getWindowBounds(small, { id: 33, x: -1000, y: 900, width: 1440, height: 900 });
    t.equal(result.minWidth, 800);
    t.equal(result.minHeight, 600);
    t.equal(result.x, 40);
    t.equal(result.y, 30);
    t.equal(result.width, 800);
    t.equal(result.height, 600);
    t.end();
});
