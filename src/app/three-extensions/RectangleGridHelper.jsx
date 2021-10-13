import * as THREE from 'three';


function RectangleGridHelper(width, height, step, color) {
    width = width || 10;
    height = height || 10;
    step = step || 1;
    color = new THREE.Color(color !== undefined ? color : 0xd8d8d8);

    const halfWidth = width / 2;
    const halfHeight = height / 2;

    const vertices = [], colors = [];
    let offset = 0;

    for (let x = -halfWidth; x <= halfWidth; x += step) {
        vertices.push(x, 0, -halfHeight, x, 0, halfHeight);

        color.toArray(colors, offset);
        offset += 3;
        color.toArray(colors, offset);
        offset += 3;
    }

    for (let z = -halfHeight; z <= halfHeight; z += step) {
        vertices.push(-halfWidth, 0, z, halfWidth, 0, z);

        color.toArray(colors, offset);
        offset += 3;
        color.toArray(colors, offset);
        offset += 3;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

    const material = new THREE.LineBasicMaterial({ vertexColors: THREE.VertexColors });

    THREE.LineSegments.call(this, geometry, material);
}

RectangleGridHelper.prototype = Object.create(THREE.LineSegments.prototype);
RectangleGridHelper.prototype.constructor = RectangleGridHelper;

export default RectangleGridHelper;
