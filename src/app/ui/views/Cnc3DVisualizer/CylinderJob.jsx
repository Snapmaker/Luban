import {
    Object3D, DoubleSide,
    PlaneGeometry, MeshBasicMaterial, Mesh,
    TextureLoader
} from 'three';
import Rectangle from '../../../scene/objects/Rectangle';
import Grid from '../../../scene/objects/Grid';
import { DEFAULT_LUBAN_HOST } from '../../../constants';
// import RectangleHelper from '../../components/three-extensions/RectangleHelper';
// import RectangleGridHelper from '../../components/three-extensions/RectangleGridHelper';


class PrintableCube extends Object3D {
    size = { x: 0, y: 0 };

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
        // Faces
        const bottom = Grid.createGrid(this.size.x, this.size.y, 10);
        bottom.position.set(0, 0, 0);
        this.add(bottom);

        const top = Rectangle.createRectangle(this.size.x, this.size.y);
        top.position.set(0, 0, this.size.z);
        this.add(top);

        const left = Rectangle.createRectangle(this.size.z, this.size.y);
        left.rotateY(-Math.PI / 2);
        left.position.set(-this.size.x / 2, 0, this.size.z / 2);
        this.add(left);

        const right = left.clone();
        right.position.set(this.size.x / 2, 0, this.size.z / 2);
        this.add(right);

        // Add logo
        const minSideLength = Math.min(this.size.x, this.size.y);
        const geometry = new PlaneGeometry(minSideLength / 2, minSideLength / 8);
        const texture = new TextureLoader().load(`${DEFAULT_LUBAN_HOST}/resources/images/snapmaker-logo-512x128.png`, this.update);
        const material = new MeshBasicMaterial({
            map: texture,
            side: DoubleSide,
            opacity: 0.75,
            transparent: true
        });
        const mesh = new Mesh(geometry, material);
        mesh.position.set(0, -this.size.y / 4, 0);
        this.add(mesh);
    }
}

export default PrintableCube;
