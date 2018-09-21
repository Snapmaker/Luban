import * as THREE from 'three';

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
        this.updateMatrix();
        const bufferGemotry = this.geometry.clone();
        bufferGemotry.applyMatrix(this.matrix);
        bufferGemotry.computeBoundingBox();
        this.boundingBox = bufferGemotry.boundingBox;
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
}

export default Model;
