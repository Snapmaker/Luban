import { Line3, Plane, Vector3 } from 'three';
import { MeshBVH } from 'three-mesh-bvh';
// import sortUnorderedLine from './sort-unordered-line';

type TPoint = { x: number, y: number, z?: number }

const calculateSectionPoints = (colliderBvh: MeshBVH, plane: Plane, offset: {
    x: number, y: number, z: number
}) => {
    const { x, y, z } = offset;

    let index = 0;
    const tempVector = new Vector3();
    const tempLine = new Line3();
    const positions: TPoint[] = [];

    colliderBvh.shapecast({
        // @ts-ignore
        intersectsBounds: (box) => {
            return plane.intersectsBox(box);
        },
        // @ts-ignore
        intersectsTriangle: (tri) => {
            // check each triangle edge to see if it intersects with the plane. If so then
            // add it to the list of segments.
            let count = 0;
            tempLine.start.copy(tri.a);
            tempLine.end.copy(tri.b);
            if (plane.intersectLine(tempLine, tempVector)) {
                positions[index] = { x: Number((tempVector.x + x).toFixed(2)), y: Number((tempVector.y + y).toFixed(2)), z: Number((tempVector.z + z).toFixed(2)) };
                index++;
                count++;
            }

            tempLine.start.copy(tri.b);
            tempLine.end.copy(tri.c);
            if (plane.intersectLine(tempLine, tempVector)) {
                positions[index] = { x: Number((tempVector.x + x).toFixed(2)), y: Number((tempVector.y + y).toFixed(2)), z: Number((tempVector.z + z).toFixed(2)) };
                count++;
                index++;
            }

            tempLine.start.copy(tri.c);
            tempLine.end.copy(tri.a);
            if (plane.intersectLine(tempLine, tempVector)) {
                positions[index] = { x: Number((tempVector.x + x).toFixed(2)), y: Number((tempVector.y + y).toFixed(2)), z: Number((tempVector.z + z).toFixed(2)) };
                count++;
                index++;
            }

            // If we only intersected with one or three sides then just remove it. This could be handled
            // more gracefully.
            if (count !== 2) {
                index -= count;
            }
        },
    });

    while (positions.length - index) {
        positions.pop();
    }

    return positions;

    // return sortUnorderedLine(positions);
};

export default calculateSectionPoints;
