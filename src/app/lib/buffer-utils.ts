type TPoint = { x: number, y: number }

export const bufferToPoint = (buffer: ArrayBuffer) => {
    if (buffer instanceof ArrayBuffer && buffer.byteLength) {
        const view = new DataView(buffer);
        const points: TPoint[] = new Array(buffer.byteLength / 8 / 2);
        let j = 0;
        for (let index = 0; index + 8 < buffer.byteLength; index += 16) {
            points[j] = {
                x: view.getFloat64(index),
                y: view.getFloat64(index + 8)
            };
            j++;
        }
        return points;
    }
    return [];
};

export const pointToBuffer = (positions: TPoint[]) => {
    const buffer = new ArrayBuffer(positions.length * 2 * 8);
    const view = new DataView(buffer);
    for (let i = 0; i < positions.length; i++) {
        view.setFloat64(16 * i, positions[i].x);
        view.setFloat64(16 * i + 8, positions[i].y);
    }
    return buffer;
};

export const expandBuffer = (arr): ArrayBuffer[] => {
    return arr.reduce((p, c) => {
        if (c instanceof ArrayBuffer) {
            p.push(c);
        } else if (Array.isArray(c)) {
            p.push(...expandBuffer(c));
        } else {
            return pointToBuffer(c);
        }
        return p;
    }, []);
};
