import fs from 'fs';
import { AABB3D } from './AABB3D';
import { Vector3 } from '../../../shared/lib/math/Vector3';
import { STLParse } from '../../../shared/lib/STL/STLParse';
import { isEqual, round } from '../../../shared/lib/utils';
import Coordinate from './Coordinate';
import { Vector2 } from '../../../shared/lib/math/Vector2';

const VERTEX_MELD_DISTANCE = 0.000003;

const pointHash = (p) => {
    return (p.x / VERTEX_MELD_DISTANCE) ^ ((p.y / VERTEX_MELD_DISTANCE) << 10) ^ ((p.z / VERTEX_MELD_DISTANCE) << 20);
};

const modifyCoordinateSystem = (p, propCoordinate, nextCoordinate) => {
    const { x, y, z } = p;
    const v = {};
    v[propCoordinate.xK()] = x * propCoordinate.xS();
    v[propCoordinate.yK()] = y * propCoordinate.yS();
    v[propCoordinate.zK()] = z * propCoordinate.zS();

    p.x = v[nextCoordinate.xK()] * nextCoordinate.xS();
    p.y = v[nextCoordinate.yK()] * nextCoordinate.yS();
    p.z = v[nextCoordinate.zK()] * nextCoordinate.zS();
};

export class Mesh {
    meshName;

    settings;

    vertexHashMap = new Map();

    vertices = [];

    faces = [];

    aabb = new AABB3D();

    coordinate = new Coordinate();

    constructor(settings) {
        this.settings = settings;
    }

    static loadSTLFile(filePath) {
        const mesh = new Mesh();

        const data = fs.readFileSync(filePath);

        const { vertices } = new STLParse().parse(new Uint8Array(data).buffer);

        if (!vertices) {
            return new Error('stl file parse error');
        }

        for (let i = 0; i < vertices.length; i += 9) {
            if (i + 9 > vertices.length) {
                continue;
            }
            // const v0 = mesh.getVector3ByPlane({ x: stlParse.vertices[i], y: stlParse.vertices[i + 1], z: stlParse.vertices[i + 2] });
            // const v1 = mesh.getVector3ByPlane({ x: stlParse.vertices[i + 3], y: stlParse.vertices[i + 4], z: stlParse.vertices[i + 5] });
            // const v2 = mesh.getVector3ByPlane({ x: stlParse.vertices[i + 6], y: stlParse.vertices[i + 7], z: stlParse.vertices[i + 8] });

            const v0 = { x: vertices[i], y: vertices[i + 1], z: vertices[i + 2] };
            const v1 = { x: vertices[i + 3], y: vertices[i + 4], z: vertices[i + 5] };
            const v2 = { x: vertices[i + 6], y: vertices[i + 7], z: vertices[i + 8] };

            mesh.addFace(v0, v1, v2);
        }

        delete mesh.vertexHashMap;

        mesh.finish();

        return mesh;
    }

    /**
     * Parse only the width and height of the STL
     *
     * @param filePath
     * @param isRotate
     * @returns {{width, height}|Error} width is circumference when rotate
     */
    static loadSize(filePath, isRotate) {
        const mesh = new Mesh();

        const data = fs.readFileSync(filePath);

        const { vertices } = new STLParse().parse(new Uint8Array(data).buffer);

        if (!vertices) {
            return new Error('stl file parse error');
        }

        for (let i = 0; i < vertices.length; i += 9) {
            if (i + 9 > vertices.length) {
                continue;
            }

            const v0 = { x: vertices[i], y: vertices[i + 1], z: vertices[i + 2] };
            const v1 = { x: vertices[i + 3], y: vertices[i + 4], z: vertices[i + 5] };
            const v2 = { x: vertices[i + 6], y: vertices[i + 7], z: vertices[i + 8] };

            mesh.aabb.include(v0);
            mesh.aabb.include(v1);
            mesh.aabb.include(v2);

            mesh.vertices.push({ p: v0 });
            mesh.vertices.push({ p: v1 });
            mesh.vertices.push({ p: v2 });
        }

        return mesh.getSize(isRotate);
    }

