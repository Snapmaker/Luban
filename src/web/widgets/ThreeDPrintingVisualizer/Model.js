import * as THREE from 'three';
import ConvexGeometry from '../../components/three-extensions/ConvexGeometry';


class Model extends THREE.Mesh {
    constructor(geometry, materialNormal, materialOverstepped, modelName, modelPath) {
        super(geometry, materialNormal);
        this.isModel = true;
        this.type = 'Model';
        this.geometry = geometry;
        this.materialNormal = materialNormal;
        this.materialOverstepped = materialOverstepped;
        this.modelName = modelName;
        this.modelPath = modelPath;
        // add '_wireframe'
        const geo = new THREE.EdgesGeometry(geometry); // or WireframeGeometry
        const mat = new THREE.LineBasicMaterial({ color: 0x000066, linewidth: 1 });
        this._wireframe = new THREE.LineSegments(geo, mat);
        this._wireframe.position.set(0, 0, 0);
        this._wireframe.scale.set(1, 1, 1);
        this.add(this._wireframe);
        // the boundingBox is aligned parent axis
        this.boundingBox = null;
        this._selected = false;
        this.setSelected(this._selected);

        // convex hull geometry
        // attention: it may cost several seconds
        // why use ConvexGeometry rather than ConvexBufferGeometry?
        // ConvexGeometry will execute "mergeVertices()" to remove duplicated vertices
        // no performance different if not render
        this.convexGeometry = null;
        if (geometry.isBufferGeometry) {
            const tempGeometry = new THREE.Geometry();
            tempGeometry.fromBufferGeometry(geometry);
            this.convexGeometry = new ConvexGeometry(tempGeometry.vertices);
        } else {
            this.convexGeometry = new ConvexGeometry(geometry.vertices);
        }

        // render convex hull
        // const meshMaterial = new THREE.MeshLambertMaterial({
        //     color: 0xffffff,
        //     opacity: 0.8,
        //     transparent: true
        // });
        // const convexHullMesh = new THREE.Mesh(this.convexGeometry, meshMaterial);
        // convexHullMesh.scale.set(1, 1, 1);
        // this.add(convexHullMesh);
    }

    stickToPlate() {
        this.computeBoundingBox();
        // set computational accuracy to 0.01
        this.position.y = this.position.y - this.boundingBox.min.y;
    }

    computeBoundingBox() {
        // after operated(move/scale/rotate), model.geometry is not changed
        // so need to call: bufferGemotry.applyMatrix(matrixLocal);
        // then call: bufferGemotry.computeBoundingBox(); to get operated modelMesh BoundingBox
        // clone this.convexGeometry then clone.computeBoundingBox() is faster.
        const clone = this.convexGeometry.clone();
        this.updateMatrix();
        clone.applyMatrix(this.matrix);
        clone.computeBoundingBox();
        this.boundingBox = clone.boundingBox;
    }

    setSelected(selected) {
        this._selected = selected;
        this._wireframe.visible = selected;
    }

    isSelected() {
        return this._selected;
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
        this.material = overstepped ? this.materialOverstepped : this.materialNormal;
    }

    clone() {
        this.updateMatrix();
        const clone = new Model(
            this.geometry.clone(),
            this.materialNormal.clone(),
            this.materialOverstepped.clone(),
            this.modelPath
        );
        clone.setMatrix(this.matrix);
        return clone;
    }

    layFlat() {
        const epsilon = 1e-6;
        const positionX = this.position.x;
        const positionZ = this.position.z;

        // Attention: the minY-vertex and min-angle-vertex must be in the same face
        // transform convexGeometry clone
        this.updateMatrix();
        let convexGeometryClone = this.convexGeometry.clone();
        convexGeometryClone.applyMatrix(this.matrix);
        let faces = convexGeometryClone.faces;
        let vertices = convexGeometryClone.vertices;

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
            if ([face.a, face.b, face.c].includes(minYVertexIndex) &&
                [face.a, face.b, face.c].includes(minAngleVertexIndex)) {
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
}

export default Model;
