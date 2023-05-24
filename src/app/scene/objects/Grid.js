import {
    Color, Float32BufferAttribute, VertexColors,
    BufferGeometry, LineBasicMaterial, LineSegments
} from 'three';


class Grid extends LineSegments {
    /**
     * Create a Grid object on XY plane, starting at (0, 0, 0).
     *
     * @param width width of grid (along X axis)
     * @param height height of grid (along Y axis)
     * @param step grid cells are squares, step is the length of square
     * @param color integer color value of grid lines
     * @returns {Grid}
     */
    static createGrid(width, height, step, color) {
        width = width || 10;
        height = height || 10;
        step = step || 1;
        color = new Color(color !== undefined ? color : 0xd8d8d8);

        const hWidth = width / 2, hHeight = height / 2;

        const vertices = [], colors = [];

        // vertical segments
        let offset = 0;
        for (let x = -hWidth; x <= hWidth; x += step) {
            vertices.push(x, -hHeight, 0, x, hHeight, 0);

            color.toArray(colors, offset);
            offset += 3;
            color.toArray(colors, offset);
            offset += 3;
        }

        // horizontal segments
        for (let y = -hHeight; y <= hHeight; y += step) {
            vertices.push(-hWidth, y, 0, hWidth, y, 0);

            color.toArray(colors, offset);
            offset += 3;
            color.toArray(colors, offset);
            offset += 3;
        }

        const geometry = new BufferGeometry();
        geometry.setAttribute('position', new Float32BufferAttribute(vertices, 3));
        geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));

        const material = new LineBasicMaterial({ vertexColors: VertexColors });

        return new Grid(geometry, material);
    }

    constructor(geometry, material) {
        super(geometry, material);

        // this.type = 'LineSegments';
        this.type = 'Grid';
    }
}

export default Grid;
