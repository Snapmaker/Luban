import * as THREE from 'three';
import { Geometry, Object3D } from 'three';

class GridLine extends Object3D {
    // public group = new THREE.Object3D();

    private colorCenterLine = new THREE.Color(0x444444);

    private colorGrid = new THREE.Color(0x888888);

    public constructor(minX, maxX, stepX, minY, maxY, stepY, colorCenterLine, colorGrid) {
        super();

        colorCenterLine = new THREE.Color(colorCenterLine) || this.colorCenterLine;
        colorGrid = new THREE.Color(colorGrid) || this.colorGrid;

        minY = minY ?? minX;
        maxY = maxY ?? maxX;
        stepY = stepY ?? stepX;

        for (let x = Math.ceil(minX / stepX) * stepX; x <= Math.floor(maxX / stepX) * stepX; x += stepX) {
            const geometry = new Geometry();
            const material = new THREE.LineBasicMaterial({
                vertexColors: THREE.VertexColors
            });
            const color = (x === 0) ? colorCenterLine : colorGrid;

            geometry.vertices.push(
                new THREE.Vector3(x, minY, 0),
                new THREE.Vector3(x, maxY, 0),
            );
            geometry.colors.push(color, color);

            this.add(new THREE.Line(geometry, material));
        }

        for (let y = Math.ceil(minY / stepY) * stepY; y <= Math.floor(maxY / stepY) * stepY; y += stepY) {
            const geometry = new Geometry();
            const material = new THREE.LineBasicMaterial({
                vertexColors: THREE.VertexColors
            });
            const color = (y === 0) ? colorCenterLine : colorGrid;

            geometry.vertices.push(
                new THREE.Vector3(minX, y, 0),
                new THREE.Vector3(maxX, y, 0),
            );
            geometry.colors.push(color, color);

            this.add(new THREE.Line(geometry, material));
        }
    }
}

export default GridLine;
