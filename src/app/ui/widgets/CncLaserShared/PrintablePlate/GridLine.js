import * as THREE from 'three';

class GridLine {
    group = new THREE.Object3D();

    colorGrid = 0xF5F5F7;

    constructor(minX, maxX, stepX, minY, maxY, stepY, colorGrid) {
        colorGrid = colorGrid ?? this.colorGrid;

        minY = minY ?? minX;
        maxY = maxY ?? maxX;
        stepY = stepY ?? stepX;

        for (let x = Math.ceil(minX / stepX) * stepX; x <= Math.floor(maxX / stepX) * stepX; x += stepX) {
            const geometry = new THREE.Geometry();
            const material = new THREE.LineBasicMaterial({
                vertexColors: THREE.VertexColors
            });
            const color = colorGrid;

            geometry.vertices.push(
                new THREE.Vector3(x, minY, 0),
                new THREE.Vector3(x, maxY, 0),
            );
            geometry.colors.push(color, color);

            this.group.add(new THREE.Line(geometry, material));
        }

        for (let y = Math.ceil(minY / stepY) * stepY; y <= Math.floor(maxY / stepY) * stepY; y += stepY) {
            const geometry = new THREE.Geometry();
            const material = new THREE.LineBasicMaterial({
                vertexColors: THREE.VertexColors
            });
            const color = colorGrid;

            geometry.vertices.push(
                new THREE.Vector3(minX, y, 0),
                new THREE.Vector3(maxX, y, 0),
            );
            geometry.colors.push(color, color);

            this.group.add(new THREE.Line(geometry, material));
        }

        const color = 0xFFFFFF - 0xB9BCBF;
        const material = new THREE.LineBasicMaterial({
            linewidth: 2,
            color: color
        });

        const square = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(minX, minY, 0),
            new THREE.Vector3(maxX, minY, 0),
            new THREE.Vector3(maxX, maxY, 0),
            new THREE.Vector3(minX, maxY, 0),
            new THREE.Vector3(minX, minY, 0)
        ]);

        this.group.add(new THREE.Line(square, material));

        return this.group;
    }
}

export default GridLine;