    addFace(v0, v1, v2) {
        const vi0 = this.findIndexOfVertex(v0);
        const vi1 = this.findIndexOfVertex(v1);
        const vi2 = this.findIndexOfVertex(v2);
        if (vi0 === vi1 || vi1 === vi2 || vi0 === vi2) return;

        const idx = this.faces.length;
        this.faces.push({
            vi: [-1, -1, -1],
            cf: []
        });
        const face = this.faces[idx];
        face.vi[0] = vi0;
        face.vi[1] = vi1;
        face.vi[2] = vi2;
        this.vertices[face.vi[0]].c.push(idx);
        this.vertices[face.vi[1]].c.push(idx);
        this.vertices[face.vi[2]].c.push(idx);
    }

    findIndexOfVertex(v) {
        const hash = pointHash(v);
        if (!this.vertexHashMap.has(hash)) {
            this.vertexHashMap.set(hash, []);
        }
        for (const vi of this.vertexHashMap.get(hash)) {
            const p = this.vertices[vi].p;
            if (Vector3.testLength(Vector3.sub(p, v), VERTEX_MELD_DISTANCE)) {
                return vi;
            }
        }
        this.vertexHashMap.get(hash).push(this.vertices.length);
        this.vertices.push({
            p: { x: v.x, y: v.y, z: v.z },
            c: []
        });
        this.aabb.include(v);

        return this.vertices.length - 1;
    }

    getFaceIdxWithPoints(idx0, idx1, notFaceIdx) {
        const candidateFaces = [];
        for (const f of this.vertices[idx0].c) {
            if (f === notFaceIdx) {
                continue;
            }
            if (this.faces[f].vi[0] === idx1 // && faces[f].vertex_index[1] == idx0 // next face should have the right direction!
                || this.faces[f].vi[1] === idx1 // && faces[f].vertex_index[2] == idx0
                || this.faces[f].vi[2] === idx1 // && faces[f].vertex_index[0] == idx0
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

    addCoordinateSystem(coordinate) {
        const nCoordinate = new Coordinate(this.coordinate).add(coordinate);
        this.setCoordinateSystem(nCoordinate);
    }

    setCoordinateSystem(coordinate) {
        const nCoordinate = new Coordinate(this.coordinate).set(coordinate);

        if (nCoordinate.isEqual(this.coordinate)) {
            return;
        }

        for (const vertex of this.vertices) {
            modifyCoordinateSystem(vertex.p, this.coordinate, nCoordinate);
        }
        modifyCoordinateSystem(this.aabb.max, this.coordinate, nCoordinate);
        modifyCoordinateSystem(this.aabb.min, this.coordinate, nCoordinate);
        modifyCoordinateSystem(this.aabb.length, this.coordinate, nCoordinate);

        this.aabb.alterCoordinateSystem();

        this.coordinate = nCoordinate;
    }

    finish() {
        for (let i = 0; i < this.faces.length; i++) {
            const face = this.faces[i];
            face.cf[0] = this.getFaceIdxWithPoints(face.vi[0], face.vi[1], i);
            face.cf[1] = this.getFaceIdxWithPoints(face.vi[1], face.vi[2], i);
            face.cf[2] = this.getFaceIdxWithPoints(face.vi[2], face.vi[0], i);
        }
    }

    getSize(isRotate = false) {
        if (isRotate) {
            const center = {
                x: (this.aabb.max.x + this.aabb.min.x) / 2,
                y: (this.aabb.max.y + this.aabb.min.y) / 2
            };
            let r2 = 0;
            for (const vertex of this.vertices) {
                r2 = Math.max(Vector2.length2({
                    x: vertex.p.x - center.x,
                    y: vertex.p.y - center.y
                }), r2);
            }

            const r = Math.sqrt(r2);

            const width = round(r * Math.PI * 2, 2);
            const height = this.aabb.length.z;
            return { width, height };
        } else {
            const width = this.aabb.length.x;
            const height = this.aabb.length.z;
            return { width, height };
        }
    }
}
