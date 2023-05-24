import * as THREE from 'three';


function RectangleHelper(width, height, color) {
    width = width || 10;
    height = height || 10;
    color = new THREE.Color(color !== undefined ? color : 0xc8c8c8);

    const halfWidth = width / 2;
    const halfHeight = height / 2;

    const vertices = [], colors = [];

    vertices.push(-halfWidth, 0, -halfHeight, -halfWidth, 0, halfHeight);
    vertices.push(halfWidth, 0, -halfHeight, halfWidth, 0, halfHeight);

    vertices.push(-halfWidth, 0, -halfHeight, halfWidth, 0, -halfHeight);
    vertices.push(-halfWidth, 0, halfHeight, halfWidth, 0, halfHeight);

    for (let offset = 0; offset < 8 * 3; offset += 3) {
        color.toArray(colors, offset);
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

    const material = new THREE.LineBasicMaterial({ vertexColors: THREE.VertexColors });

    THREE.LineSegments.call(this, geometry, material);
}

RectangleHelper.prototype = Object.create(THREE.LineSegments.prototype);
RectangleHelper.prototype.constructor = RectangleHelper;

export default RectangleHelper;
