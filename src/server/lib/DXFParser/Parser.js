import DxfParser from 'dxf-parser';
import fs from 'fs';

function readFile(originalPath) {
    return new Promise((resolve, reject) => {
        fs.readFile(originalPath, 'utf8', async (err, fileText) => {
            if (err) {
                reject(err);
                return;
            }

            resolve(fileText);
        });
    }).catch((err) => {
        console.log(err);
    });
}
export const measureBoundary = (dxfString) => {
    const dxf = dxfString;
    let maxX = Number.MIN_SAFE_INTEGER, minX = Number.MAX_SAFE_INTEGER, maxY = Number.MIN_SAFE_INTEGER, minY = Number.MAX_SAFE_INTEGER;
    console.log('maxX before>>>', {
        minX,
        maxX,
        minY,
        maxY
    });
    for (const variable of dxf.entities) {
        if (variable.type === 'LINE') {
            variable.vertices.forEach((point) => {
                console.log('vertices[i].x', point.x, maxX);
                maxX = Math.max(point.x, maxX);
                minX = Math.min(point.x, minX);
                maxY = Math.max(point.y, maxY);
                minY = Math.min(point.y, minY);
            });
        } else if (variable.type === 'POINT') {
            const position = variable.position;
            if (position.x === 0 && position.y === 0) {
                continue;
            }
            maxX = Math.max(position.x, maxX);
            minX = Math.min(position.x, minX);
            maxY = Math.max(position.y, maxY);
            minY = Math.min(position.y, minY);
        } else if (variable.type === 'CIRCLE') {
            const { center, radius } = variable;
            maxX = Math.max(center.x + radius, maxX);
            minX = Math.min(center.x - radius, minX);
            maxY = Math.max(center.y + radius, maxY);
            minY = Math.min(center.y - radius, minY);
        }
    }
    console.log('maxX >>>', {
        minX,
        maxX,
        minY,
        maxY
    });

    dxf.boundary = {
        minX: minX - 1,
        maxX: maxX + 1,
        minY: minY - 1,
        maxY: maxY + 1
    };
    dxf.boundary = {
        ...dxf.boundary,
        width: dxf.boundary.maxX - dxf.boundary.minX,
        height: dxf.boundary.maxY - dxf.boundary.minY
    };
    console.log('measureBoundary', dxf.boundary);
    return dxf;
};
// Add flipFlag: 0 Reset; 1: Vertical; 2: Horizontal; 3: Both
export const dxfFlip = (dxf, flipFlag) => {
    const { maxX, maxY, minX, minY } = dxf.boundary;

    for (const entities of dxf.entities) {
        if (entities.type === 'LINE') {
            console.log('inside LINE');
            entities.vertices.forEach((point, index) => {
                switch (flipFlag) {
                    case 1:
                        console.log('inside LINE1', point.y);
                        point.y = minY + (maxY - point.y);// 1:  Up Down;
                        break;
                    case 2:
                        point.x = minX + (maxX - point.x); // 2: Left Right;
                        break;
                    case 3:
                        // 3: Both Up Down and Left Right
                        point.y = minY + (maxY - point.y);
                        point.x = minX + (maxX - point.x);
                        break;
                    default:
                        break;
                }
            });
        } else if (entities.type === 'CIRCLE') {
            switch (flipFlag) {
                case 1:
                    console.log('CIRCLE');
                    entities.center.y = minY + (maxY - entities.center.y);
                    break;
                case 2:
                    entities.center.x = minX + (maxX - entities.center.x);
                    break;
                case 3:
                    entities.center.y = minY + (maxY - entities.center.y);
                    entities.center.x = minX + (maxX - entities.center.x);
                    break;
                default:
                    break;
            }
        } else if (entities.type === 'POINT') {
            if (entities.position.y === 0 && entities.position.x === 0) {
                continue;
            }
            switch (flipFlag) {
                case 1:
                    console.log('POINT');
                    entities.position.y = minY + (maxY - entities.position.y);
                    break;
                case 2:
                    entities.position.x = minX + (maxX - entities.position.x);
                    break;
                case 3:
                    entities.position.y = minY + (maxY - entities.position.y);
                    entities.position.x = minX + (maxX - entities.position.x);
                    break;
                default:
                    break;
            }
        }
    }
};

export const parseDxf = async (originalPath) => {
    const parser = new DxfParser();
    const fileText = await readFile(originalPath);
    let svgStr = await parser.parseSync(fileText);
    svgStr = measureBoundary(svgStr);
    return {
        svgStr,
        width: svgStr.boundary.width,
        height: svgStr.boundary.height
    };
};
