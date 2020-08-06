import fs from 'fs';
import path from 'path';

// const p = path.join(__dirname, './input/t3.cnc');
// const o = path.join(__dirname, './input/t5.cnc');
//
// for (let i = 0; i < ds.length; i++) {
//     const dd = ds[i];
//     const kv = dd.split(' ');
//     for (let i = 0; i < kv.length; i++) {
//         if (kv[i].indexOf('Y') !== -1) {
//             const v = parseFloat(kv[i].slice(1));
//             kv[i] = `B${-v}`;
//         }
//     }
//     ds[i] = kv.join(' ');
// }

function getSplit(input, output, y1, y2) {
    const data = fs.readFileSync(path.join(__dirname, input), 'utf8');
    const datas = data.split('\n');
    let start = 0;
    let end = 0;
    for (let i = 0; i < datas.length; i++) {
        const dd = datas[i];
        if (dd.indexOf(y1) !== -1 && start === 0) {
            start = i;
        }
        if (dd.indexOf(y2) !== -1 && end === 0) {
            end = i;
        }
        if (start && end) {
            break;
        }
    }

    const header = `${datas[start].replace('G1', 'G0')}\n`;

    fs.writeFileSync(path.join(__dirname, output), `G0 Z18\n${header}${datas.slice(start - 2, end).join('\n')}`, 'utf8');
}

function addD(input, output, angle = 5) {
    const dataF = fs.readFileSync(path.join(__dirname, input), 'utf8');
    const datas = dataF.split('\n');

    const res = [];
    let lastB = 0;

    for (const data of datas) {
        res.push(data);
        const kv = data.split(' ');
        for (let i = 0; i < kv.length; i++) {
            if (kv[i].indexOf('B') !== -1) {
                const v = parseFloat(kv[i].slice(1));
                if (data.indexOf('G1') !== -1 && Math.abs(v - lastB) > angle) {
                    lastB = v;
                    res.push('G91');
                    res.push('G1 Z0.6');
                    res.push('G1 Z-0.6');
                    res.push('G90');
                }
            }
        }
    }
    fs.writeFileSync(path.join(__dirname, output), res.join('\n'), 'utf8');
}

function range(dt, start, end, angle = 5) {
    const file = `${dt + start}-${end}.cnc`;
    const file2 = `${dt + start}-${end}.2.cnc`;
    getSplit(`./input/${dt}.cnc`, `./output/${file}`, `Y${start}`, `Y${end}`);
    addD(`./output/${file}`, `./output/${file2}`, angle);
}

// getSplit('./input/t.cnc', './output/t30-35.cnc', 'Y30', 'Y35');
// addD('./output/d20.1-20.3.cnc', './output/d20.1-20.3-2.cnc', 1);

// getSplit('./input/d.cnc', './output/d43.9-44.3.cnc', 'Y43.9', 'Y44.3');
// getSplit('./input/d.cnc', './output/d20.1-20.3.cnc', 'Y20.1', 'Y20.5');
// addD('./output/d20.1-20.3.cnc', './output/d20.1-20.3-2.cnc', 1);
// addD('./output/t12-12.1.cnc', './output/t12-12.1-2.cnc');
// addD('./output/d43.1-44.3.cnc', './output/d43.1-44.3-2.cnc');
// addD('./output/d.cnc', './output/d-2.cnc');

// range('t', 30, 30.1, 1);
range('h', 50, 50.2, 1);
// range('d', 27.1, 27.3, 1);
