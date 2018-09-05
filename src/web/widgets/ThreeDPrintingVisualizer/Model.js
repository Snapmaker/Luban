import * as THREE from 'three';

function Model(geometry, materialNormal, materialOverstepped, modelPath) {
    THREE.Mesh.call(this, geometry, materialNormal);
    this.type = 'Model';
    this.geometry = geometry;
    this.materialNormal = materialNormal;
    this.materialOverstepped = materialOverstepped;
    this.modelPath = modelPath;
    // add 'wireFrame'
    const geo = new THREE.EdgesGeometry(geometry); // or WireframeGeometry
    const mat = new THREE.LineBasicMaterial({ color: 0xe3a43f, linewidth: 1 });
    this.wireframe = new THREE.LineSegments(geo, mat);
    this.wireframe.position.set(0, 0, 0);
    this.wireframe.scale.set(1, 1, 1);
    this.add(this.wireframe);
    // the boundingBox is aligned parent axis
    this.boundingBox = undefined;
    this.selected = false;
    this.setSelected(this.selected);
}

Model.prototype = Object.assign(Object.create(THREE.Mesh.prototype), {
    constructor: Model,

    isModel: true,

    alignWithParent: function () {
        this.computeBoundingBox();
        // set computational accuracy to 0.1
        const y = Math.round((this.position.y - this.boundingBox.min.y) * 10) / 10;
        this.position.y = y;
    },

    computeBoundingBox: function () {
        // after operated(move/scale/rotate), model.geometry is not changed
        // so need to call: bufferGemotry.applyMatrix(matrixLocal);
        // then call: bufferGemotry.computeBoundingBox(); to get operated modelMesh BoundingBox
        this.updateMatrix();
        const bufferGemotry = this.geometry.clone();
        bufferGemotry.applyMatrix(this.matrix);
        bufferGemotry.computeBoundingBox();
        this.boundingBox = bufferGemotry.boundingBox;
    },

    setSelected: function (selected) {
        this.selected = selected;
        this.wireframe.visible = selected;
    },

    setMatrix: function (matrix) {
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
    },

    setOverstepped: function(overstepped) {
        this.material = overstepped ? this.materialOverstepped : this.materialNormal;
    },

    clone: function () {
        return new this.constructor(
            this.geometry.clone(),
            this.materialNormal.clone(),
            this.materialOverstepped.clone(),
            this.modelPath
        );
    }
});

export default Model;
