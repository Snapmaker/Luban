import * as THREE from 'three';

const materialSelected = new THREE.MeshPhongMaterial({ color: 0xf0f0f0, specular: 0xb0b0b0, shininess: 30 });
const materialNormal = new THREE.MeshPhongMaterial({ color: 0xa0a0a0, specular: 0xb0b0b0, shininess: 30 });
const materialOverstepped = new THREE.MeshPhongMaterial({
    color: 0xff0000,
    shininess: 30,
    transparent: true,
    opacity: 0.6
});

class Model extends THREE.Mesh {
    constructor(geometry, modelName, modelPath) {
        super(geometry, materialNormal);

        this.isModel = true;
        this.boundingBox = null; // the boundingBox is aligned parent axis
        this.selected = false;
        this.overstepped = false;

        this.geometry = geometry;
        this.convexGeometry = null;
        this.modelName = modelName;
        this.modelPath = modelPath;
    }

    setConvexGeometry(convexGeometry) {
        if (convexGeometry instanceof THREE.BufferGeometry) {
            this.convexGeometry = new THREE.Geometry().fromBufferGeometry(convexGeometry);
            this.convexGeometry.mergeVertices();
        } else {
            this.convexGeometry = convexGeometry;
        }
    }

    stickToPlate() {
        this.computeBoundingBox();
        this.position.y = this.position.y - this.boundingBox.min.y;
    }

    computeBoundingBox() {
        // after operated(move/scale/rotate), model.geometry is not changed
        // so need to call: geometry.applyMatrix(matrixLocal);
        // then call: geometry.computeBoundingBox(); to get operated modelMesh BoundingBox
        // clone this.convexGeometry then clone.computeBoundingBox() is faster.
        if (this.convexGeometry) {
            const clone = this.convexGeometry.clone();
            this.updateMatrix();
            clone.applyMatrix(this.matrix);
            clone.computeBoundingBox();
            this.boundingBox = clone.boundingBox;
        } else {
            const clone = this.geometry.clone();
            this.updateMatrix();
            clone.applyMatrix(this.matrix);
            clone.computeBoundingBox();
            this.boundingBox = clone.boundingBox;
        }
    }

    setSelected(selected) {
        if (this.selected === selected) {
            return;
        }
        this.selected = selected;
        if (this.overstepped) {
            this.material = materialOverstepped;
        } else {
            this.material = (this.selected ? materialSelected : materialNormal);
        }
    }

    isSelected() {
        return this.selected;
    }

    setMatrix(matrix) {
        this.updateMatrix();
        this.applyMatrix(new THREE.Matrix4().getInverse(this.matrix));
        this.applyMatrix(matrix);
        // attention: do not use Object3D.applyMatrix(matrix : Matrix4)
        // because applyMatrix is accumulated
        // anther way: decompose Matrix and reset position/rotation/scale
        // let position = new THREE.Vector3();
        // let quaternion = new THREE.Quaternion();
        // let scale = new THREE.Vector3();
        // matrix.decompose(position, quaternion, scale);
        // this.position.copy(position);
        // this.quaternion.copy(quaternion);
        // this.scale.copy(scale);
    }

    setOverstepped(overstepped) {
        if (this.overstepped === overstepped) {
            return;
        }
        this.overstepped = overstepped;
        if (this.overstepped) {
            this.material = materialOverstepped;
        } else {
            this.material = (this.selected ? materialSelected : materialNormal);
        }
    }

    clone() {
        const clone = new Model(
            this.geometry.clone(),
            this.modelName,
            this.modelPath
        );
        this.updateMatrix();
        clone.setMatrix(this.matrix);
        return clone;
    }

