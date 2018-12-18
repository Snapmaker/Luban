import * as THREE from 'three';
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

            for (const path of shape.paths) {
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

    for (const shape of svg.shapes) {
        for (const path of shape.paths) {
            for (const point of path.points) {
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

    for (const shape of svg.shapes) {
        shape.boundingBox.minX *= scale.x;
        shape.boundingBox.maxX *= scale.x;
        shape.boundingBox.minY *= scale.y;
        shape.boundingBox.maxY *= scale.y;
        for (const path of shape.paths) {
            for (const point of path.points) {
                point[0] *= scale.x;
                point[1] *= scale.y;
            }
        }
    }

    return svg;
}

export function clip(svg) {
    for (const shape of svg.shapes) {
        for (const path of shape.paths) {
            for (const point of path.points) {
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

export function updateShapeBoundingBox(shape) {
    const boundingBox = {
        minX: Infinity,
        maxX: -Infinity,
        minY: Infinity,
        maxY: -Infinity
    };

    for (const path of shape.paths) {
        for (const point of path.points) {
            boundingBox.minX = Math.min(boundingBox.minX, point[0]);
            boundingBox.maxX = Math.max(boundingBox.maxX, point[0]);
            boundingBox.minY = Math.min(boundingBox.minY, point[1]);
            boundingBox.maxY = Math.max(boundingBox.maxY, point[1]);
        }
    }

    shape.boundingBox = boundingBox;
}

export function updateSvgBoundingBox(svg) {
    const boundingBox = {
        minX: Infinity,
        maxX: -Infinity,
        minY: Infinity,
        maxY: -Infinity
    };

    for (const shape of svg.shapes) {
        updateShapeBoundingBox(shape);
        if (shape.visibility) {
            boundingBox.minX = Math.min(boundingBox.minX, shape.boundingBox.minX);
            boundingBox.maxX = Math.max(boundingBox.maxX, shape.boundingBox.maxX);
            boundingBox.minY = Math.min(boundingBox.minY, shape.boundingBox.minY);
            boundingBox.maxY = Math.max(boundingBox.maxY, shape.boundingBox.maxY);
        }
    }

    svg.boundingBox = boundingBox;
    return svg;
}

/**
 * Apply Matrix4 to SVG object.
 *
 * Assumes the upper 3x3 of m is a pure translation/rotation matrix (i.e, unscaled).
 * You can generate Matrix4 from euler rotation:
 *
 *     const m = new Matrix4().makeRotationFromEuler(euler);
 */
export function applyMatrix4(svg, m) {
    const e = m.elements;

    for (const shape of svg.shapes) {
        for (const path of shape.paths) {
            for (const point of path.points) {
                point[0] -= svg.boundingBox.minX;
                point[1] -= svg.boundingBox.minY;

                const x = point[0], y = point[1];
                point[0] = e[0] * x + e[4] * y + e[12];
                point[1] = e[1] * x + e[5] * y + e[13];
            }
        }
    }

    return updateSvgBoundingBox(svg);
}

/**
 * Rotate SVG by {angle} degree(s) counter-clockwise.
 *
 * @param svg SVG object
 * @param angle angle to rotate
 */
export function rotate(svg, angle) {
    const rotation = new THREE.Euler(0, 0, angle);
    const anchorPoint = [(svg.boundingBox.minX + svg.boundingBox.maxX) * 0.5, (svg.boundingBox.minY + svg.boundingBox.maxY) * 0.5];

    const move1 = new THREE.Matrix4().makeTranslation(-anchorPoint[0], -anchorPoint[1], 0);
    applyMatrix4(svg, move1);

    const rotationMatrix = new THREE.Matrix4().makeRotationFromEuler(rotation);
    applyMatrix4(svg, rotationMatrix);

    const move2 = new THREE.Matrix4().makeTranslation(anchorPoint[0], anchorPoint[1], 0);
    applyMatrix4(svg, move2);

    return svg;
}
