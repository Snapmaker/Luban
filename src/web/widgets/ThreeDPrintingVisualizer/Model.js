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
}

export default Model;