    layFlat() {
        const epsilon = 1e-6;
        const positionX = this.position.x;
        const positionZ = this.position.z;

        if (!this.convexGeometry) {
            return;
        }

        // Attention: the minY-vertex and min-angle-vertex must be in the same face
        // transform convexGeometry clone
        let convexGeometryClone = this.convexGeometry.clone();

        this.updateMatrix();
        convexGeometryClone.applyMatrix(this.matrix);
        let faces = convexGeometryClone.faces;
        const vertices = convexGeometryClone.vertices;

        // find out the following params:
        let minY = Number.MAX_VALUE;
        let minYVertexIndex = -1;
        let minAngleVertexIndex = -1; // The angle between the vector(minY-vertex -> min-angle-vertex) and the x-z plane is minimal
        let minAngleFace = null;

        // find minY and minYVertexIndex
        for (let i = 0; i < vertices.length; i++) {
            if (vertices[i].y < minY) {
                minY = vertices[i].y;
                minYVertexIndex = i;
            }
        }

        // get minY vertices count
        let minYVerticesCount = 0;
        for (let i = 0; i < vertices.length; i++) {
            if (vertices[i].y - minY < epsilon) {
                ++minYVerticesCount;
            }
        }

        if (minYVerticesCount >= 3) {
            // already lay flat
            return;
        }

        // find minAngleVertexIndex
        if (minYVerticesCount === 2) {
            for (let i = 0; i < vertices.length; i++) {
                if (vertices[i].y - minY < epsilon && i !== minYVertexIndex) {
                    minAngleVertexIndex = i;
                }
            }
        } else if (minYVerticesCount === 1) {
            let sinValue = Number.MAX_VALUE; // sin value of the angle between directionVector3 and x-z plane
            for (let i = 1; i < vertices.length; i++) {
                if (i !== minYVertexIndex) {
                    const directionVector3 = new THREE.Vector3().subVectors(vertices[i], vertices[minYVertexIndex]);
                    const length = directionVector3.length();
                    // min sinValue corresponds minAngleVertexIndex
                    if (directionVector3.y / length < sinValue) {
                        sinValue = directionVector3.y / length;
                        minAngleVertexIndex = i;
                    }
                }
            }
            // transform model to make min-angle-vertex y equal to minY
            const vb1 = new THREE.Vector3().subVectors(vertices[minAngleVertexIndex], vertices[minYVertexIndex]);
            const va1 = new THREE.Vector3(vb1.x, 0, vb1.z);
            const matrix1 = this._getRotateMatrix(va1, vb1);
            this.applyMatrix(matrix1);
            this.stickToPlate();

            // update geometry
            convexGeometryClone = this.convexGeometry.clone();
            convexGeometryClone.applyMatrix(this.matrix);
            faces = convexGeometryClone.faces;
        }

        // now there must be 2 minY vertices
        // find minAngleFace
        const candidateFaces = [];
        for (let i = 0; i < faces.length; i++) {
            const face = faces[i];
            if ([face.a, face.b, face.c].includes(minYVertexIndex)
                && [face.a, face.b, face.c].includes(minAngleVertexIndex)) {
                candidateFaces.push(face);
            }
        }

        // max cos value corresponds min angle
        convexGeometryClone.computeFaceNormals();
        let cosValue = Number.MIN_VALUE;
        for (let i = 0; i < candidateFaces.length; i++) {
            // faceNormal points model outer surface
            const faceNormal = candidateFaces[i].normal;
            if (faceNormal.y < 0) {
                const cos = -faceNormal.y / faceNormal.length();
                if (cos > cosValue) {
                    cosValue = cos;
                    minAngleFace = candidateFaces[i];
                }
            }
        }

        const xzPlaneNormal = new THREE.Vector3(0, -1, 0);
        const vb2 = minAngleFace.normal;
        const matrix2 = this._getRotateMatrix(xzPlaneNormal, vb2);
        this.applyMatrix(matrix2);
        this.stickToPlate();
        this.position.x = positionX;
        this.position.z = positionZ;
    }

    // get matrix for rotating v2 to v1. Applying matrix to v2 can make v2 to parallels v1.
    _getRotateMatrix(v1, v2) {
        // https://stackoverflow.com/questions/1171849/finding-quaternion-representing-the-rotation-from-one-vector-to-another
        const cross = new THREE.Vector3();
        cross.crossVectors(v2, v1);
        const dot = v1.dot(v2);

        const l1 = v1.length();
        const l2 = v2.length();
        const w = l1 * l2 + dot;
        const x = cross.x;
        const y = cross.y;
        const z = cross.z;

        const q = new THREE.Quaternion(x, y, z, w);
        q.normalize();

        const matrix4 = new THREE.Matrix4();
        matrix4.makeRotationFromQuaternion(q);
        return matrix4;
    }

    updateTransformation(transformation) {
        const { positionX, positionZ, rotationX, rotationY, rotationZ, scaleX, scaleY, scaleZ } = transformation;
        positionX !== undefined && (this.position.x = positionX);
        positionZ !== undefined && (this.position.z = positionZ);

        rotationX !== undefined && (this.rotation.x = rotationX);
        rotationY !== undefined && (this.rotation.y = rotationY);
        rotationZ !== undefined && (this.rotation.z = rotationZ);

        scaleX !== undefined && (this.scale.x = scaleX);
        scaleY !== undefined && (this.scale.y = scaleY);
        scaleZ !== undefined && (this.scale.z = scaleZ);
    }
}

export default Model;
