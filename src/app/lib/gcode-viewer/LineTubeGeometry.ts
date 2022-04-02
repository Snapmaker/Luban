import {
    BufferGeometry,
    Color,
    Float32BufferAttribute,
    MathUtils,
    Matrix4,
    Vector3
} from 'three';
import { LinePoint } from './LinePoint';
import { TYPE_CODE_COLOR } from './constants';

interface PointData {
    pointNr: number
    radialNr: number
    vertices: number[]
    normals: number[]
    colors: number[],
    lineType: number,
    extruder: number
}

/**
 * This Tube geometry is similar to the TubeGeometry from three.js but
 * it draws the tube exactly like the given lines. It does not re-calculate
 * the segments using a curve, instead each point is exactly where it should be.
 * Also it provides an easy way to colorize each segment.
 *
 * TODO: As I searched for something like this quite some time without success, this
 * would be a good part to extract into another lib...
 */
export class LineTubeGeometry extends BufferGeometry {
    /**
     * Saves up to 4 linePoints to generate the model.
     * The oldest one get's dropped after generating as it's not needed anymore.
     */
    pointsBuffer: LinePoint[] = []

    private pointsLength: number

    private readonly radialSegments: number

    // buffer
    private vertices: number[] = []

    private normals: number[] = []

    private colors: number[] = []

    private uvs: number[] = [];

    private indices: number[] = [];

    private segmentsRadialNumbers: number[] = []

    private lineTypes: number[] = []

    private extruders: number[] = []

    /**
     * color mode
     * 0: line type mode
     * 1: extruder mode
     */
    private colorMode: number = 0;

    constructor(radialSegments = 8) {
        super();
        this.type = 'LineTubeGeometry';
        this.pointsLength = 0;
        this.radialSegments = radialSegments;
    }

    dispose() {
        super.dispose();
        this.pointsBuffer = [];
        this.normals = [];
        this.vertices = [];
        this.colors = [];
        this.uvs = [];
        this.indices = [];
        this.lineTypes = [];
        this.extruders = [];
        this.segmentsRadialNumbers = [];
    }

    public add(point: LinePoint) {
        this.pointsLength++;
        this.pointsBuffer.push(point);
        if (this.pointsBuffer.length === 3) {
            // For the first time, use index 0 to have 'no' previous
            this.generateSegment(0);
        } else if (this.pointsBuffer.length >= 4) {
            this.generateSegment(1);
        }
    }

    public finish() {
        // If the there are only two points in total it has to
        // be handled separately as the add mehtod only starts
        // segment generation at min 3 points.
        if (this.pointsBuffer.length === 2) {
            this.generateSegment(0);
        } else {
            // In all other cases generate the last segment.
            this.generateSegment(1);
        }

        this.setAttribute('position', new Float32BufferAttribute(this.vertices, 3));
        this.setAttribute('normal', new Float32BufferAttribute(this.normals, 3));
        this.setAttribute('color', new Float32BufferAttribute(this.colors, 3));

        this.generateUVs();
        this.setAttribute('uv', new Float32BufferAttribute(this.uvs, 2));

        // finally create faces
        this.generateIndices();
        this.setIndex(this.indices);

        // not needed anymore
        this.segmentsRadialNumbers = [];

        // these are now in the attribute buffers - can be deleted
        this.normals = [];
        this.colors = [];
        this.uvs = [];

        // The vertices are needed to slice. For now they need to be kept.
    }

    public pointsCount(): number {
        return this.pointsLength;
    }

    /**
     * Slices the rendered part of the line based on the passed start and end segments.
     * 0, this.pointsLength renders everything
     * @param start the starting segment
     * @param end the ending segment (excluding)
     */
    public slice(start: number = 0, end: number = this.pointsLength) {
        if (start === end) {
            this.setIndex([]);
            return;
        }

        // TODO: support negative values like the slice from Array?
        if (start < 0 || end < 0) {
            throw new Error('negative values are not supported, yet');
        }

        const seg = (this.radialSegments + 1) * 6;

        let startI = start * seg * 2;
        let endI = (end - 1) * seg * 2;

        if (end === this.pointsLength) {
            // add the ending
            endI += this.radialSegments * 6;
        }

        if (start > 0) {
            // remove the starting
            startI += this.radialSegments * 6;
        }

        // TODO: render an 'ending / starting' so that there is no hole.
        this.setIndex(this.indices.slice(startI, endI));
    }

