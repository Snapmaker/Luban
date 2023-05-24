import {
    Color, Float32BufferAttribute, VertexColors,
    BufferGeometry, LineBasicMaterial, LineSegments
} from 'three';

class Rectangle extends LineSegments {
    /**
     * Create a Rectangle object on XY plane, starting at (0, 0, 0).
     *
     * @param width width of rectangle (along X axis)
     * @param height height of rectangle (along Y axis)
     * @param color integer color value of rectangle lines
     * @returns {Rectangle}
     */
    static createRectangle(width, height, color) {
        width = width || 10;
        height = height || 10;
        color = new Color(color !== undefined ? color : 0xc8c8c8);

        const hWidth = width / 2, hHeight = height / 2;

        const vertices = [], colors = [];

        // horizontal segments
        vertices.push(-hWidth, -hHeight, 0, hWidth, -hHeight, 0);
        vertices.push(-hWidth, hHeight, 0, hWidth, hHeight, 0);

        // vertical segments
        vertices.push(-hWidth, -hHeight, 0, -hWidth, hHeight, 0);
        vertices.push(hWidth, -hHeight, 0, hWidth, hHeight, 0);

        for (let offset = 0; offset < 8 * 3; offset += 3) {
            color.toArray(colors, offset);
        }

        const geometry = new BufferGeometry();
        geometry.setAttribute('position', new Float32BufferAttribute(vertices, 3));
        geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));

        const material = new LineBasicMaterial({ vertexColors: VertexColors });

        return new Rectangle(geometry, material);
    }

    constructor(geometry, material) {
        super(geometry, material);

        // this.type = 'LineSegments';
        this.type = 'Rectangle';
    }
}

export default Rectangle;
