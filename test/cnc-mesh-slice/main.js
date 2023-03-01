import path from 'path';
import fs from 'fs';
import DataStorage from '../../src/server/DataStorage';
import CncMeshLinkageToolPathGenerator from '../../src/server/lib/ToolPathGenerator/MeshToolPath/CncMeshLinkageToolPathGenerator';

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
                const value = item[key];

                // if (key === 'B') {
                //     value = -value;
                // }

                if (key === 'X' || key === 'Y' || key === 'Z' || key === 'B') {
                    cmds.push(key + value.toFixed(3)); // restrict precision
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
    // const mesh = new CncMeshLinkageToolPathGenerator({ uploadName: 'scad_chess_knight.stl', isRotate: true, diameter: 36, gcodeConfig: { density: 5, toolAngle: 20, jogSpeed: 600, workSpeed: 200 } });
    const d = new Date().getTime();
    const mesh = new CncMeshLinkageToolPathGenerator({
        modelID: 'modelID0',
        modelName: 'scad_chess_knight.stl',
        headType: 'cnc',
        sourceType: 'image3d',
        mode: 'greyscale',
        visible: true,
        sourceHeight: 786.7703747684369,
        sourceWidth: 2046.5639999999999,
        originalName: 'scad_chess_knight.stl',
        uploadName: 'scad_chess_knight.stl',
        processImageName: 'k.stl',
        transformation: {
            positionX: 0.12569354814490907,
            positionY: 27.78755698502397,
            positionZ: 0,
            rotationX: 0,
            rotationY: 0,
            rotationZ: 0,
            scaleX: 0.5418204665184021,
            scaleY: 0.5418204665184021,
            scaleZ: 1,
            uniformScalingState: true,
            flip: 0
            // width: 142.16285400509835,
            // height: 54.652345064088784
        },
        config: {
            direction: 'front',
            minGray: 0,
            maxGray: 255,
            sliceDensity: 5,
            extensionX: 0,
            extensionY: 0,
            svgNodeName: 'image',
            'stroke-width': '0.3175128654610011',
            invert: false
        },
        printOrder: 1,
        gcodeConfig: {
            sliceMode: 'linkage',
            smoothY: true,
            targetDepth: 2,
            stepDown: 40,
            safetyHeight: 1,
            stopHeight: 80,
            density: 5,
            jogSpeed: 3000,
            workSpeed: 300,
            plungeSpeed: 300,
            dwellTime: 896745231,
            isModel: true
        },
        toolPathFilename: "King's Bust_33814056.stl._34358096.json",
        gcodeConfigPlaceholder: {
            jogSpeed: 'jogSpeed',
            workSpeed: 'workSpeed',
            dwellTime: 'dwellTime',
            plungeSpeed: 'plungeSpeed'
        },
        materials: {
            isRotate: true,
            diameter: 45,
            length: 75,
            fixtureLength: 20,
            x: 141.37,
            y: 75,
            z: 0
        },
        toolParams: { toolDiameter: 0.2, toolAngle: 30, toolShaftDiameter: 3.175 },
        id: 'b69ebe65-ca9c-4128-b70c-798421813d3c'
    });
    // const mesh = new CncMeshLinkageToolPathGenerator({ uploadName: '4thsnapmaker.stl', materials: { isRotate: true, diameter: 40 }, toolParams: { toolDiameter: 0.2, toolAngle: 30, toolShaftDiameter: 3.175 }, gcodeConfig: { density: 5, jogSpeed: 600, workSpeed: 200 } });
    // const mesh = new MeshToolPathGenerator({ uploadName: 'cube.stl', isRotate: true });
    const data = mesh.generateToolPathObj();
    console.log('time', new Date().getTime() - d);

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
