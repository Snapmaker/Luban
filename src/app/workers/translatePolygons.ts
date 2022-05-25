import sendMessage from './utils/sendMessage';

type TPoint = { x: number, y: number, z?: number }


const translatePolygons = (polygons: TPoint[][], translate: {
    x: number,
    y: number,
    z?: number
}) => {
    const res = polygons.map((polygon) => {
        return polygon.map((point) => {
            point.x += translate.x;
            point.y += translate.y;
            (point.z && translate.z) && (point.z += translate.z);
            return point;
        });
    });
    // return res;
    return sendMessage(res);
};

export default translatePolygons;
