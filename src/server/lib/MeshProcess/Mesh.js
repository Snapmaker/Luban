import fs from 'fs';
import { AABB3D } from './AABB3D';
import { Vector3 } from '../../../shared/lib/math/Vector3';
import { STLParse } from '../../../shared/lib/STLParse/STLParse';
import { DIRECTION_BACK, DIRECTION_DOWN, DIRECTION_FRONT, DIRECTION_LEFT, DIRECTION_RIGHT, DIRECTION_UP } from '../../constants';
import { isEqual } from '../../../shared/lib/utils';

const VERTEX_MELD_DISTANCE = 0.03;

const pointHash = (p) => {
    return (p.x / VERTEX_MELD_DISTANCE) ^ ((p.y / VERTEX_MELD_DISTANCE) << 10) ^ ((p.z / VERTEX_MELD_DISTANCE) << 20);
};

const modifyCoordinateSystem = (p, propCoordinates, nextCoordinates) => {
    const { x, y, z } = p;
    const v = {};
    v[propCoordinates.x] = x * propCoordinates.xSymbol;
    v[propCoordinates.y] = y * propCoordinates.ySymbol;
    v[propCoordinates.z] = z * propCoordinates.zSymbol;

    p.x = v[nextCoordinates.x] * nextCoordinates.xSymbol;
    p.y = v[nextCoordinates.y] * nextCoordinates.ySymbol;
    p.z = v[nextCoordinates.z] * nextCoordinates.zSymbol;
};

const surfaceOptions = {
    [DIRECTION_FRONT]: { x: 'x', y: 'y', z: 'z', xSymbol: 1, ySymbol: 1, zSymbol: 1 },
    [DIRECTION_BACK]: { x: 'x', y: 'y', z: 'z', xSymbol: -1, ySymbol: -1, zSymbol: 1 },
    [DIRECTION_LEFT]: { x: 'y', y: 'x', z: 'z', xSymbol: -1, ySymbol: 1, zSymbol: 1 },
    [DIRECTION_RIGHT]: { x: 'y', y: 'x', z: 'z', xSymbol: 1, ySymbol: -1, zSymbol: 1 },
    [DIRECTION_UP]: { x: 'x', y: 'z', z: 'y', xSymbol: 1, ySymbol: -1, zSymbol: 1 },
    [DIRECTION_DOWN]: { x: 'x', y: 'z', z: 'y', xSymbol: 1, ySymbol: 1, zSymbol: -1 }
};

const isEqualCoordinateSystem = (c1, c2) => {
    return c1.x === c2.x && c1.y === c2.y && c1.z === c2.z && c1.xSymbol === c2.xSymbol && c1.ySymbol === c2.ySymbol && c1.zSymbol === c2.zSymbol;
};

export class Mesh {
    meshName;

    settings;

    vertexHashMap = new Map();

    vertices = [];

    faces = [];

    aabb = new AABB3D();

    coordinates = {
        x: 'x',
        y: 'y',
        z: 'z',
        xSymbol: 1,
        ySymbol: 1,
        zSymbol: 1
    }

    constructor(settings) {
        this.settings = settings;
    }

    // getVector3ByPlane(v) {
    //     if (this.plane === PLANE_XY) {
    //         return v;
    //     } else if (this.plane === PLANE_YZ) {
    //         return {
    //             x: v.y,
    //             y: v.z,
    //             z: v.x
    //         };
    //     } else if (this.plane === PLANE_XZ) {
    //         return {
    //             x: v.x,
    //             y: v.z,
    //             z: v.y
    //         };
    //     }
    //     return v;
    // }

    static loadSTLFile(filePath) {
        const mesh = new Mesh();

        const data = fs.readFileSync(filePath);

        const stlParse = new STLParse().parse(new Uint8Array(data).buffer);

        if (!stlParse) {
            return new Error('stl file parse error');
        }

        for (let i = 0; i < stlParse.vertices.length; i += 9) {
            if (i + 9 > stlParse.vertices.length) {
                continue;
            }
            // const v0 = mesh.getVector3ByPlane({ x: stlParse.vertices[i], y: stlParse.vertices[i + 1], z: stlParse.vertices[i + 2] });
            // const v1 = mesh.getVector3ByPlane({ x: stlParse.vertices[i + 3], y: stlParse.vertices[i + 4], z: stlParse.vertices[i + 5] });
            // const v2 = mesh.getVector3ByPlane({ x: stlParse.vertices[i + 6], y: stlParse.vertices[i + 7], z: stlParse.vertices[i + 8] });

            const v0 = { x: stlParse.vertices[i], y: stlParse.vertices[i + 1], z: stlParse.vertices[i + 2] };
            const v1 = { x: stlParse.vertices[i + 3], y: stlParse.vertices[i + 4], z: stlParse.vertices[i + 5] };
            const v2 = { x: stlParse.vertices[i + 6], y: stlParse.vertices[i + 7], z: stlParse.vertices[i + 8] };

            mesh.addFace(v0, v1, v2);
        }

        mesh.finish();

        return mesh;
    }

