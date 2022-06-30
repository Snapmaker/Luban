import { Observable } from 'rxjs';
import { TransferDescriptor } from 'threads';
import { BufferAttribute, BufferGeometry, Line3, Matrix4, Plane, Vector3 } from 'three';
import { MeshBVH } from 'three-mesh-bvh';
// import sortUnorderedLine from './sort-unordered-line';
// import { GenerateMeshBVHWorker } from 'three-mesh-bvh/src/workers/generateAsync.worker';

type TPoint = { x: number, y: number, z?: number }

export type IMessage = {
    positionAttribute: TransferDescriptor<{
        array: number[];
        itemSize: number;
        normalized: boolean;
    }>,
    modelMatrix: Matrix4,
    height: number,
    layerHeight: number
}

export type IResult = {
    layerTop: number,
    vectors: TPoint[]
}

const calculateSectionPoints = ({ positionAttribute, modelMatrix, height, layerHeight }: IMessage) => {
    let number = 0;
    const now = new Date().getTime();
    return new Observable<IResult>((observer) => {
        let bvhGeometry = new BufferGeometry();
        const positionObject = positionAttribute.send;
        const position = new BufferAttribute(
            positionObject.array,
            positionObject.itemSize,
            positionObject.normalized
        );
        const matrix = new Matrix4();
        matrix.fromArray(modelMatrix.elements);
        position.applyMatrix4(matrix);
        bvhGeometry.setAttribute('position', position);
        let colliderBvh = new MeshBVH(bvhGeometry, { maxLeafTris: 3 });

        const plane = new Plane(new Vector3(0, 0, -1), 0);
        for (let layerTop = layerHeight; layerTop <= height; layerTop = Number((layerTop + layerHeight).toFixed(2))) {
            plane.constant = layerTop;
            let index = 0;
            const tempVector = new Vector3();
            const tempLine = new Line3();
            const positions: TPoint[] = [];
            colliderBvh.shapecast({
                intersectsBounds: (box) => {
                    return plane.intersectsBox(box);
                },
                intersectsTriangle: (tri) => {
                    // check each triangle edge to see if it intersects with the plane. If so then
                    // add it to the list of segments.
                    let count = 0;

                    const intersectPoints = [[tri.a, tri.b], [tri.b, tri.c], [tri.c, tri.a]].reduce((p, [start, end]) => {
                        tempLine.start.copy(start);
                        tempLine.end.copy(end);
                        if (plane.intersectLine(tempLine, tempVector)) {
                            const x = Number(tempVector.x.toFixed(5));
                            const y = Number(tempVector.y.toFixed(5));
                            const z = Number(tempVector.z.toFixed(5));
                            positions[index] = { x, y, z };
                            p.push({ x, y, z });
                            count++;
                            index++;
                        }
                        return p;
                    }, [] as TPoint[]);

                    if (count === 3) {
                        if (
                            (intersectPoints[count - 1].x === intersectPoints[count - 2].x && intersectPoints[count - 1].y === intersectPoints[count - 2].y)
                            || (intersectPoints[count - 1].x === intersectPoints[count - 3].x && intersectPoints[count - 1].y === intersectPoints[count - 3].y)
                        ) {
                            count--;
                            index--;
                        } else if (intersectPoints[count - 2].x === intersectPoints[count - 3].x && intersectPoints[count - 2].y === intersectPoints[count - 3].y) {
                            positions[index - 2] = intersectPoints[count - 1];
                            count--;
                            index--;
                        }
                    }
                    // If we only intersected with one or three sides then just remove it. This could be handled
                    // more gracefully.
                    if (count !== 2) {
                        index -= count;
                    }
                }
            });
            observer.next({
                layerTop,
                vectors: positions
            });
            number++;
        }
        bvhGeometry = null;
        colliderBvh = null;
        const cost = new Date().getTime() - now;
        console.log(`calculate section finish => layCount=${number},cost=${cost},average=${cost / number}`);
        observer.complete();
    });
};

export default calculateSectionPoints;
