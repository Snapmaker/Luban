import { test } from 'tape';

function parseDAttribute(value) {
    const items = [];

    const re = /([A-Za-z]|(-?(([0-9]+\.?[0-9]*)|(\.[0-9]+))(e-?[0-9]*)?))/g;
    let m = re.exec(value);
    while (m) {
        const f = parseFloat(m[1]);
        if (Number.isNaN(f)) {
            // command
            items.push(m[1]);
        } else {
            // number
            items.push(f);
        }
        m = re.exec(value);
    }

    return items;
}


test('DAttribute', (t) => {
    const items = parseDAttribute('M132.24,197.77c-.36,3.07.72,4.15,2.16,4.15,2,0,4.51-2.89,7.58-13.71h1.8c-7.76,30.49-28.86,37-45.28,37-21.65,0-    35.54-13.89-30.85-51.78l.18-1.44a453,453,0,0,0,9.74-76.49H76.31L63.5,191.09c-1.26,10.11-4.33,26.7,1.63,29.95l-.36.54a185.83,185.83,    0,0,1-27.07,2.17C15,223.75-2,216.53,1.44,191.09l8.3-63c1.26-10.1,4.87-27.78-1.08-31L9,96.56c11-1.62,46.18-3.43,68.19-3.43,40.41,0,6    3.87,11.55,64.05,37.89.18,29.59-26.88,37.34-71.8,41.13v1.26c13-1.26,24.35-2.34,33.73-2.34,21.11,0,31.57,9.56,29.41,24.17Z');

    for (const item of items) {
        console.log(item);
    }

    t.end();
});