    public changeColorsMode(mode = 0, extruderColors) {
        this.colorMode = mode;
        const colors = this.getAttribute('color').clone();

        if (this.colorMode === 0) {
            for (let i = 0; i < colors.count; i++) {
                for (let rgb = 0; rgb < 3; rgb++) {
                    // @ts-ignore
                    colors.array[i * 3 + rgb] = TYPE_CODE_COLOR[this.lineTypes[i]][rgb] / 255;
                }
            }
        }
        if (this.colorMode === 1) {
            const r0 = parseInt(extruderColors[0].substring(1, 3), 16) / 255;
            const g0 = parseInt(extruderColors[0].substring(3, 5), 16) / 255;
            const b0 = parseInt(extruderColors[0].substring(5), 16) / 255;
            const r1 = parseInt(extruderColors[1].substring(1, 3), 16) / 255;
            const g1 = parseInt(extruderColors[1].substring(3, 5), 16) / 255;
            const b1 = parseInt(extruderColors[1].substring(5), 16) / 255;
            console.log('extruderColors', extruderColors);
            for (let i = 0; i < colors.count; i++) {
                if (this.extruders[i] === 0) {
                    // @ts-ignore
                    colors.array[i * 3 + 0] = r0;
                    // @ts-ignore
                    colors.array[i * 3 + 1] = g0;
                    // @ts-ignore
                    colors.array[i * 3 + 2] = b0;
                } else {
                    // @ts-ignore
                    colors.array[i * 3 + 0] = r1;
                    // @ts-ignore
                    colors.array[i * 3 + 1] = g1;
                    // @ts-ignore
                    colors.array[i * 3 + 2] = b1;
                }
            }
        }
        console.log('mode', mode, colors);

        this.setAttribute('color', colors);
    }

    private generateSegment(i: number) {
        const prevPoint = this.pointsBuffer[i - 1];

        // point and nextPoint should always exist...
        const point = this.pointsBuffer[i];
        const nextPoint = this.pointsBuffer[i + 1];
        const nextNextPoint = this.pointsBuffer[i + 2];

        // ...except only one line exists in total
        if (nextPoint === undefined) {
            return;
        }

        const frame = this.computeFrenetFrames([point.point, nextPoint.point], false);

        const lastRadius = this.pointsBuffer[i - 1]?.radius || 0;

        // eslint-disable-next-line @typescript-eslint/no-shadow
        function createPointData(pointNr: number, radialNr: number, normal: Vector3, point: Vector3, radius: number, color: Color, lineType: number, extruder: number): PointData {
            return {
                pointNr,
                radialNr,
                normals: [normal.x, normal.y, normal.z],
                vertices: [
                    point.x + radius * normal.x,
                    point.y + radius * normal.y,
                    point.z + radius * normal.z
                ],
                colors: color.toArray(),
                lineType,
                extruder
            };
        }

        // The data is saved here to maintain the correct order.
        // After the segments are generated, they are pushed to the buffer one by one.
        const segmentsPoints: PointData[][] = [
            [], [], [], []
        ];

        // generate normals and vertices for the current segment
        for (let j = 0; j <= this.radialSegments; j++) {
            const v = j / this.radialSegments * Math.PI * 2;

            const sin = Math.sin(v);
            const cos = -Math.cos(v);

            // vertex

            const normal = new Vector3();
            normal.x = (cos * frame.normals[0].x + sin * frame.binormals[0].x);
            normal.y = (cos * frame.normals[0].y + sin * frame.binormals[0].y);
            normal.z = (cos * frame.normals[0].z + sin * frame.binormals[0].z);
            normal.normalize();

            // When the previous point doesn't exist, create one with the radius 0 (lastRadius is set to 0 in this case),
            // to create a closed starting point.
            if (prevPoint === undefined) {
                segmentsPoints[0].push(createPointData(i, j, normal, point.point, lastRadius, point.color, point.lineType, point.extruder));
            }

            // Then insert the current point with the current radius
            segmentsPoints[1].push(createPointData(i, j, normal, point.point, point.radius, point.color, point.lineType, point.extruder));

            // And also the next point with the current radius to finish the current line.
            segmentsPoints[2].push(createPointData(i, j, normal, nextPoint.point, point.radius, point.color, point.lineType, point.extruder));

            // if the next point is the last one, also finish the line by inserting one with zero radius.
            if (nextNextPoint === undefined) {
                segmentsPoints[3].push(createPointData(i + 1, j, normal, nextPoint.point, 0, point.color, point.lineType, point.extruder));
            }
        }

        // Save everything into the buffers.
        segmentsPoints.forEach((p) => {
            const normals = p.reduce((prev, cur) => [...prev, ...cur.normals], [] as number[]);
            this.normals.push(...normals);
            const colors = p.reduce((prev, cur) => [...prev, ...cur.colors], [] as number[]);
            this.colors.push(...colors);
            const vertices = p.reduce((prev, cur) => [...prev, ...cur.vertices], [] as number[]);
            this.vertices.push(...vertices);
            const lineTypes = p.reduce((prev, cur) => [...prev, cur.lineType], [] as number[]);
            this.lineTypes.push(...lineTypes);
            const extruders = p.reduce((prev, cur) => [...prev, cur.extruder], [] as number[]);
            this.extruders.push(...extruders);
            this.segmentsRadialNumbers.push(...p.map((cur) => cur.radialNr));
        });

        if (this.pointsBuffer.length >= 4) {
            // delete the first point. It's not needed anymore.
            this.pointsBuffer = this.pointsBuffer.slice(1);
        }
    }

