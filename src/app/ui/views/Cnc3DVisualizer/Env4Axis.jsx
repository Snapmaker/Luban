import {
    Object3D, DoubleSide, CylinderGeometry,
    MeshPhongMaterial, Mesh
} from 'three';
// import Rectangle from '../../three-extensions/objects/Rectangle';
// import Grid from '../../three-extensions/objects/Grid';
// import RectangleHelper from '../../components/three-extensions/RectangleHelper';
// import RectangleGridHelper from '../../components/three-extensions/RectangleGridHelper';


class PrintableCube extends Object3D {
    size = { x: 0, y: 0 };

    constructor(mesh, job) {
        super();
        this.type = 'PrintCube';
        this.job = job;
        const geometry = mesh.geometry;
        geometry.computeBoundingBox();
        const bbox = mesh.geometry.boundingBox;

        this.size = {
            x: bbox.max.x - bbox.min.x,
            y: bbox.max.y - bbox.min.y,
            z: bbox.max.z - bbox.min.z
        };
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
        // job
        const jobBase = new CylinderGeometry(this.job.diameter / 2, this.job.diameter / 2, 20, 64);
        const materialJobBase = new MeshPhongMaterial({
            color: 0xFFE7E8,
            side: DoubleSide,
            opacity: 0.5,
            transparent: true,
            // avoid transparent material render z-fighting problem
            depthWrite: false
        });
        const meshJobBase = new Mesh(jobBase, materialJobBase);
        meshJobBase.position.set(0, 0, -this.job.length / 2 + 10);
        meshJobBase.rotateX(Math.PI / 2);
        this.add(meshJobBase);
        const jobDot = new CylinderGeometry(1, 1, 1, 64);
        const meshJobDot = new Mesh(jobDot, new MeshPhongMaterial({ color: 0xFF0000, side: DoubleSide }));
        meshJobDot.position.set(0, 0, this.job.length / 2);
        meshJobDot.rotateX(Math.PI / 2);
        this.add(meshJobDot);


        const jobBox = new CylinderGeometry(this.job.diameter / 2, this.job.diameter / 2, this.job.length - 20, 64);
        const materialJob = new MeshPhongMaterial({
            opacity: 0.2,
            transparent: true,
            color: 0xffffff,
            // avoid transparent material render z-fighting problem
            depthWrite: false,
            side: DoubleSide
        });
        const meshJob = new Mesh(jobBox, materialJob);
        meshJob.position.set(0, 0, 10);
        meshJob.rotateX(Math.PI / 2);
        this.add(meshJob);
    }
}

export default PrintableCube;
