
function dxfToSegments(dxf, options = {}) {
    if (!options.fillEnabled) {
        const segments = [];
        for (const entities of dxf.entities) {
            if (!dxf.tables.layer.layers[entities.layer].visible) {
                continue;
            }
            const obj = {};
            // console.log('vertices>>>>>>', entities.vertices);
            if (entities.type === 'LINE') {
                entities.vertices.forEach((item, index) => {
                    if (index === 0) {
                        obj.start = [item.x, item.y];
                    } else {
                        obj.end = [item.x, item.y];
                    }
                });
                segments.push(obj);
            } else if (entities.type === 'POINT') {
                if (entities.position.x === 0 && entities.position.y === 0) {
                    continue;
                }
                obj.start = [entities.position.x, entities.position.y];
                obj.end = [entities.position.x, entities.position.y];
                segments.push(obj);
            } else if (entities.type === 'CIRCLE') {
                const radius = entities.radius;
                for (let i = 0; i < 360; i += 5) {
                    const obj = {};
                    const x1 = entities.center.x + radius * Math.cos(i * Math.PI / 180);
                    const y1 = entities.center.y + radius * Math.sin(i * Math.PI / 180);
                    obj.start = [x1, y1];
                    obj.end = [x1, y1];
                    segments.push(obj);
                }
            }
        }
        return segments;
    } else {
        options.width = options.width || 10; // defaults to 10mm
        options.height = options.height || 10; // defaults to 10mm

        const color = 1; // only black & white, use 1 to mark canvas as painted
        const width = Math.round(options.width * options.fillDensity);
        const height = Math.round(options.height * options.fillDensity);

        const canvas = new Array(width);
        for (let i = 0; i < width; i++) {
            canvas[i] = new Uint8Array(height);
        }

        for (const shape of dxf.shapes) {
            if (!shape.visibility) {
                continue;
            }

            for (const path of shape.paths) {
                for (let i = 0; i < path.points.length - 1; i++) {
                    const p1 = mapPointToInteger(path.points[i], options.fillDensity);
                    const p2 = mapPointToInteger(path.points[i + 1], options.fillDensity);
                    drawLine(canvas, width, height, p1, p2, color);
                }
            }

            if (shape.fill) {
                const newShape = {
                    paths: []
                };
                for (const path of shape.paths) {
                    if (path.closed) {
                        const newPath = {
                            points: []
                        };
                        for (const point of path.points) {
                            newPath.points.push(mapPointToInteger(point, options.fillDensity));
                        }
                        newShape.paths.push(newPath);
                    }
                }
                fillShape(canvas, width, height, newShape, color);
            }
        }

        return canvasToSegments(canvas, width, height, options.fillDensity);
    }
}

export {
    dxfToSegments
};
