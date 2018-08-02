import * as THREE from 'three';

const STATE = {
    initialized: 0, // position/scale/rotation has been initialized but not added to parent
    added: 1, // added to parent
    transformed: 2, // normal transformation completed: move/scale/rotate
    removed: 3 // removed from parent
};

// undoes: always keep the top item is current state
// -------------------
// |removed,     mt-N|
// -------------------
// |transformed, mt-N|
// -------------------
// |      .....      |
// -------------------
// |transformed, mt-2|
// -------------------
// |transformed, mt-1|
// -------------------
// |added,       mt-0|
// -------------------
// |initialized, mt-0|

// clear 'redoes' when 'remove from parent'/'transform completed'
function ModelMesh(geometry, materialNormal, materialOverstepped, modelFilePath) {
    THREE.Mesh.call(this);
    this.geometry = geometry;
    this.materialNormal = materialNormal;
    this.materialOverstepped = materialOverstepped;
    this.modelFilePath = modelFilePath;
    this.size = new THREE.Vector3(0, 0, 0);

    // add 'wireFrame'
    const geo = new THREE.EdgesGeometry(geometry); // or WireframeGeometry
    const mat = new THREE.LineBasicMaterial({ color: 0xff0000, linewidth: 2 });
    this.wireframe = new THREE.LineSegments(geo, mat);
    this.wireframe.position.set(0, 0, 0);
    this.wireframe.scale.set(1, 1, 1);
    this.add(this.wireframe);

    this.selected = false;
    this.setSelected(this.selected);

    // undo&redo
    this.undoes = [];
    this.redoes = [];
    this.onWillRemoveFromParent = undefined; // call back function
}

ModelMesh.prototype = Object.assign(Object.create(THREE.Mesh.prototype), {

    constructor: ModelMesh,

    // todo: rename
    clingToBottom: function () {
        // after modelMesh operated(move/scale/rotate), but modelMesh.geometry is not changed
        // so need to call: bufferGemotry.applyMatrix(matrixLocal);
        // then call: bufferGemotry.computeBoundingBox(); to get operated modelMesh BoundingBox
        this.updateMatrix();
        let bufferGemotry = this.geometry.clone();
        // Bakes matrix transform directly into vertex coordinates.
        bufferGemotry.applyMatrix(this.matrix);
        bufferGemotry.computeBoundingBox();
        // cling to bottom
        this.position.y += (-bufferGemotry.boundingBox.min.y);
    },

    checkBoundary: function () {
        this.computeSize();
        const boundaryLength = 125 / 2;
        // width
        const minWidth = this.position.x - this.size.x / 2;
        const maxWidth = this.position.x + this.size.x / 2;
        // height
        // model mesh always cling to bottom
        const maxHeight = this.size.y;
        // depth
        const minDepth = this.position.z - this.size.z / 2;
        const maxDepth = this.position.z + this.size.z / 2;
        // TODO: which side of print space is overstepped
        const widthOverstepped = (minWidth < -boundaryLength || maxWidth > boundaryLength);
        const heightOverstepped = (maxHeight > boundaryLength * 2);
        const depthOverstepped = (minDepth < -boundaryLength || maxDepth > boundaryLength);
        const overstepped = widthOverstepped || heightOverstepped || depthOverstepped;
        this.material = overstepped ? this.materialOverstepped : this.materialNormal;
        return overstepped;
    },

    computeSize: function () {
        this.updateMatrix();
        // must use deepCopy, if not, modelMesh will be changed by matrix
        let bufferGemotry = this.geometry.clone();
        // Bakes matrix transform directly into vertex coordinates.
        bufferGemotry.applyMatrix(this.matrix);
        bufferGemotry.computeBoundingBox();
        this.size = new THREE.Vector3(
            bufferGemotry.boundingBox.max.x - bufferGemotry.boundingBox.min.x,
            bufferGemotry.boundingBox.max.y - bufferGemotry.boundingBox.min.y,
            bufferGemotry.boundingBox.max.z - bufferGemotry.boundingBox.min.z
        );
    },

    setSelected: function (selected) {
        this.selected = selected;
        this.wireframe.visible = selected;
    },

    onInitialized: function () {
        this.updateMatrix();
        this.undoes.push({
            type: STATE.initialized,
            matrix: this.matrix.clone()
        });
    },

    onAddedToParent: function () {
        this.updateMatrix();
        this.undoes.push({
            type: STATE.added,
            matrix: this.matrix.clone()
        });
    },

    onTransformed: function () {
        this.updateMatrix();
        this.undoes.push({
            type: STATE.transformed,
            matrix: this.matrix.clone()
        });
        this.redoes = [];
    },

    removeFromParent: function () {
        if (typeof this.onWillRemoveFromParent === 'function') {
            this.onWillRemoveFromParent();
        }
        this.updateMatrix();
        this.undoes.push({
            type: STATE.removed,
            matrix: this.matrix.clone()
        });
        this.redoes = [];
        this.parent.remove(this);
    },

    undo: function (parent) {
        if (!this.canUndo()) {
            return;
        }
        this.redoes.push(this.undoes.pop());
        // next state
        const { matrix, type } = { ...this.undoes[this.undoes.length - 1] };
        if (type === STATE.initialized || type === STATE.removed) {
            if (typeof this.onWillRemoveFromParent === 'function') {
                this.onWillRemoveFromParent();
            }
            parent.remove(this);
        } else if (type === STATE.added || type === STATE.transformed) {
            parent.add(this);
            this.setTransformationToMatrix(matrix);
        }
    },

    redo: function (parent) {
        if (!this.canRedo()) {
            return;
        }
        this.undoes.push(this.redoes.pop());
        // next state
        const { matrix, type } = { ...this.undoes[this.undoes.length - 1] };
        if (type === STATE.removed) {
            if (typeof this.onWillRemoveFromParent === 'function') {
                this.onWillRemoveFromParent();
            }
            parent.remove(this);
        } else if (type === STATE.added || type === STATE.transformed) {
            parent.add(this);
            this.setTransformationToMatrix(matrix);
        } else if (type === STATE.initialized) {
            // no way
        }
    },

    setTransformationToMatrix: function (matrix) {
        this.updateMatrix();
        this.applyMatrix(new THREE.Matrix4().getInverse(this.matrix));
        this.applyMatrix(matrix);
        this.checkBoundary();
        // anther method:
        // decompose Matrix and reset position/rotation/scale
        // do not use Object3D.applyMatrix(matrix : Matrix4)
        // because applyMatrix is accumulated
        // let position = new THREE.Vector3();
        // let quaternion = new THREE.Quaternion();
        // let scale = new THREE.Vector3();
        // matrix.decompose(position, quaternion, scale);
        // this.position.copy(position);
        // this.quaternion.copy(quaternion);
        // this.scale.copy(scale);
    },

    canUndo: function () {
        return this.undoes.length > 1;
    },

    canRedo: function () {
        return this.redoes.length > 0;
    }
});

export default ModelMesh;
