import { dist2 } from './Utils';

export function sortShapes(svg) {
    const shapes = svg.shapes;
    const newShapes = [];

    const usedSet = new Set();
    let from = [0, 0];
    for (let loop = 0; loop < shapes.length; loop++) {
        let minDist = Infinity;
        let idx = -1;
        let rev = false;

        for (let i = 0; i < shapes.length; ++i) {
            const shape = shapes[i];
            if (usedSet.has(i)) {
                continue;
            }

            for (let path of shape.paths) {
                let tmpDist = dist2(path.points[0], from);
                if (tmpDist < minDist) {
                    minDist = tmpDist;
                    rev = false;
                    idx = i;
                }

                tmpDist = dist2(path.points[path.points.length - 1], from);
                if (tmpDist < minDist) {
                    minDist = tmpDist;
                    rev = true;
                    idx = i;
                }
            }
        }

        // use shape[idx] first
        const shape = shapes[idx];
        if (rev) {
            for (let i = 0; i < shape.paths.length; i++) {
                shape.paths[i].points = shape.paths[i].points.reverse();
            }
        }
        from = shape.paths[shape.paths.length - 1].points[0];
        newShapes.push(shape);
        usedSet.add(idx);
    }

    svg.shapes = newShapes;
}

// Flip SVG upside down, with side effect.
export function flip(svg) {
    const bbox = svg.boundingBox;

    for (let shape of svg.shapes) {
        for (let path of shape.paths) {
            for (let point of path.points) {
                // Refactor this when needed:
                // use its defined bounding box instead of computed bounding box.
                point[1] = bbox.minY + (bbox.maxY - point[1]);
            }
        }
    }

    return svg;
}

export function scale(svg, scale) {
    svg.boundingBox.minX *= scale.x;
    svg.boundingBox.maxX *= scale.x;
    svg.boundingBox.minY *= scale.y;
    svg.boundingBox.maxY *= scale.y;

    svg.width *= scale.x;
    svg.height *= scale.y;

    for (let shape of svg.shapes) {
        shape.boundingBox.minX *= scale.x;
        shape.boundingBox.maxX *= scale.x;
        shape.boundingBox.minY *= scale.y;
        shape.boundingBox.maxY *= scale.y;
        for (let path of shape.paths) {
            for (let point of path.points) {
                point[0] *= scale.x;
                point[1] *= scale.y;
            }
        }
    }

    return svg;
}

export function clip(svg) {
    for (let shape of svg.shapes) {
        for (let path of shape.paths) {
            for (let point of path.points) {
                point[0] -= svg.boundingBox.minX;
                point[1] -= svg.boundingBox.minY;
            }
        }
    }
    svg.boundingBox.maxX -= svg.boundingBox.minX;
    svg.boundingBox.minX = 0;
    svg.boundingBox.maxY -= svg.boundingBox.minY;
    svg.boundingBox.minY = 0;
    return svg;
}
