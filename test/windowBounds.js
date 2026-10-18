const test = require('tape');
const windowBounds = require('../src/electron-app/window-bounds').default;
const getWindowBounds = (display, saved) => windowBounds(display, saved, 'win32');

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

test('Linux native decorations fit outside the restored client and minimum-size hints', (t) => {
    const ubuntu = { id: 33, workArea: { x: 67, y: 32, width: 1299, height: 736 } };
    const saved = { id: 33, x: 88, y: 69, width: 1161, height: 836 };
    const result = windowBounds(ubuntu, saved, 'linux');
    t.equal(result.minHeight, 672, 'minimum leaves room for the external title bar');
    t.ok(result.minHeight + 37 <= ubuntu.workArea.height, 'GNOME can satisfy its maximized client size');
    t.ok(result.y + result.height + 37 <= 768, 'restored frame fits above the bottom of the display');
    t.equal(result.height, 672, 'oversized client is clamped with a frame allowance');
    t.equal(result.y, 32, 'oversized restore moves back into the work area');
    t.equal(result.useContentSize, false, 'the native menu is already included in saved bounds');
    t.deepEqual(windowBounds(ubuntu, result, 'linux'), result, 'repeated restores do not shrink');
    const small = windowBounds({ id: 1, workArea: { x: 0, y: 0, width: 800, height: 600 } }, null, 'linux');
    t.ok(small.minWidth < 800 && small.minHeight < 600, 'small displays retain frame space in both dimensions');
    const desktop = windowBounds({ id: 2, workArea: { x: 0, y: 0, width: 1920, height: 1080 } }, null, 'linux');
    t.equal(desktop.minHeight, 708, 'large displays retain the preferred minimum');
    t.end();
});
