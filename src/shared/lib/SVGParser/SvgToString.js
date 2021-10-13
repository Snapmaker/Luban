function getPath(shape) {
    if (!shape.visibility) {
        return '';
    }

    const paths = [];

    for (const aPath of shape.paths) {
        let pathExpression = 'M';
        for (const point of aPath.points) {
            pathExpression += `${point[0]} ${point[1]} `;
        }
        paths.push(`<path d="${pathExpression}" stroke="${shape.stroke ? shape.stroke : 'none'}"
                fill="${shape.fill ? shape.fill : 'none'}"
                stroke-width="${1}"/>`);
    }

    return paths.join('\n');
}

export const svgInverse = (svg, flip = 1) => {
    const { width, height, viewBox } = svg;
    const [x, y] = viewBox;
    for (const shape of svg.shapes) {
        for (const path of shape.paths) {
            for (const point of path.points) {
                point[0] = flip & 1 ? width - (point[0] - x) + x : point[0];
                point[1] = flip & 2 ? height - (point[1] - y) + y : point[1];
            }
        }
    }
};

export const svgToString = (svg) => {
    return `<svg xmlns="http://www.w3.org/2000/svg"
        fill="none"
        stroke="#000000"
        stroke-width="1"
        width="${svg.width}"
        height="${svg.height}"
        viewBox="${svg.viewBox}"
        version="1.1">
        ${svg.shapes.map(shape => `${getPath(shape)}\n`)}
      </svg>`;
};
