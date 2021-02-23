export const bresenhamLine = (startPoint, endPoint) => {
    const res = [];

    const roundSP = { x: Math.round(startPoint.x), y: Math.round(startPoint.y) };
    const roundEP = { x: Math.round(endPoint.x), y: Math.round(endPoint.y) };

    const xRise = roundEP.x >= roundSP.x;
    const yRise = roundEP.y >= roundSP.y;

    const sP = { x: xRise ? roundSP.x : -roundSP.x, y: yRise ? roundSP.y : -roundSP.y };
    const eP = { x: xRise ? roundEP.x : -roundEP.x, y: yRise ? roundEP.y : -roundEP.y };

    const dx = eP.x - sP.x;
    const dy = eP.y - sP.y;
    const kElt1 = dy <= dx;

    res[0] = kElt1 ? [sP.x, sP.y] : [sP.y, sP.x];
    const d0 = kElt1 ? dx : dy;
    const d1 = kElt1 ? dy : dx;

    let i = 0;
    const p = [];
    p[0] = 2 * d1 - d0;
    while (i < d0) {
        if (p[i] <= 0) {
            res[i + 1] = [res[i][0] + 1, res[i][1]];
            p[i + 1] = p[i] + 2 * d1;
        } else {
            res[i + 1] = [res[i][0] + 1, res[i][1] + 1];
            p[i + 1] = p[i] + 2 * d1 - 2 * d0;
        }
        i++;
    }

    return res.map(v => {
        let x = kElt1 ? v[0] : v[1];
        x = xRise ? x : -x;
        let y = kElt1 ? v[1] : v[0];
        y = yRise ? y : -y;

        return {
            x,
            y
        };
    });
};
