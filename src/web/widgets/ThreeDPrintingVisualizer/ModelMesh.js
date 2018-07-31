import * as THREE from 'three';

function ModelMesh(geometry, materialNormal, materialOverstepped, modelFilePath) {
    THREE.Mesh.call(this);
    this.geometry = geometry;
    this.materialNormal = materialNormal;
    this.materialOverstepped = materialOverstepped;
    this.modelFilePath = modelFilePath;
    this.size = new THREE.Vector3(0, 0, 0);

    this.selected = false;

    //add 'wireFrame'
    const geo = new THREE.EdgesGeometry(geometry); // or WireframeGeometry
    const mat = new THREE.LineBasicMaterial({ color: 0xff0000, linewidth: 2 });
    this.wireframe = new THREE.LineSegments(geo, mat);
    this.wireframe.position.set(0, 0, 0);
    this.wireframe.scale.set(1, 1, 1);
    this.add(this.wireframe);

    this.setSelected(this.selected);
}

ModelMesh.prototype = Object.assign(Object.create(THREE.Mesh.prototype), {

    constructor: ModelMesh,

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
    }
});

export default ModelMesh;
