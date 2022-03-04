import {
    Object3D, FrontSide,
    PlaneGeometry, MeshBasicMaterial, Mesh,
    TextureLoader, LinearFilter
} from 'three';
import { DEFAULT_LUBAN_HOST } from '../../../constants';
import Rectangle from '../../../three-extensions/objects/Rectangle';
// import Grid from '../../../three-extensions/objects/Grid';
// import RectangleHelper from '../../components/three-extensions/RectangleHelper';
// import RectangleGridHelper from '../../components/three-extensions/RectangleGridHelper';


class PrintableCube extends Object3D {
    size = { x: 0, y: 0 };

    stopArea = {
        left: 20,
        right: 20,
        front: 20,
        back: 20,
    };

    stopAreaObjects = [];

    constructor(size, stopArea) {
        super();
        this.type = 'PrintCube';
        this.size = size;
        this.stopArea = stopArea;
        this.stopAreaObjects = [];
        this._setup();
        this._setupStopArea();
    }

    updateSize(size, stopArea) {
        this.size = size;
        this.remove(...this.children);
        this._setup();

        this.updateStopArea(stopArea);
    }

    updateStopArea(stopArea) {
        this.stopAreaObjects.forEach((mesh) => {
            this.remove(mesh);
        });
        this.stopAreaObjects = [];

        this.stopArea.left = stopArea.left ?? this.stopArea.left;
        this.stopArea.right = stopArea.right ?? this.stopArea.right;
        this.stopArea.back = stopArea.back ?? this.stopArea.back;
        this.stopArea.front = stopArea.front ?? this.stopArea.front;
        this._setupStopArea();
    }

    update = () => {
        this.dispatchEvent({ type: 'update' });
    };

    _setupStopArea() {
        const { left, right, front, back } = this.stopArea;
        const { x, y } = this.size;
        // front
        const geometry1 = new PlaneGeometry(x, front);
        const material1 = new MeshBasicMaterial({
            color: '#B9BCBF',
            side: FrontSide,
            opacity: 0.5,
            transparent: true
        });
        const mesh1 = new Mesh(geometry1, material1);
        mesh1.position.set(0, -y / 2 + front / 2, -0.1);
        this.add(mesh1);
        this.stopAreaObjects.push(mesh1);

        // back
        const geometry2 = new PlaneGeometry(x, back);
        const material2 = new MeshBasicMaterial({
            color: '#B9BCBF',
            side: FrontSide,
            opacity: 0.5,
            transparent: true
        });
        const mesh2 = new Mesh(geometry2, material2);
        mesh2.position.set(0, y / 2 - back / 2, -0.1);
        this.add(mesh2);
        this.stopAreaObjects.push(mesh2);

        // left
        const geometry3 = new PlaneGeometry(left, y - back - front);
        const material3 = new MeshBasicMaterial({
            color: '#B9BCBF',
            side: FrontSide,
            opacity: 0.5,
            transparent: true
        });
        const mesh3 = new Mesh(geometry3, material3);
        mesh3.position.set(-x / 2 + left / 2, (front - back) / 2, -0.1);
        this.add(mesh3);
        this.stopAreaObjects.push(mesh3);

        // right
        const geometry4 = new PlaneGeometry(right, y - back - front);
        const material4 = new MeshBasicMaterial({
            color: '#B9BCBF',
            side: FrontSide,
            opacity: 0.5,
            transparent: true
        });
        const mesh4 = new Mesh(geometry4, material4);
        mesh4.position.set(x / 2 - right / 2, (front - back) / 2, -0.1);
        this.add(mesh4);
        this.stopAreaObjects.push(mesh4);
    }

    _setup() {
        // Faces
        // const bottom = Grid.createGrid(this.size.x, this.size.y, 10, '#D5D6D9');
        // bottom.position.set(0, 0, 0);
        // this.add(bottom);
        for (let x = -this.size.x / 2 + 10; x < this.size.x / 2; x += 10) {
            const g = new PlaneGeometry(0.5, this.size.y);
            const m = new MeshBasicMaterial({
                side: FrontSide,
                color: '#D5D6D9',
                transparent: true
            });
            const b = new Mesh(g, m);
            b.position.set(x, 0, 0);
            this.add(b);
        }
        for (let y = -this.size.y / 2 + 10; y < this.size.y / 2; y += 10) {
            const g = new PlaneGeometry(this.size.x, 0.5);
            const m = new MeshBasicMaterial({
                side: FrontSide,
                color: '#D5D6D9',
                transparent: true
            });
            const b = new Mesh(g, m);
            b.position.set(0, y, 0);
            this.add(b);
        }

        const top = Rectangle.createRectangle(this.size.x, this.size.y, '#85888C');
        top.position.set(0, 0, this.size.z);
        this.add(top);

        const bottomBorder = top.clone();
        bottomBorder.position.set(0, 0, 0);
        this.add(bottomBorder);

        const left = Rectangle.createRectangle(this.size.z, this.size.y, '#85888C');
        left.rotateY(-Math.PI / 2);
        left.position.set(-this.size.x / 2, 0, this.size.z / 2);
        this.add(left);

        const right = left.clone();
        right.position.set(this.size.x / 2, 0, this.size.z / 2);
        this.add(right);

        // Add logo
        const minSideLength = Math.min(this.size.x, this.size.y);
        const geometry = new PlaneGeometry(minSideLength / 2, minSideLength / 8);
        const texture = new TextureLoader().load(`${DEFAULT_LUBAN_HOST}/resources/images/snapmaker-logo-1024x256.png`, this.update);
        texture.minFilter = LinearFilter;
        const material = new MeshBasicMaterial({
            map: texture,
            side: FrontSide,
            opacity: 0.75,
            transparent: true
        });
        const mesh = new Mesh(geometry, material);
        mesh.position.set(0, -this.size.y / 4, 0.01);
        this.add(mesh);
    }
}

export default PrintableCube;
