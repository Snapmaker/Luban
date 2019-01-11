import * as THREE from 'three';


class PrintableCube extends THREE.Object3D {
    constructor() {
        super();
        this.isPrintCube = true;
        this.type = 'PrintCube';
        this._setup();
    }

    _setup() {
        // add 6 sides(GridHelper) of print space
        const size = 125;
        const divisions = 1;

        const bottom = new THREE.GridHelper(size, divisions * 10);
        bottom.position.set(0, -size / 2, 0);
        bottom.material.opacity = 0.25;
        bottom.material.transparent = true;
        this.add(bottom);

        const top = new THREE.GridHelper(size, divisions);
        top.position.set(0, size / 2, 0);
        this.add(top);

        const left = new THREE.GridHelper(size, divisions);
        left.rotateZ(Math.PI / 2);
        left.position.set(-size / 2, 0, 0);
        this.add(left);

        const right = new THREE.GridHelper(size, divisions);
        right.rotateZ(Math.PI / 2);
        right.position.set(size / 2, 0, 0);
        this.add(right);

        const front = new THREE.GridHelper(size, divisions);
        front.rotateX(Math.PI / 2);
        front.position.set(0, 0, size / 2);
        this.add(front);

        const back = new THREE.GridHelper(size, divisions);
        back.rotateX(Math.PI / 2);
        back.position.set(0, 0, -size / 2);
        this.add(back);

        for (let k = 0; k < this.children.length; k += 1) {
            if (this.children[k] instanceof THREE.GridHelper) {
                this.children[k].material.opacity = 0.25;
                this.children[k].material.transparent = true;
            }
        }
        // const axis = new THREE.AxesHelper(50);
        // axis.position.set(0, 0, 0);
        // this.add(axis);

        // add logo
        const geometry = new THREE.PlaneGeometry(size / 2, size / 8);
        const texture = new THREE.TextureLoader().load('./images/snapmaker-logo-512x128.png');
        const material = new THREE.MeshBasicMaterial({
            map: texture,
            side: THREE.DoubleSide,
            opacity: 0.75,
            transparent: true
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.rotateX(-Math.PI / 2);
        mesh.position.set(0, -size / 2, size / 4);
        this.add(mesh);
    }
}

export default PrintableCube;
