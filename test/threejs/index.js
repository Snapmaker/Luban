function printablePlateLine(v1, v2, color) {
    const positions = [];
    const colors = [];

    // eslint-disable-next-line no-undef
    color = new THREE.Color(color !== undefined ? color : 0xc8c8c8);

    colors.push(color.r);
    colors.push(color.g);
    colors.push(color.b);
    colors.push(color.r);
    colors.push(color.g);
    colors.push(color.b);

    positions.push(v1.x);
    positions.push(v1.y);
    positions.push(0);
    positions.push(v2.x);
    positions.push(v2.y);
    positions.push(0);


    // eslint-disable-next-line no-undef
    const bufferGeometry = new THREE.BufferGeometry();
    // eslint-disable-next-line no-undef
    const positionAttribute = new THREE.Float32BufferAttribute(positions, 3);
    bufferGeometry.addAttribute('position', positionAttribute);
    // eslint-disable-next-line no-undef
    bufferGeometry.addAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    // eslint-disable-next-line no-undef
    const material = new THREE.LineBasicMaterial({ vertexColors: THREE.VertexColors });
    // eslint-disable-next-line no-undef
    return new THREE.Line(bufferGeometry, material);
}

// eslint-disable-next-line no-unused-vars
function printablePlate(group, size, interval, color) {
    interval = interval !== undefined ? interval : 10;
    for (let i = 0; i <= size.x / 2; i += interval) {
        const line1 = printablePlateLine({ x: i, y: -size.y / 2 }, { x: i, y: size.y / 2 }, color);
        const line2 = printablePlateLine({ x: -i, y: -size.y / 2 }, { x: -i, y: size.y / 2 }, color);
        group.add(line1);
        group.add(line2);
    }
    for (let i = 0; i <= size.y / 2; i += interval) {
        const line1 = printablePlateLine({ x: -size.x / 2, y: i }, { x: size.x / 2, y: i }, color);
        const line2 = printablePlateLine({ x: -size.x / 2, y: -i }, { x: size.x / 2, y: -i }, color);
        group.add(line1);
        group.add(line2);
    }
}

// eslint-disable-next-line no-unused-vars
function graph(group, points, color) {
    const positions = [];
    const colors = [];
    // eslint-disable-next-line no-undef
    color = new THREE.Color(color !== undefined ? color : 0x0000FF);


    for (const point of points) {
        positions.push(point[0]);
        positions.push(point[1]);
        positions.push(0);
        colors.push(color.r);
        colors.push(color.g);
        colors.push(color.b);
    }


    // eslint-disable-next-line no-undef
    const bufferGeometry = new THREE.BufferGeometry();
    // eslint-disable-next-line no-undef
    const positionAttribute = new THREE.Float32BufferAttribute(positions, 3);
    bufferGeometry.addAttribute('position', positionAttribute);
    // eslint-disable-next-line no-undef
    bufferGeometry.addAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    // eslint-disable-next-line no-undef
    const material = new THREE.LineBasicMaterial({ vertexColors: THREE.VertexColors });
    // eslint-disable-next-line no-undef
    group.add(new THREE.Line(bufferGeometry, material));
}
