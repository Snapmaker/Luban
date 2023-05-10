import { BufferAttribute, BufferGeometry } from 'three';
// import { mergeVertices } from '@snapmaker/luban-platform';


class GeometryAdjacentFaceGraph {
    private geometry: BufferGeometry;
    private mergedGeometry: BufferGeometry;

    private adjacentFacesMap: { [faceIndex: number]: number[] };

    public constructor(geometry: BufferGeometry) {
        this.geometry = geometry;

        this.build();
    }

    public getGeometry(): BufferGeometry {
        return this.mergedGeometry;
    }

    public getAdjacentFaces(faceIndex: number): number[] {
        return this.adjacentFacesMap[faceIndex];
    }

    private build(): void {
        // const mergedGeometry = mergeVertices(this.geometry, 1e-4);

        const indices = this.geometry.index;
        const positions = this.geometry.getAttribute('position') as BufferAttribute;
        const vertexCount = indices ? indices.count : positions.count;

        // vertex hash to identify vertex
        const tolerance = Math.max(1e-2, Number.EPSILON);
        const decimalShift = Math.log10(1 / tolerance);
        const shiftMultiplier = 10 ** decimalShift;

        const getters = ['getX', 'getY', 'getZ'];
        const vertexToHash = (attribute: BufferAttribute, index: number) => {
            let hash = '';
            for (let k = 0; k < 3; k++) {
                // double tilde truncates the decimal value
                hash += `${~~(attribute[getters[k]](index) * shiftMultiplier)},`;
            }

            return hash;
        };

        // vertex 2 face
        const faceCount = Math.round(this.geometry.index.count / 3);
        const vertexHash2faceMap = {};
        for (let i = 0; i < vertexCount; i++) {
            const faceIndex = Math.floor(i / 3);
            const index = indices ? indices.getX(i) : i;

            const hash = vertexToHash(positions, index);
            if (!vertexHash2faceMap[hash]) {
                vertexHash2faceMap[hash] = [];
            }

            vertexHash2faceMap[hash].push(faceIndex);
        }

        // face 2 face
        const face2faceMap = {};
        for (let faceIndex = 0; faceIndex < faceCount; faceIndex++) {
            for (let k = 0; k < 3; k++) {
                const indexA = indices ? indices.getX(faceIndex * 3 + k) : faceIndex * 3 + k;
                const indexB = indices ? indices.getX(faceIndex * 3 + (k + 1) % 3) : faceIndex * 3 + (k + 1) % 3;

                const facesA = vertexHash2faceMap[vertexToHash(positions, indexA)];
                const facesB = vertexHash2faceMap[vertexToHash(positions, indexB)];

                let l1 = 0, l2 = 0;
                while (l1 < facesA.length && l2 < facesB.length) {
                    while (l1 < facesA.length && facesA[l1] < facesB[l2]) l1++;
                    if (l1 >= facesA.length) break;

                    while (l2 < facesB.length && facesB[l2] < facesA[l1]) l2++;
                    if (l2 >= facesB.length) break;

                    if (facesA[l1] === facesB[l2]) {
                        // add adjacent face
                        if (facesA[l1] !== faceIndex) {
                            if (!face2faceMap[faceIndex]) {
                                face2faceMap[faceIndex] = [];
                            }
                            face2faceMap[faceIndex].push(facesA[l1]);
                        }

                        l1++;
                        l2++;
                    }
                }
            }
        }

        this.adjacentFacesMap = face2faceMap;
    }
}

export function computeAdjacentFaces(): void {
    if (!this.adjacentFaceGraph) {
        this.adjcentFaceGraph = new GeometryAdjacentFaceGraph(this);
    }
}