    addFace(v0, v1, v2) {
        const vi0 = this.findIndexOfVertex(v0);
        const vi1 = this.findIndexOfVertex(v1);
        const vi2 = this.findIndexOfVertex(v2);
        if (vi0 === vi1 || vi1 === vi2 || vi0 === vi2) return;

        const idx = this.faces.length;
        this.faces.push({
            vertexIndex: [-1, -1, -1],
            connectedFaceIndex: []
        });
        const face = this.faces[idx];
        face.vertexIndex[0] = vi0;
        face.vertexIndex[1] = vi1;
        face.vertexIndex[2] = vi2;
        this.vertices[face.vertexIndex[0]].connectedFaces.push(idx);
        this.vertices[face.vertexIndex[1]].connectedFaces.push(idx);
        this.vertices[face.vertexIndex[2]].connectedFaces.push(idx);
    }

    findIndexOfVertex(v) {
        const hash = pointHash(v);
        if (!this.vertexHashMap.has(hash)) {
            this.vertexHashMap.set(hash, []);
        }
        for (const vertexIndex of this.vertexHashMap.get(hash)) {
            const p = this.vertices[vertexIndex].p;
            if (Vector3.testLength(Vector3.sub(p, v), VERTEX_MELD_DISTANCE)) {
                return vertexIndex;
            }
        }
        this.vertexHashMap.get(hash).push(this.vertices.length);
        this.vertices.push({
            p: { x: v.x, y: v.y, z: v.z },
            connectedFaces: []
        });
        this.aabb.include(v);

        return this.vertices.length - 1;
    }

    getFaceIdxWithPoints(idx0, idx1, notFaceIdx) {
        const candidateFaces = [];
        for (const f of this.vertices[idx0].connectedFaces) {
            if (f === notFaceIdx) {
                continue;
            }
            if (this.faces[f].vertexIndex[0] === idx1 // && faces[f].vertex_index[1] == idx0 // next face should have the right direction!
                || this.faces[f].vertexIndex[1] === idx1 // && faces[f].vertex_index[2] == idx0
                || this.faces[f].vertexIndex[2] === idx1 // && faces[f].vertex_index[0] == idx0
            ) candidateFaces.push(f);
        }
        if (candidateFaces.length === 1) { return candidateFaces[0]; }
        return new Error('No connection surface or more than one connection surface');
    }

    offset(offset) {
        if (Vector3.isZero(offset)) {
            return;
        }
        for (const vertex of this.vertices) {
            vertex.p = Vector3.add(vertex.p, offset);
        }
        this.aabb.offset(offset);
    }

    resize(offset) {
        if (Vector3.isZero(offset)) {
            return;
        }
        for (const vertex of this.vertices) {
            vertex.p = Vector3.mul(vertex.p, offset);
        }
        this.aabb.resize(offset);
    }

    rotateY(angle) {
        if (isEqual(angle, 0)) {
            return;
        }
        for (const vertex of this.vertices) {
            vertex.p = Vector3.rotateY(vertex.p, angle);
        }

        this.aabb.rotate(angle);
    }

    addDirection(direction) {
        this.addCoordinateSystem(surfaceOptions[direction]);
    }

    setDirection(direction) {
        this.setCoordinateSystem(surfaceOptions[direction]);
    }

    addCoordinateSystem(coordinates) {
        const nCoordinates = {};
        if (coordinates.x) {
            nCoordinates[coordinates.x] = this.coordinates.x;
        }
        if (coordinates.y) {
            nCoordinates[coordinates.y] = this.coordinates.y;
        }
        if (coordinates.z) {
            nCoordinates[coordinates.z] = this.coordinates.z;
        }
        if (coordinates.xSymbol === -1) {
            nCoordinates.xSymbol = -this.coordinates.xSymbol;
        }
        if (coordinates.ySymbol === -1) {
            nCoordinates.ySymbol = -this.coordinates.ySymbol;
        }
        if (coordinates.zSymbol === -1) {
            nCoordinates.zSymbol = -this.coordinates.zSymbol;
        }
        this.setCoordinateSystem(nCoordinates);
    }

    setCoordinateSystem(coordinates) {
        const nCoordinate = {
            ...this.coordinates,
            ...coordinates
        };

        if (isEqualCoordinateSystem(nCoordinate, this.coordinates)) {
            return;
        }

        for (const vertex of this.vertices) {
            modifyCoordinateSystem(vertex.p, this.coordinates, nCoordinate);
        }
        modifyCoordinateSystem(this.aabb.max, this.coordinates, nCoordinate);
        modifyCoordinateSystem(this.aabb.min, this.coordinates, nCoordinate);
        modifyCoordinateSystem(this.aabb.length, this.coordinates, nCoordinate);

        this.aabb.alterCoordinateSystem();

        this.coordinates = nCoordinate;
    }

    finish() {
        for (let i = 0; i < this.faces.length; i++) {
            const face = this.faces[i];
            face.connectedFaceIndex[0] = this.getFaceIdxWithPoints(face.vertexIndex[0], face.vertexIndex[1], i);
            face.connectedFaceIndex[1] = this.getFaceIdxWithPoints(face.vertexIndex[1], face.vertexIndex[2], i);
            face.connectedFaceIndex[2] = this.getFaceIdxWithPoints(face.vertexIndex[2], face.vertexIndex[0], i);
        }
    }
}
