import noop from 'lodash/noop';
import log from 'loglevel';
import * as THREE from 'three';

export class STLParse {
    isBinary(data) {
        const reader = new DataView(data);
        const faceSize = (32 / 8 * 3) + ((32 / 8 * 3) * 3) + (16 / 8);
        const nFaces = reader.getUint32(80, true);
        const expect = 80 + (32 / 8) + (nFaces * faceSize);

        if (expect === reader.byteLength) {
            return true;
        }

        // An ASCII STL data must begin with 'solid ' as the first six bytes.
        // However, ASCII STLs lacking the SPACE after the 'd' are known to be
        // plentiful.  So, check the first 5 bytes for 'solid'.

        // US-ASCII ordinal values for 's', 'o', 'l', 'i', 'd'

        const solid = [115, 111, 108, 105, 100];

        for (let i = 0; i < 5; i++) {
            // If solid[ i ] does not match the i-th byte, then it is not an
            // ASCII STL; hence, it is binary and return true.

            if (solid[i] !== reader.getUint8(i)) return true;
        }

        // First 5 bytes read "solid"; declare it to be an ASCII STL

        return false;
    }

    parseBinary(data, onProgress) {
        let progress = 0;
        const reader = new DataView(data);
        const faces = reader.getUint32(80, true);

        let r, g, b, hasColors = false, colors;
        let defaultR, defaultG, defaultB, alpha;

        // process STL header
        // check for default color in header ("COLOR=rgba" sequence).

        for (let index = 0; index < 80 - 10; index++) {
            if ((reader.getUint32(index, false) === 0x434F4C4F /* COLO*/)
                && (reader.getUint8(index + 4) === 0x52 /* 'R'*/)
                && (reader.getUint8(index + 5) === 0x3D /* '='*/)) {
                hasColors = true;
                colors = [];

                defaultR = reader.getUint8(index + 6) / 255;
                defaultG = reader.getUint8(index + 7) / 255;
                defaultB = reader.getUint8(index + 8) / 255;
                alpha = reader.getUint8(index + 9) / 255;
            }
        }

        const dataOffset = 84;
        const faceLength = 12 * 4 + 2;

        const vertices = [];
        const normals = [];

        for (let face = 0; face < faces; face++) {
            if (face / faces - progress > 0.01) {
                progress = face / faces;
                onProgress(progress);
            }

            const start = dataOffset + face * faceLength;
            const normalX = reader.getFloat32(start, true);
            const normalY = reader.getFloat32(start + 4, true);
            const normalZ = reader.getFloat32(start + 8, true);

            if (hasColors) {
                const packedColor = reader.getUint16(start + 48, true);

                if ((packedColor & 0x8000) === 0) {
                    // facet has its own unique color

                    r = (packedColor & 0x1F) / 31;
                    g = ((packedColor >> 5) & 0x1F) / 31;
                    b = ((packedColor >> 10) & 0x1F) / 31;
                } else {
                    r = defaultR;
                    g = defaultG;
                    b = defaultB;
                }
            }

            for (let i = 1; i <= 3; i++) {
                const vertexStart = start + i * 12;

                vertices.push(reader.getFloat32(vertexStart, true));
                vertices.push(reader.getFloat32(vertexStart + 4, true));
                vertices.push(reader.getFloat32(vertexStart + 8, true));

                normals.push(normalX, normalY, normalZ);

                if (hasColors) {
                    colors.push(r, g, b);
                }
            }
        }

        return {
            vertices,
            normals,
            colors,
            alpha
        };
    }

    parseASCII(data, onProgress) {
        let progress = 0;
        const patternFace = /facet([\s\S]*?)endfacet/g;
        let faceCounter = 0;

        /**
         * ascii stl format is following
         * so face count is (line count) / 7
         solid exported
         facet normal 1 0 0
         outer loop
         vertex 7.500000476837158 3 9
         vertex 7.500000476837158 -3 9
         vertex 7.500000476837158 3 0
         endloop
         endfacet
         ...
         endsolid exported
         */
        const faceCountExpected = data.toString().split('\n').length / 7;

        const patternFloat = /[\s]+([+-]?(?:\d+.\d+|\d+.|\d+|.\d+)(?:[eE][+-]?\d+)?)/.source;
        const patternVertex = new RegExp(`vertex${patternFloat}${patternFloat}${patternFloat}`, 'g');
        const patternNormal = new RegExp(`normal${patternFloat}${patternFloat}${patternFloat}`, 'g');

        const vertices = [];
        const normals = [];

        const normal = new THREE.Vector3();

        let result;

        // eslint-disable-next-line no-cond-assign
        while ((result = patternFace.exec(data)) !== null) {
            let vertexCountPerFace = 0;
            let normalCountPerFace = 0;

            const text = result[0];

            // eslint-disable-next-line no-cond-assign
            while ((result = patternNormal.exec(text)) !== null) {
                normal.x = parseFloat(result[1]);
                normal.y = parseFloat(result[2]);
                normal.z = parseFloat(result[3]);
                normalCountPerFace++;
            }

            // eslint-disable-next-line no-cond-assign
            while ((result = patternVertex.exec(text)) !== null) {
                vertices.push(parseFloat(result[1]), parseFloat(result[2]), parseFloat(result[3]));
                normals.push(normal.x, normal.y, normal.z);
                vertexCountPerFace++;
            }

            // every face have to own ONE valid normal
            if (normalCountPerFace !== 1) {
                log.error(`THREE.STLLoader: Something isn't right with the normal of face number ${faceCounter}`);
            }

            // each face have to own THREE valid vertices
            if (vertexCountPerFace !== 3) {
                log.error(`THREE.STLLoader: Something isn't right with the vertices of face number ${faceCounter}`);
            }

            faceCounter++;

            if (faceCounter / faceCountExpected - progress > 0.01) {
                progress = faceCounter / faceCountExpected;
                onProgress(progress);
            }
        }

        return {
            vertices,
            normals
        };
    }

    ensureString(buffer) {
        if (typeof buffer !== 'string') {
            return THREE.LoaderUtils.decodeText(new Uint8Array(buffer));
        }

        return buffer;
    }

    ensureBinary(buffer) {
        if (typeof buffer === 'string') {
            const arrayBuffer = new Uint8Array(buffer.length);
            for (let i = 0; i < buffer.length; i++) {
                arrayBuffer[i] = buffer.charCodeAt(i) & 0xff; // implicitly assumes little-endian
            }
            return arrayBuffer.buffer || arrayBuffer;
        } else {
            return buffer;
        }
    }

    parse(data, onProgress = noop) {
        const binData = this.ensureBinary(data);

        return this.isBinary(binData) ? this.parseBinary(binData, onProgress) : this.parseASCII(this.ensureString(data), onProgress);
    }
}
