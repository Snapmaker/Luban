import {
    Object3D, DoubleSide, BoxGeometry,
    MeshPhongMaterial, Mesh
} from 'three';


class Env3Axis extends Object3D {
    size = { x: 0, y: 0, z: 0 };

    constructor(size) {
        super();
        this.type = 'PrintCube';

        this.size = size;
        this._setup();
    }

    updateSize(size) {
        this.size = size;
        this.remove(...this.children);
        this._setup();
    }

    update = () => {
        this.dispatchEvent({ type: 'update' });
    };

    _setup() {
        // const box = new BoxGeometry(this.size.x * 1.2, this.size.y, this.size.z * 1.2);
        const box = new BoxGeometry(this.size.x * 2, 0.01, this.size.z * 2);
        const materialNormal = new MeshPhongMaterial({
            opacity: 0.2,
            transparent: true,
            color: 0x909090,
            // avoid transparent material render z-fighting problem
            depthWrite: false,
            side: DoubleSide

        });
        const meshBox = new Mesh(box, materialNormal);
        meshBox.position.set(0, this.size.y / 2, 0);
        this.add(meshBox);
    }
}

export default Env3Axis;
