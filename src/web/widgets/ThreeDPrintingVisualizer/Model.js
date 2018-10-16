import * as THREE from 'three';
import ConvexGeometry from '../../components/three-extensions/ConvexGeometry';

class Model extends THREE.Mesh {
    constructor(geometry, materialNormal, materialOverstepped, modelPath) {
        super(geometry, materialNormal);
        this.isModel = true;
        this.type = 'Model';
        this.geometry = geometry;
        this.materialNormal = materialNormal;
        this.materialOverstepped = materialOverstepped;
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

    alignWithParent() {
        this.computeBoundingBox();
        // set computational accuracy to 0.1
        const y = Math.round((this.position.y - this.boundingBox.min.y) * 10) / 10;
        this.position.y = y;
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

    // layFlat() {
    //     // Attention: the lowest and second-lowest must be in the same face
    //     // TODO: rotate model around model center & use slope rather than y
    //     // 1.transform convexGeometry clone
    //     this.updateMatrix();
    //     let convexGeometryClone = this.convexGeometry.clone();
    //     convexGeometryClone.applyMatrix(this.matrix);
    //     let faces = convexGeometryClone.faces;
    //     let vertices = convexGeometryClone.vertices;
    //
    //     // find out the following params:
    //     // the index of lowest, second-lowest, third-lowest vertex
    //     let index1 = -1;
    //     let index2 = -1;
    //     let index3 = -1;
    //     let y1 = Number.MAX_VALUE;
    //     let y2 = Number.MAX_VALUE;
    //     let y3 = Number.MAX_VALUE;
    //
    //     // 2.find min-y and lowest vertex
    //     for (let i = 0; i < vertices.length; i++) {
    //         if (vertices[i].y < y1) {
    //             y1 = vertices[i].y;
    //             index1 = i;
    //         }
    //     }
    //
    //     // 3.check lowest vertex count
    //     let touchVertexCount = 0;
    //     for (let i = 0; i < vertices.length; i++) {
    //         if (vertices[i].y - y1 < 0.0001) {
    //             ++touchVertexCount;
    //         }
    //     }
    //
    //     if (touchVertexCount >= 3) {
    //         // already lay flat
    //         return;
    //     }
    //
    //     // find the second-lowest vertex
    //     for (let i = 1; i < vertices.length; i++) {
    //         if (i !== index1) {
    //             if (vertices[i].y < y2) {
    //                 y2 = vertices[i].y;
    //                 index2 = i;
    //             }
    //         }
    //     }
    //
    //     // 4.if there is only 1 lowest vertex,
    //     // transform model to make second-lowest vertex.y equal to lowest vertex.y
    //     if (touchVertexCount === 1) {
    //         const vb1 = new THREE.Vector3().subVectors(vertices[index2], vertices[index1]);
    //         const va1 = new THREE.Vector3(vb1.x, 0, vb1.z);
    //         const matrix1 = this._getRotateMatrix(va1, vb1);
    //         this.applyMatrix(matrix1);
    //         this.alignWithParent();
    //
    //         // update geometry
    //         convexGeometryClone = this.convexGeometry.clone();
    //         convexGeometryClone.applyMatrix(this.matrix);
    //         faces = convexGeometryClone.faces;
    //         vertices = convexGeometryClone.vertices;
    //     }
    //
    //     // now there are 2 lowest vertex
    //     // find third-lowest vertex
    //     let index3Array = [];
    //     for (let i = 0; i < faces.length; i++) {
    //         const face = faces[i];
    //         if ([face.a, face.b, face.c].includes(index1) &&
    //             [face.a, face.b, face.c].includes(index2)) {
    //             index3Array = index3Array.concat(this._getArrayDifference([face.a, face.b, face.c], [index1, index2]));
    //         }
    //     }
    //
    //     // find lowest in index3Array
    //     for (let i = 0; i < index3Array.length; i++) {
    //         if (vertices[index3Array[i]].y < y3) {
    //             y3 = vertices[index3Array[i]].y;
    //             index3 = index3Array[i];
    //         }
    //     }
    //
    //     let associatedFace = null;
    //     for (let i = 0; i < faces.length; i++) {
    //         const face = faces[i];
    //         if ([face.a, face.b, face.c].includes(index1) &&
    //             [face.a, face.b, face.c].includes(index2) &&
    //             [face.a, face.b, face.c].includes(index3)) {
    //             associatedFace = face;
    //         }
    //     }
    //
    //     convexGeometryClone.computeFaceNormals();
    //     const vb2 = associatedFace.normal.multiplyScalar(-1);
    //     const va2 = new THREE.Vector3(vb2.x, 0, vb2.z);
    //
    //     const matrix2 = this._getRotateMatrix(va2, vb2);
    //     this.applyMatrix(matrix2);
    //     this.alignWithParent();
    // }

    layFlat() {
        const positionX = this.position.x;
        const positionZ = this.position.z;

        // Attention: the lowest vertex and min-slope vertex must be in the same face
        // 1.transform convexGeometry clone
        this.updateMatrix();
        let convexGeometryClone = this.convexGeometry.clone();
        convexGeometryClone.applyMatrix(this.matrix);
        let faces = convexGeometryClone.faces;
        let vertices = convexGeometryClone.vertices;

        // find out the following params:
        let associatedFace = null;
        let index1 = -1; // index of lowest vertex
        let index2 = -1; // index of min-slope vertex
        let minY = Number.MAX_VALUE;

        // 2.find minY and index of lowest vertex
        for (let i = 0; i < vertices.length; i++) {
            if (vertices[i].y < minY) {
                minY = vertices[i].y;
                index1 = i;
            }
        }

        // 3.check lowest vertex count
        let touchVertexCount = 0;
        for (let i = 0; i < vertices.length; i++) {
            if (vertices[i].y - minY < 0.0001) {
                ++touchVertexCount;
            }
        }

        if (touchVertexCount >= 3) {
            // already lay flat
            return;
        }

        // 4.find the min-slope vertex
        let sin = Number.MAX_VALUE;
        let directionVector3 = null;
        for (let i = 1; i < vertices.length; i++) {
            if (i !== index1) {
                directionVector3 = new THREE.Vector3().subVectors(vertices[i], vertices[index1]);
                const length = directionVector3.length();
                if (directionVector3.y / length < sin) {
                    sin = directionVector3.y / length;
                    index2 = i;
                }
            }
        }

        // 4.if there is only 1 lowest vertex,
        // transform model to make second-lowest vertex.y equal to lowest vertex.y
        if (touchVertexCount === 1) {
            const vb1 = new THREE.Vector3().subVectors(vertices[index2], vertices[index1]);
            const va1 = new THREE.Vector3(vb1.x, 0, vb1.z);
            const matrix1 = this._getRotateMatrix(va1, vb1);
            this.applyMatrix(matrix1);
            this.alignWithParent();

            // update geometry
            convexGeometryClone = this.convexGeometry.clone();
            convexGeometryClone.applyMatrix(this.matrix);
            faces = convexGeometryClone.faces;
        }

        // now there are 2 vertex
        // find the face
        let faceArray = [];
        for (let i = 0; i < faces.length; i++) {
            const face = faces[i];
            if ([face.a, face.b, face.c].includes(index1) &&
                [face.a, face.b, face.c].includes(index2)) {
                faceArray.push(face);
            }
        }

        convexGeometryClone.computeFaceNormals();
        let angle = Number.MIN_VALUE;
        for (let i = 0; i < faceArray.length; i++) {
            const faceNormal = faceArray[i].normal.multiplyScalar(-1);
            const xzNormal = new THREE.Vector3(faceNormal.x, 0, faceNormal.z);
            const dot = faceNormal.dot(xzNormal);
            const tempAngle = Math.PI / 2 - Math.acos(dot / (faceNormal.length() * xzNormal.length()));
            if (tempAngle > angle) {
                angle = tempAngle;
                associatedFace = faceArray[i];
            }
        }

        const vb2 = associatedFace.normal.multiplyScalar(-1);
        const va2 = new THREE.Vector3(vb2.x, 0, vb2.z);
        const matrix2 = this._getRotateMatrix(va2, vb2);
        this.applyMatrix(matrix2);
        this.alignWithParent();
        this.position.x = positionX;
        this.position.z = positionZ;
    }

    _getRotateMatrix(v1, v2) {
        // https://stackoverflow.com/questions/1171849/finding-quaternion-representing-the-rotation-from-one-vector-to-another
        const cross = new THREE.Vector3();
        cross.crossVectors(v2, v1);
        const dot = v1.dot(v2);

        const l1 = v1.length();
        const l2 = v2.length();
        const w = Math.sqrt(l1 * l1 * l2 * l2) + dot;
        const x = cross.x;
        const y = cross.y;
        const z = cross.z;

        const q = new THREE.Quaternion(x, y, z, w);
        q.normalize();

        const matrix4 = new THREE.Matrix4();
        matrix4.makeRotationFromQuaternion(q);
        return matrix4;
    }

    // get a - b
    _getArrayDifference(a, b) {
        // clone a
        const clone = a.slice(0);
        for (let i = 0; i < b.length; i++) {
            const temp = b[i];
            for (let j = 0; j < clone.length; j++) {
                if (temp === clone[j]) {
                    // remove clone[j]
                    clone.splice(j, 1);
                }
            }
        }
        return clone;
    }
}

export default Model;