    private generateIndices() {
        for (let i = (this.radialSegments + 2); i < this.segmentsRadialNumbers.length; i++) {
            const a = i - 1;
            const b = i - this.radialSegments - 2;
            const c = i - this.radialSegments - 1;
            const d = i;

            this.indices.push(
                a, b, c,
                d, a, c
            );
        }
    }

    private generateUVs() {
        for (let i = 0; i < this.segmentsRadialNumbers.length; i++) {
            this.uvs.push(
                (i / this.radialSegments) - 1,
                this.segmentsRadialNumbers[i] / this.radialSegments
            );
        }
    }

    toJSON() {
        throw new Error('not implemented');
    }

    private getTangent(point1: Vector3, point2: Vector3, optionalTarget?: Vector3) {
        const tangent = optionalTarget || new Vector3();
        tangent.copy(point1).sub(point2).normalize();
        return tangent;
    }

    private computeFrenetFrames(points: Vector3[], closed: boolean) {
        // Slightly modified from the three.js curve.

        // see http://www.cs.indiana.edu/pub/techreports/TR425.pdf

        const normal = new Vector3();
        const tangents = [];
        const normals = [];
        const binormals = [];

        const vec = new Vector3();
        const mat = new Matrix4();

        // compute the tangent vectors for each segment
        for (let i = 1; i < Math.floor(points.length / 2) + (points.length % 2 ? 0 : 1); i++) {
            const t = this.getTangent(points[i - 1], points[i]);
            t.normalize();
            tangents.push(t);
        }

        const segments = tangents.length - 1;

        // select an initial normal vector perpendicular to the first tangent vector,
        // and in the direction *2-1of the minimum tangent xyz component

        normals[0] = new Vector3();
        binormals[0] = new Vector3();
        let min = Number.MAX_VALUE;
        const tx = Math.abs(tangents[0].x);
        const ty = Math.abs(tangents[0].y);
        const tz = Math.abs(tangents[0].z);

        if (tx <= min) {
            min = tx;
            normal.set(1, 0, 0);
        }

        if (ty <= min) {
            min = ty;
            normal.set(0, 1, 0);
        }

        if (tz <= min) {
            normal.set(0, 0, 1);
        }

        vec.crossVectors(tangents[0], normal).normalize();

        normals[0].crossVectors(tangents[0], vec);
        binormals[0].crossVectors(tangents[0], normals[0]);


        // compute the slowly-varying normal and binormal vectors for each segment on the curve

        for (let i = 1; i <= segments; i++) {
            normals[i] = normals[i - 1].clone();

            binormals[i] = binormals[i - 1].clone();

            vec.crossVectors(tangents[i - 1], tangents[i]);

            if (vec.length() > Number.EPSILON) {
                vec.normalize();

                const theta = Math.acos(MathUtils.clamp(tangents[i - 1].dot(tangents[i]), -1, 1)); // clamp for floating pt errors

                normals[i].applyMatrix4(mat.makeRotationAxis(vec, theta));
            }

            binormals[i].crossVectors(tangents[i], normals[i]);
        }

        // if the curve is closed, postprocess the vectors so the first and last normal vectors are the same

        if (closed === true) {
            let theta = Math.acos(MathUtils.clamp(normals[0].dot(normals[segments]), -1, 1));
            theta /= segments;

            if (tangents[0].dot(vec.crossVectors(normals[0], normals[segments])) > 0) {
                theta = -theta;
            }

            for (let i = 1; i <= segments; i++) {
                // twist a little...
                normals[i].applyMatrix4(mat.makeRotationAxis(tangents[i], theta * i));
                binormals[i].crossVectors(tangents[i], normals[i]);
            }
        }

        return {
            tangents: tangents,
            normals: normals,
            binormals: binormals
        };
    }
}
