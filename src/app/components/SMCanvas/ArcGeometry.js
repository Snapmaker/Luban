import * as THREE from 'three';


// ArcGeometry
// Differs from [CircleGeometry](https://github.com/mrdoob/three.js/blob/dev/src/geometries/CircleGeometry.js),
// a much simpler version, but we keep the interface similar.
class ArcBufferGeometry extends THREE.BufferGeometry {
    constructor(radius = 1, segments = 8, thetaLength = Math.PI * 2) {
        super();

        this.type = 'ArcBufferGeometry';

        this.parameters = {
            radius,
            segments,
            thetaLength
        };

        segments = Math.max(3, segments);

        const vertices = [];

        const count = segments * thetaLength / (Math.PI * 2);
        for (let i = 0; i <= count; i++) {
            vertices.push(0, Math.cos(i / segments * Math.PI * 2) * radius, Math.sin(i / segments * Math.PI * 2) * radius);
        }

        this.addAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    }
}

export { ArcBufferGeometry };
