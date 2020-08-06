import path from 'path';
import fs from 'fs';
import DataStorage from '../../src/server/DataStorage';
import CncMeshToolPathGenerator from '../../src/server/lib/ToolPathGenerator/MeshToolPath/CncMeshToolPathGenerator';

DataStorage.tmpDir = path.join(__dirname, './input');

const parseAsCNC = (toolPathObj) => {
    const gcodeLines = [];
    for (let i = 0; i < toolPathObj.length; i++) {
        const item = toolPathObj[i];
        let line = '';
        const cmds = [];
        let comment = null;
        Object.keys(item).forEach((key) => {
            // C: comment  N: empty line
            if (['C', 'N'].includes(key)) {
                comment = item[key];
            } else {
                let value = item[key];

                if (key === 'X' || key === 'Y' || key === 'Z' || key === 'B') {
                    if (key === 'B') {
                        value = -value;
                    }
                    cmds.push(key + value.toFixed(2)); // restrict precision
                } else {
                    cmds.push(key + value); // restrict precision
                }
            }
        });
        if (cmds.length > 0) {
            line = cmds.join(' ');
        }
        if (comment) {
            line += comment;
        }
        gcodeLines.push(line);
    }
    return gcodeLines;
};

function process() {
    const mesh = new CncMeshToolPathGenerator({ uploadName: 'scad_chess_knight.stl', isRotate: true, diameter: 36, gcodeConfig: { density: 5, toolAngle: 20, jogSpeed: 600, workSpeed: 200 } });
    // const mesh = new MeshToolPathGenerator({ uploadName: 'cube.stl', isRotate: true });
    const data = mesh.generateToolPathObj();

    console.log(data.estimatedTime);

    const header = `${';Header Start\n'
        + ';header_type: cnc\n'
        + ';renderMethod: line\n'
        + ';file_total_lines: '}${data.data.length}\n`
        + ';estimated_time(s): 0\n'
        + ';is_rotate: true\n'
        + ';diameter: 32\n'
        + ';is_cw: undefined\n'
        + ';max_x(mm): 15.34285\n'
        + ';max_y(mm): 13.9982\n'
        + ';max_z(mm): 47.742999999999995\n'
        + ';max_b(mm): 0\n'
        + ';min_x(mm): -15.34285\n'
        + ';min_y(mm): -13.9982\n'
        + ';min_b(mm): 0\n'
        + ';work_speed(mm/minute): 300\n'
        + ';jog_speed(mm/minute): 3000\n'
        + ';power(%): 0\n';

    fs.writeFileSync(path.join(__dirname, './output/d.cnc'), header + parseAsCNC(data.data).join('\n'), 'utf8');
}

process();
